#!/usr/bin/env node
// 一条命令发版：自检 → 测试 → 升版本 → 打包 → 产出 dist/dsh-gemini-widget.tgz
//
//   npm run release              升 patch（0.1.1 → 0.1.2）
//   npm run release minor        升 minor
//   npm run release major        升 major
//   npm run release -- --dry-run 只看会做什么，不改文件
//
// 版本号只在这个脚本里改；README 不写版本号，不用手工同步。
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const skipTests = argv.includes('--skip-tests')
const level = argv.find((a) => ['patch', 'minor', 'major'].includes(a)) ?? 'patch'

const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const next =
  level === 'major' ? (major + 1) + '.0.0'
  : level === 'minor' ? major + '.' + (minor + 1) + '.0'
  : major + '.' + minor + '.' + (patch + 1)

const step = (m) => console.log('\n▸ ' + m)
const ok = (m) => console.log('  ✔ ' + m)

console.log('dsh-gemini-widget 发版：' + pkg.version + ' → ' + next + (dryRun ? '（dry-run）' : ''))

step('自检')
execFileSync(process.execPath, [join(root, 'scripts', 'check.mjs')], { cwd: root, stdio: 'inherit' })
ok('清单、文件、资源、前端约定、语法全部通过')

if (!skipTests) {
  step('测试')
  execFileSync(process.execPath, [join(root, 'tests', 'run.mjs')], { cwd: root, stdio: 'inherit' })
  ok('测试通过')
}

if (dryRun) {
  console.log('\n干跑结束，没有改动任何文件。去掉 --dry-run 即正式执行。')
  process.exit(0)
}

step('升版本')
pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
ok('package.json 已更新为 ' + next)

step('打包')
const packed = execFileSync('npm', ['pack'], { cwd: root, encoding: 'utf8' }).trim().split('\n').pop().trim()
const dist = join(root, 'dist')
mkdirSync(dist, { recursive: true })
const target = join(dist, 'dsh-gemini-widget.tgz')
if (existsSync(target)) rmSync(target)
copyFileSync(join(root, packed), target)
rmSync(join(root, packed))
const kb = (readFileSync(target).length / 1024).toFixed(1)
ok('dist/dsh-gemini-widget.tgz（' + kb + ' kB）')

console.log(`
完成。接下来三步：

  1. 提交并推送改动（含 package.json）
  2. 建 Release，tag 填 v${next}，资产上传 dist/dsh-gemini-widget.tgz
  3. npm publish
`)
