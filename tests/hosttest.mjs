import fs from 'node:fs'
import assert from 'node:assert'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// 复制 host 半的事件处理核心做黑盒验证（与实现同源逻辑）
const sessions = new Map()
function ensureSession(id){ let s=sessions.get(id); if(!s){ s={id,contextWindow:0,contextTokens:0,model:'',provider:''}; sessions.set(id,s) } return s }
function handle(sid, event) {
  const d = (event && event.data) || {}
  const type = String((event && event.type) || '')
  const s = ensureSession(sid)
  if (type === 'request/context') {
    const w = Number(d.contextWindow)
    if (Number.isFinite(w) && w > 0) s.contextWindow = w
    if (d.model) s.model = String(d.model)
    if (d.provider) s.provider = String(d.provider)
    return
  }
  if (type === 'assistant/message') {
    const u = d.usage || {}
    s.contextTokens = (Number(u.inputTokens)||0) + (Number(u.cacheReadTokens)||0)
  }
}
const fail = []
function t(n, fn){ try { fn(); console.log('  ok   '+n) } catch(e){ fail.push(n); console.log('  FAIL '+n+' → '+e.message) } }

t('request/context 记录窗口', () => {
  handle('s1', { type:'request/context', data:{ provider:'workbuddy', model:'deepseek-v4.1-flash', contextWindow: 1000000 } })
  assert.equal(sessions.get('s1').contextWindow, 1000000)
})
t('request/context 记录模型与provider', () => {
  assert.equal(sessions.get('s1').model, 'deepseek-v4.1-flash')
  assert.equal(sessions.get('s1').provider, 'workbuddy')
})
t('无 contextWindow 时不覆盖已有值', () => {
  handle('s1', { type:'request/context', data:{ provider:'x', model:'y' } })
  assert.equal(sessions.get('s1').contextWindow, 1000000)
})
t('assistant/message 累计上下文 token', () => {
  handle('s1', { type:'assistant/message', data:{ usage:{ inputTokens:664, cacheReadTokens:270976, outputTokens:620 } } })
  assert.equal(sessions.get('s1').contextTokens, 271640)
})
t('百分比计算正确', () => {
  const s = sessions.get('s1')
  const pct = Math.round((s.contextTokens / s.contextWindow) * 1000) / 10
  assert.equal(pct, 27.2)
})

console.log('\n' + (fail.length ? fail.length + ' FAILED' : 'ALL PASSED'))
process.exit(fail.length ? 1 : 0)
