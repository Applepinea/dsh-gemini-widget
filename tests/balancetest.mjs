// 余额路径回归测试：credentials 必须通过 ctx.get() 读到，而不是 ctx.credentials。
// 这正是 0.1.1 里"余额永远显示 —"的根因：inject 列表没有 credentials，
// 直接写 ctx.credentials.resolve() 会抛 TypeError，被 catch 后当成"没有 key"。
import assert from 'node:assert'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOST_ENTRY = join(HERE, '..', 'lib', 'index.js')

const routes = {}
const events = {}

const fakeCreds = {
  resolve: async (ref) => (ref === 'DEEPSEEK_API_KEY' ? { value: 'sk-fake', source: 'test' } : undefined),
}

function makeCtx(getImpl) {
  return {
    get: getImpl,
    on: (n, f) => { (events[n] = events[n] || []).push(f); return () => {} },
    effect: (fn) => { fn(); return () => {} },
    inject: (d, cb) => cb(makeCtx(getImpl)),
    webServer: { register: (s) => { routes[s.path] = s.handler; return () => {} }, tapIndex: () => () => {} },
  }
}

const fails = []
function t(name, fn) { try { fn(); console.log('  ok   ' + name) } catch (e) { fails.push(name); console.log('  FAIL ' + name + ' → ' + e.message) } }

// 用桩 fetch 拦截余额请求，不真的联网（测试要可离线跑）
const realFetch = globalThis.fetch
let sawAuth = null
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('api.deepseek.com')) {
    sawAuth = opt && opt.headers && opt.headers.Authorization
    return { ok: true, json: async () => ({ balance_infos: [{ currency: 'CNY', total_balance: '12.34', granted_balance: '2.00', topped_up_balance: '10.34' }] }) }
  }
  return { ok: false, status: 404, json: async () => ({}) }
}

const mod = await import(pathToFileURL(HOST_ENTRY).href)
mod.default.apply(makeCtx((name) => (name === 'credentials' ? fakeCreds : null)))

const res = { writeHead() {}, end(b) { this._b = b } }
await routes['/dsh-gemini-widget/state']({ method: 'GET', headers: { host: '127.0.0.1:1' }, url: '/dsh-gemini-widget/state' }, res)
const j = JSON.parse(res._b)

t('credentials 通过 ctx.get 解析成功', () => assert.ok(j.balance, 'balance 缺失'))
t('余额 ok', () => assert.equal(j.balance.ok, true, JSON.stringify(j.balance)))
t('余额数值正确', () => assert.equal(j.balance.totalBalance, 12.34))
t('赠金/充值拆分', () => {
  assert.equal(j.balance.bonusBalance, 2)
  assert.equal(j.balance.rechargeBalance, 10.34)
})
t('请求带了 Bearer 头', () => assert.equal(sawAuth, 'Bearer sk-fake'))

globalThis.fetch = realFetch
console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASSED'))
process.exit(fails.length ? 1 : 0)
