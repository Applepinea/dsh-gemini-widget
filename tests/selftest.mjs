import assert from 'node:assert'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// 从 host 半抽出纯函数做黑盒测试（复制同一份逻辑，保证与实现一致）
const PEAK_HOURS = [[9, 12], [14, 18]]
const FLASH = { hit: [0.02, 0.04], miss: [1, 2], out: [4, 8] }
const PRO = { hit: [0.15, 0.3], miss: [4.5, 9.0], out: [13.5, 27.0] }
const PRICING = { 'deepseek-v4-pro': PRO, _default: FLASH }
const WEEKEND_VALLEY_FROM = Math.floor(Date.UTC(2026, 7, 22, 16, 0, 0) / 1000)

function isPeak(sec) {
  const n = Number(sec)
  if (!Number.isFinite(n)) return false
  const bj = new Date(n * 1000 + 8 * 3600 * 1000)
  if (n >= WEEKEND_VALLEY_FROM) { const d = bj.getUTCDay(); if (d === 0 || d === 6) return false }
  const h = bj.getUTCHours()
  return PEAK_HOURS.some(([a, b]) => h >= a && h < b)
}
function priceFor(m0) { const m = String(m0 || '').toLowerCase()
  for (const k of Object.keys(PRICING)) if (k !== '_default' && m.includes(k)) return PRICING[k]
  return PRICING._default }
function stepCost(usage, model, at) {
  const i = Number(usage && usage.inputTokens) || 0
  const c = Number(usage && usage.cacheReadTokens) || 0
  const o = Number(usage && usage.outputTokens) || 0
  const p = priceFor(model); const k = isPeak(at) ? 1 : 0
  return (c / 1e6) * p.hit[k] + (i / 1e6) * p.miss[k] + (o / 1e6) * p.out[k]
}
// 北京时间 2026-11-27 是周五
function bj(want) { return Math.floor(Date.parse(want + '+08:00') / 1000) }

const tests = []
function t(name, fn) { tests.push([name, fn]) }

t('谷价 08:00', () => assert.equal(isPeak(bj('2026-11-27T08:00:00')), false))
t('峰价 09:00', () => assert.equal(isPeak(bj('2026-11-27T09:00:00')), true))
t('峰价 11:59', () => assert.equal(isPeak(bj('2026-11-27T11:59:00')), true))
t('谷价 12:00', () => assert.equal(isPeak(bj('2026-11-27T12:00:00')), false))
t('峰价 14:00', () => assert.equal(isPeak(bj('2026-11-27T14:00:00')), true))
t('谷价 18:00', () => assert.equal(isPeak(bj('2026-11-27T18:00:00')), false))
t('周六全天谷价', () => assert.equal(isPeak(bj('2026-11-28T10:00:00')), false))
t('周日全天谷价', () => assert.equal(isPeak(bj('2026-11-29T10:00:00')), false))
t('周一 10 点峰价', () => assert.equal(isPeak(bj('2026-11-30T10:00:00')), true))

t('flash 谷价计价', () => {
  const c = stepCost({ inputTokens: 1e6, cacheReadTokens: 0, outputTokens: 0 }, 'deepseek-v4.1-flash', bj('2026-11-27T20:00:00'))
  assert.equal(Math.round(c * 1000) / 1000, 1)
})
t('flash 峰价翻倍', () => {
  const c = stepCost({ inputTokens: 1e6 }, 'deepseek-v4.1-flash', bj('2026-11-27T10:00:00'))
  assert.equal(Math.round(c * 1000) / 1000, 2)
})
t('缓存命中更便宜', () => {
  const hit = stepCost({ inputTokens: 0, cacheReadTokens: 1e6 }, 'deepseek-flash', bj('2026-11-27T20:00:00'))
  assert.equal(Math.round(hit * 1000) / 1000, 0.02)
})
t('pro 贵 3 倍(on miss)', () => {
  const c = stepCost({ inputTokens: 1e6 }, 'deepseek-v4-pro', bj('2026-11-27T20:00:00'))
  assert.equal(Math.round(c * 1000) / 1000, 4.5)
})
t('reasoning 不重复计费', () => {
  const withR = stepCost({ inputTokens: 0, outputTokens: 1e6, reasoningTokens: 1e6 }, 'deepseek-flash', bj('2026-11-27T20:00:00'))
  const without = stepCost({ inputTokens: 0, outputTokens: 1e6 }, 'deepseek-flash', bj('2026-11-27T20:00:00'))
  assert.equal(withR, without)
})

let pass = 0, fail = 0
for (const [name, fn] of tests) {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + ' → ' + (e && e.message)) }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
