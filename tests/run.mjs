#!/usr/bin/env node
// 统一测试入口。逐个 import 各测试文件，任一失败即非零退出。
//
// 为什么不用 `node --test` / spawn：它们会给每个文件起子进程，在任何禁止 spawn
// 的受限环境里直接 EPERM —— 测试还没跑就红了。同进程顺序执行兼容性最好。
//
// ⚠️ 关键：测试文件里有异步 IIFE（await 之后才 process.exit）。
//    早期实现把 process.exit 改成"抛异常"，对同步测试有效；
//    但异步测试的 exit 在后续 tick 里调用，异常逃出 try 变成 unhandled rejection，
//    结果是**测试静默不跑、runner 却报通过**（uitest/ctxtest/audiotest 全部空转）。
//    现在改成"resolve 一个完成信号并 await 它"，两种形态都正确。
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const FILES = ['selftest.mjs', 'hosttest.mjs', 'uitest.mjs', 'ctxtest.mjs', 'audiotest.mjs', 'turnendtest.mjs', 'balancetest.mjs']
const TIMEOUT_MS = 30000

const realExit = process.exit.bind(process)
let failed = 0
let resolveDone = null

process.exit = (code) => {
  if (code && code !== 0) failed += 1
  const r = resolveDone
  resolveDone = null
  if (r) r()
  // 不再抛异常：同步测试的 exit 都在最后一行，异步测试在 IIFE 末尾，
  // 两者都不需要在 exit 之后继续执行任何代码。
  return undefined
}

for (const file of FILES) {
  console.log('\n▸ ' + file)
  const done = new Promise((resolve) => { resolveDone = resolve })
  const timer = setTimeout(() => {
    failed += 1
    console.log('  FAIL ' + file + '：超时（' + TIMEOUT_MS + 'ms 内未结束）')
    const r = resolveDone; resolveDone = null; if (r) r()
  }, TIMEOUT_MS)

  try {
    await import(pathToFileURL(join(HERE, file)).href + '?t=' + Date.now())
  } catch (err) {
    failed += 1
    console.log('  FAIL ' + file + '：' + String((err && err.message) || err).split('\n')[0])
    const r = resolveDone; resolveDone = null; if (r) r()
  }
  await done
  clearTimeout(timer)
}

process.exit = realExit
console.log(failed === 0 ? '\n全部测试通过' : '\n' + failed + ' 个测试文件未通过')
realExit(failed === 0 ? 0 : 1)
