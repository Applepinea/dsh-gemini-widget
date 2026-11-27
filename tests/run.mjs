#!/usr/bin/env node
// 统一测试入口。逐个 import 各测试文件，任一失败即非零退出。
//
// 为什么不用 `node --test` / spawn：它们会给每个文件起子进程，在任何禁止 spawn
// 的受限环境里直接 EPERM —— 测试还没跑就红了。同进程顺序执行兼容性最好。
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FILES = ['selftest.mjs', 'hosttest.mjs', 'uitest.mjs', 'ctxtest.mjs', 'audiotest.mjs']

// 各测试文件自己会 process.exit；同进程跑必须拦下来，改成记录结果。
let failed = 0
const realExit = process.exit.bind(process)
process.exit = (code) => {
  if (code && code !== 0) failed += 1
  throw new Error('__TEST_DONE__')
}

for (const file of FILES) {
  console.log('\n▸ ' + file)
  try {
    await import(pathToFileURL(join(HERE, file)).href + '?t=' + Date.now())
  } catch (err) {
    if (!(err && err.message === '__TEST_DONE__')) {
      failed += 1
      console.log('  FAIL ' + file + '：' + String(err && err.message).split('\n')[0])
    }
  }
}

process.exit = realExit
console.log(failed === 0 ? '\n全部测试通过' : '\n' + failed + ' 个测试文件未通过')
process.exit(failed === 0 ? 0 : 1)
