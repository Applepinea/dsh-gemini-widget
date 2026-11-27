#!/usr/bin/env node
// 发布前自检：清单字段、插件声明、文件完整性、语法、前端 bundle 约定。
// 用法：npm run check
import vm from 'node:vm'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed += 1; console.log('  FAIL ' + m) }
const must = (c, m) => (c ? ok(m) : bad(m))
const section = (t) => console.log('\n' + t)

section('清单字段')
for (const key of ['name', 'version', 'description', 'license', 'type', 'main']) {
  must(typeof pkg[key] === 'string' && pkg[key].length > 0, 'package.json 有 ' + key)
}
must(pkg.name === pkg.name.toLowerCase() && /^[a-z0-9][a-z0-9._-]*$/.test(pkg.name), 'name 全小写且合法')
must(pkg.type === 'module', 'type 为 module')
must(/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(pkg.version), 'version 是合法 semver')
must(pkg.license === 'AGPL-3.0-or-later', 'license 为 AGPL-3.0-or-later')
must(Array.isArray(pkg.keywords) && pkg.keywords.includes('dsh-plugin'), 'keywords 含 dsh-plugin')
must(Boolean(pkg.repository && pkg.repository.url), 'repository 已声明')

section('dsh 插件声明')
const patch = pkg.dsh?.bundle?.patch
must(Boolean(patch), 'dsh.bundle.patch 已声明')
if (patch) {
  const f = join(root, patch)
  must(existsSync(f), '补丁文件存在：' + patch)
  if (existsSync(f)) {
    const yml = readFileSync(f, 'utf8')
    must(/insert:/.test(yml), '补丁文件含 insert 条目')
    must(new RegExp('id:\\s*' + pkg.name).test(yml), '补丁文件声明的 id 与包名一致（' + pkg.name + '）')
    must(new RegExp('name:\\s*' + pkg.name).test(yml), '补丁文件声明的 name 与包名一致')
  }
}

section('入口与文件')
must(existsSync(join(root, pkg.main ?? '')), 'main 指向的文件存在：' + pkg.main)
for (const item of pkg.files ?? []) {
  must(existsSync(join(root, item)), 'files 中的 ' + item + ' 存在')
}
// 发布包里不该出现的东西
const forbidden = ['tests', 'scripts', '.github', 'node_modules', 'dist']
for (const item of pkg.files ?? []) {
  must(!forbidden.includes(item.replace(/\/+$/, '')), 'files 不含开发资产：' + item)
}

section('资源完整性')
const frames = join(root, 'assets', 'frames')
const FRAMES = ['idle', 'eat', 'wait', 'xd', 'grin']
for (const n of FRAMES) {
  const f = join(frames, n + '.webp')
  must(existsSync(f), '立绘 ' + n + '.webp 存在')
  if (existsSync(f)) must(statSync(f).size > 1000, n + '.webp 非空（' + statSync(f).size + 'B）')
}
must(existsSync(join(root, 'assets', 'neko-widget.js')), '前端脚本 assets/neko-widget.js 存在')

section('前端约定')
{
  const w = readFileSync(join(root, 'assets', 'neko-widget.js'), 'utf8')
  // 桌面端主窗是 contextIsolation + sandbox：客户端脚本里出现 require 会让整个 boot 崩掉
  must(!/(^|[^.\w])require\s*\(/.test(w), '前端不调用 require()（桌面端沙箱会拒绝）')
  must(!/require\(['"]electron['"]\)/.test(w), '前端不 require electron')
  must(/window\.__DSH_GEMINI_WIDGET__/.test(w), '前端有重复注入哨兵')
  must(/var ROUTE = '\/dsh-gemini-widget'/.test(w), '前端路由前缀与包名一致')

  const h = readFileSync(join(root, 'lib', 'index.js'), 'utf8')
  must(/const ROUTE = '\/dsh-gemini-widget'/.test(h), '宿主路由前缀与包名一致')
  must(/webserver\/index-inject/.test(h), '宿主注册了桌面端注入行')
  must(/requestRejection/.test(h), '宿主挂了浏览器信任栅栏')
  must(/export default \{/.test(h), '宿主有 default export')
}

section('语法')
const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(mjs|js)$/.test(name)) files.push(full)
  }
})(root)
for (const f of files) {
  // 用 vm.compileFunction 做语法检查而不是 spawn `node --check`：
  // 后者在受限环境（CI 沙箱 / 禁 spawn）里会 EPERM，测试还没跑就红了。
  try {
    const src = readFileSync(f, 'utf8')
    if (/\.mjs$/.test(f) || /^\s*(import|export)\b/m.test(src)) {
      // ESM 不能直接 compileFunction，用 SourceTextModule 之外的等效手段：
      // 把 import/export 换成空操作后再编译，足以发现括号/引号这类语法错。
      const probe = src
        .replace(/^#![^\n]*\n/, '')   // shebang 在函数体里非法，先剥掉
        .replace(/\bimport\.meta\b/g, '__IMPORT_META__')
        .replace(/^\s*import\s[^;\n]*from\s*['"][^'"]+['"]\s*;?/gm, '')
        .replace(/^\s*import\s*['"][^'"]+['"]\s*;?/gm, '')
        .replace(/^\s*export\s+default\s+/gm, 'const __d = ')
        .replace(/^\s*export\s+(const|let|var|function|class|async)\b/gm, '$1')
        .replace(/^\s*export\s*\{[^}]*\}\s*;?/gm, '')
      vm.compileFunction('(async () => {\n' + probe + '\n})', ['__x'])
    } else {
      vm.compileFunction(src, ['__x'])
    }
    ok(f.slice(root.length + 1) + ' 语法通过')
  } catch (e) {
    bad(f.slice(root.length + 1) + ' 语法错误：' + String(e && e.message).split('\n')[0])
  }
}

console.log('\n' + (failed === 0 ? '全部通过' : failed + ' 项未通过') + '（' + files.length + ' 个文件）')
process.exit(failed === 0 ? 0 : 1)
