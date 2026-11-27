/**
 * dsh-neko-observer —— host 半
 * ============================================================================
 * 职责：
 *   ① 尽早注册「客户端脚本注入行」（桌面端唯一通道，必须最早，否则永远进不了表）
 *   ② 只读路由：state / widget.js / frame.webp / prefs（含唯一写接口）
 *   ③ 采集：本机会话事件（token / 上下文 / 缓存命中 / 轮次）+ DeepSeek 余额
 *   ④ 事件：提问 / 授权挂起状态（喂「确认提醒」差分）
 *
 * 设计原则（沿用 whale-widget / kitten 的实战教训）：
 *   - 账号服务用 ctx.get() 读，绝不写进 inject（老宿主没有 → 会永远 apply 不了）
 *   - 账本/配置一律原子写（临时文件 + rename），Windows 上重试 EBUSY/EPERM/EACCES
 *   - 损坏文件改名备份后重建，绝不抛错锁死
 *   - 钱用定点整数（×1e8），不用浮点
 * ============================================================================
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = path.resolve(HERE, '..')

const LOG = '[gemini-widget]'
const ROUTE = '/dsh-gemini-widget'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const DATA_DIR = path.join(DSH_HOME, 'gemini-widget')
const PREFS_FILE = path.join(DATA_DIR, 'prefs.json')
const BALANCE_FILE = path.join(DATA_DIR, 'balance-cache.json')

// ── 定价（CNY / 百万 token，[谷价, 峰价]）──────────────────────────────
const PEAK_HOURS = [[9, 12], [14, 18]]
const FLASH = { hit: [0.02, 0.04], miss: [1, 2], out: [4, 8] }
const PRO = { hit: [0.15, 0.3], miss: [4.5, 9.0], out: [13.5, 27.0] }
const PRICING = { 'deepseek-v4-pro': PRO, _default: FLASH }
// 周末全天谷价自 2026-08-23 起
const WEEKEND_VALLEY_FROM = Math.floor(Date.UTC(2026, 7, 22, 16, 0, 0) / 1000)

function isPeak(sec) {
  const n = Number(sec)
  if (!Number.isFinite(n)) return false
  const bj = new Date(n * 1000 + 8 * 3600 * 1000)
  if (n >= WEEKEND_VALLEY_FROM) {
    const dow = bj.getUTCDay()
    if (dow === 0 || dow === 6) return false
  }
  const h = bj.getUTCHours()
  return PEAK_HOURS.some(([a, b]) => h >= a && h < b)
}
function priceFor(model) {
  const m = String(model || '').toLowerCase()
  for (const k of Object.keys(PRICING)) {
    if (k !== '_default' && m.includes(k)) return PRICING[k]
  }
  return PRICING._default
}
/** 一步的金额（CNY）。reasoningTokens ⊆ outputTokens，绝不重复累加。 */
function stepCost(usage, model, atSec) {
  const input = Number(usage && usage.inputTokens) || 0
  const cache = Number(usage && usage.cacheReadTokens) || 0
  const output = Number(usage && usage.outputTokens) || 0
  const p = priceFor(model)
  const k = isPeak(atSec) ? 1 : 0
  return (cache / 1e6) * p.hit[k] + (input / 1e6) * p.miss[k] + (output / 1e6) * p.out[k]
}

// ── 原子写 / 容错读 ────────────────────────────────────────────────────
function ioRetry(fn) {
  for (let i = 0; ; i++) {
    try { return fn() } catch (err) {
      if (i >= 5 || !['EBUSY', 'EPERM', 'EACCES'].includes(err && err.code)) throw err
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * (i + 1))
    }
  }
}
function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(ioRetry(() => fs.readFileSync(file, 'utf8')))
  } catch (err) {
    // 损坏 → 改名备份，用默认值继续，绝不锁死
    try { ioRetry(() => fs.renameSync(file, file + '.corrupt-' + Date.now() + '.bak')) } catch {}
    console.error(LOG + ' 配置文件损坏，已备份重建：' + String(err && err.message).slice(0, 120))
    return fallback
  }
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now()
  ioRetry(() => fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8'))
  ioRetry(() => fs.renameSync(tmp, file))
}

// ── 偏好 ───────────────────────────────────────────────────────────────
const DEFAULT_PREFS = {
  v: 1,
  enabled: true,
  size: 112,
  opacity: 1,
  anchor: { h: 'right', v: 'bottom', hd: 0, vd: 0 },
  soundEnabled: true,
  soundSet: 'duck',
  volume: 0.78,
  turnCostBubble: true,
  reviewAlert: true,
  reviewAlertSound: true,
  showStatsBar: true,
  skin: 'purple',
  customDialogues: [],
}
function loadPrefs() {
  const raw = readJson(PREFS_FILE, null)
  const p = Object.assign({}, DEFAULT_PREFS, raw && typeof raw === 'object' ? raw : {})
  p.size = Math.min(180, Math.max(64, Number(p.size) || 112))
  p.opacity = Math.min(1, Math.max(0.35, Number(p.opacity) || 1))
  p.volume = Math.min(1, Math.max(0, Number.isFinite(Number(p.volume)) ? Number(p.volume) : 0.78))
  p.anchor = Object.assign({ h: 'right', v: 'bottom', hd: 0, vd: 0 }, p.anchor && typeof p.anchor === 'object' ? p.anchor : {})
  if (!['left', 'right'].includes(p.anchor.h)) p.anchor.h = 'right'
  if (!['top', 'bottom'].includes(p.anchor.v)) p.anchor.v = 'bottom'
  if (!Array.isArray(p.customDialogues)) p.customDialogues = []
  if (!['duck', 'bell'].includes(p.soundSet)) p.soundSet = 'duck'
  return p
}
function savePrefs(patch) {
  const cur = loadPrefs()
  const next = Object.assign(cur, patch && typeof patch === 'object' ? patch : {})
  writeJsonAtomic(PREFS_FILE, next)
  return loadPrefs()
}

// ── 余额 ───────────────────────────────────────────────────────────────
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const BALANCE_TTL_MS = 60_000
let balanceCache = { at: 0, payload: null }
let balanceInFlight = null

function pickInfo(infos) {
  if (!Array.isArray(infos) || !infos.length) return null
  const num = (x) => (x && x.total_balance !== undefined ? Number(x.total_balance) : NaN)
  return infos.find((x) => x && x.currency === 'CNY' && num(x) > 0) ||
         infos.find((x) => num(x) > 0) || infos.find((x) => x && x.currency === 'CNY') || infos[0]
}

async function fetchApiKeyBalance(ctx) {
  let cred = null
  for (let i = 0; i < 2; i++) {
    try { cred = await ctx.credentials.resolve('DEEPSEEK_API_KEY'); break } catch (err) {
      if (i === 0) { await new Promise((r) => setTimeout(r, 700)); continue }
      return { ok: false, code: 'NO_KEY', error: '凭据读取失败: ' + String(err && err.message).slice(0, 120) }
    }
  }
  if (!cred) return { ok: false, code: 'NO_KEY', error: '未配置 DEEPSEEK_API_KEY' }
  try {
    const res = await fetch(BALANCE_URL, {
      headers: { Authorization: 'Bearer ' + cred.value },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { ok: false, code: 'HTTP', error: 'HTTP ' + res.status }
    const data = await res.json()
    const info = pickInfo(data && data.balance_infos)
    if (!info || !Number.isFinite(Number(info.total_balance))) {
      return { ok: false, code: 'SHAPE', error: '余额接口返回结构异常' }
    }
    const numOr = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null }
    return {
      ok: true,
      totalBalance: Number(info.total_balance),
      rechargeBalance: numOr(info.topped_up_balance),
      bonusBalance: numOr(info.granted_balance),
      currency: String(info.currency || 'CNY'),
      source: 'apikey',
      updatedAt: new Date().toISOString(),
    }
  } catch (err) {
    return { ok: false, code: 'NET', error: '余额接口请求失败: ' + String(err && err.message).slice(0, 160) }
  }
}

async function fetchAccountBalance(ctx) {
  let account = null
  try { account = typeof ctx.get === 'function' ? ctx.get('deepseekAccount') : null } catch { account = null }
  if (!account || typeof account.getBalance !== 'function') return null
  let result
  try {
    result = await account.getBalance({
      version: String(process.env.DSH_CLIENT_VERSION || process.env.DSH_VERSION || '') || 'unknown',
      locale: String(process.env.DSH_LOCALE || '') || 'zh_CN',
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    })
  } catch { return null }
  if (!result || result.status !== 'ready') return null
  const norm = Array.isArray(result.value) ? result.value : []
  const bonus = Array.isArray(result.bonusWallets) ? result.bonusWallets : []
  const accNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null }
  const usable = (l) => l.filter((w) => w && accNum(w.balance) !== null)
  const normW = usable(norm); const bonusW = usable(bonus)
  const all = normW.concat(bonusW)
  if (!all.length) return null
  const curOf = (w) => String((w && w.currency) || 'CNY').toUpperCase()
  const nz = all.filter((w) => Number(w.balance) > 0)
  const pick = nz.find((w) => curOf(w) === 'CNY') || nz[0] || all.find((w) => curOf(w) === 'CNY') || all[0]
  const cur = curOf(pick)
  const sum = (l) => l.filter((w) => w && curOf(w) === cur && accNum(w.balance) !== null)
    .reduce((s, w) => s + Number(w.balance), 0)
  const recharge = sum(normW); const bn = sum(bonusW)
  return {
    ok: true,
    totalBalance: Number((recharge + bn).toFixed(6)),
    rechargeBalance: Number(recharge.toFixed(6)),
    bonusBalance: Number(bn.toFixed(6)),
    currency: cur,
    source: 'account',
    updatedAt: new Date().toISOString(),
  }
}

async function fetchBalance(ctx, force) {
  const now = Date.now()
  if (!force && balanceCache.payload && now - balanceCache.at < BALANCE_TTL_MS) return balanceCache.payload
  if (balanceInFlight) return balanceInFlight
  balanceInFlight = (async () => {
    const api = await fetchApiKeyBalance(ctx)
    let payload = api
    if (!api.ok) {
      const acc = await fetchAccountBalance(ctx)
      if (acc) payload = acc
      else payload = { ok: false, code: 'NONE', error: api.error + '；账号登录路也不可用' }
    }
    if (payload.ok) { balanceCache = { at: Date.now(), payload }; try { writeJsonAtomic(BALANCE_FILE, payload) } catch {} }
    else if (balanceCache.payload) payload = Object.assign({}, balanceCache.payload, { stale: true, error: payload.error })
    return payload
  })().finally(() => { balanceInFlight = null })
  return balanceInFlight
}

// ── 会话遥测聚合（按 session 分桶）──────────────────────────────────────
/** 每个 session 的实时快照 */
const sessions = new Map()

function ensureSession(id, name, session) {
  let s = sessions.get(id)
  if (!s) {
    s = {
      id,
      name: name || '',
      turn: 0,
      steps: 0,
      inputTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      contextTokens: 0,
      contextWindow: 0,
      model: '',
      provider: '',
      _session: session || null,
      running: false,
      lastTurnCost: null,
      lastTurnTokens: null,
      lastTurnAt: null,
      tokPerSec: 0,
      lastOutTokens: 0,
      lastOutAt: 0,
      updatedAt: Date.now(),
    }
    sessions.set(id, s)
  }
  if (session) s._session = session
  return s
}

function pickName(session) {
  try {
    const cands = [session && session.name, session && session.title, session && session.meta && session.meta.title]
    for (const c of cands) if (c && String(c).trim()) return String(c).trim().slice(0, 120)
  } catch {}
  return ''
}

/** 当前等待用户输入的状态（提问 / 授权）。只保留最新一条。 */
const waitState = { pending: null, sessionName: '' }
const ASK_TOOL = 'ask_user_question'

function eventCallId(event) {
  const d = (event && event.data) || {}
  return String(d.id || d.callId || d.toolCallId || '')
}

export default {
  name: 'gemini-widget',
  apply(root) {
    const rowDisposers = []
    root.effect(() => () => { for (const d of rowDisposers) { try { d() } catch {} } })

    // ① 注入行：必须最早注册（桌面端注入表是启动时一次性收集的）
    rowDisposers.push(root.on('webserver/index-inject', (table) => {
      try {
        if (!Array.isArray(table)) return
        for (const row of table) {
          if (!row) continue
          if (row.kind === 'script' && typeof row.text === 'string' && row.text.includes(ROUTE + '/widget.js')) return
          if (row.kind === 'script-src' && row.src === ROUTE + '/widget.js') return
        }
        // 内联行：自己建 <script src> 并吞掉 onerror —— 路由被注销时静默失败，绝不让宿主起不来
        table.push({
          kind: 'script',
          placement: 'body',
          text: '(function(){try{var d=document.body||document.head||document.documentElement;if(!d)return;' +
                'var s=document.createElement("script");s.src="' + ROUTE + '/widget.js?v=1";' +
                's.onerror=function(){};d.appendChild(s)}catch(e){}})()',
        })
      } catch (err) { console.error(LOG + ' index-inject 行注册失败', err) }
    }))

    // ② 其余：等 webServer / connection 就绪
    root.inject(['webServer', 'connection'], (ctx) => {
      const disposers = []
      ctx.effect(() => () => { for (const d of disposers) { try { d() } catch {} } })

      // —— 信任栅栏 ——
      function crossSite(req) {
        const site = String((req && req.headers && req.headers['sec-fetch-site']) || '').toLowerCase()
        return site === 'cross-site'
      }
      function hostRejection(req) {
        try {
          const conn = ctx.get('connection')
          if (conn && typeof conn.requestRejection === 'function') {
            const code = conn.requestRejection(req)
            if (code === undefined || code === null || code === false) return null
            return typeof code === 'number' ? code : 403
          }
        } catch { return 403 }
        return null
      }
      function isLoopback(req) {
        const a = String((req && req.headers && req.headers.host) || '').toLowerCase()
        const host = a.split(':')[0]
        if (host === 'localhost' || host === '[::1]' || host === '::1') return true
        if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
          return host.split('.').every((seg) => Number(seg) >= 0 && Number(seg) <= 255)
        }
        return false
      }

      // —— 路由注册 ——
      function route(p, handler, opts) {
        const write = Boolean(opts && opts.write)
        const dispose = ctx.webServer.register({
          kind: 'exact',
          path: p,
          handler: async (req, res) => {
            try {
              if (crossSite(req)) { res.writeHead(403); res.end(); return }
              const reject = hostRejection(req)
              if (reject) { res.writeHead(reject); res.end(); return }
              if (write && !isLoopback(req)) { res.writeHead(403); res.end('loopback only'); return }
              await handler(req, res)
            } catch (err) {
              try { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(String(err && err.message || err)) } catch {}
            }
          },
        })
        disposers.push(dispose)
      }
      function json(res, obj, code) {
        const body = JSON.stringify(obj)
        res.writeHead(code || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(body)
      }

      // —— 采集：session/event ——
      disposers.push(ctx.on('session/event', (session, event) => {
        try {
          const sid = (session && session.id) ? String(session.id) : 'default'
          const type = String((event && event.type) || '')
          const d = (event && event.data) || {}
          const at = Number(event && event.time) || Date.now()
          const s = ensureSession(sid, pickName(session), session)

          // 路由容量事件：每条 request/context 带 provider/model/contextWindow，
          // 这是 DSH 记录"这个模型能吃多少"的权威来源，比去问 tokenMeter 更直接。
          if (type === 'request/context') {
            const w = Number(d.contextWindow)
            if (Number.isFinite(w) && w > 0) s.contextWindow = w
            if (d.model) s.model = String(d.model)
            if (d.provider) s.provider = String(d.provider)
            s.updatedAt = Date.now()
            return
          }

          if (type === 'session/title') {
            const ti = String(d.title == null ? '' : d.title).trim()
            if (ti) { s.name = ti.slice(0, 120); if (waitState.pending && waitState.pending.session === sid) waitState.sessionName = s.name }
            return
          }

          if (type === 'turn/start') {
            s.turn = Number(d.turn) || s.turn + 1
            const tok = 0
            s._turnStart = { input: s.inputTokens, cache: s.cacheReadTokens, output: s.outputTokens, total: s.totalTokens, cost: s.cost, tokens: tok }
            s.running = true
            s.updatedAt = Date.now()
            if (waitState.pending) waitState.pending = null
            return
          }

          if (type === 'assistant/message') {
            const usage = d.usage
            if (!usage || typeof usage !== 'object') return
            const input = Number(usage.inputTokens) || 0
            const cache = Number(usage.cacheReadTokens) || 0
            const output = Number(usage.outputTokens) || 0   // 已含 reasoning
            const src = (d.message && d.message.source) || {}
            if (src.model) s.model = String(src.model)
            if (src.provider) s.provider = String(src.provider)
            s.inputTokens += input
            s.cacheReadTokens += cache
            s.outputTokens += output
            s.totalTokens += input + cache + output
            s.steps = Math.max(s.steps, Number(d.step) || 0)
            s.contextTokens = input + cache        // 最近一次请求的 prompt 大小
            s.cost += stepCost(usage, s.model, Math.floor(at / 1000))
            // 吐字速度：按最近一步的输出与耗时粗估
            if (output > 0) {
              if (s.lastOutAt && at > s.lastOutAt) {
                const dt = Math.max(0.5, (at - s.lastOutAt) / 1000)
                if (dt <= 120) s.tokPerSec = Math.round((output / dt) * 10) / 10
              }
              s.lastOutAt = at
              s.lastOutTokens = output
            }
            s.updatedAt = Date.now()
            return
          }

          if (type === 'turn/end') {
            s.running = false
            const st = s._turnStart
            if (st) {
              s.lastTurnCost = s.cost - st.cost
              s.lastTurnTokens = s.totalTokens - st.total
              s.lastTurnAt = Date.now()
              s._turnStart = null
            }
            s.updatedAt = Date.now()
            if (waitState.pending) waitState.pending = null
            return
          }

          // —— 等待用户输入：提问 / 授权 ——
          if (type === 'tool/call' && String(d.name || d.toolName || '') === ASK_TOOL) {
            waitState.pending = { kind: 'question', id: eventCallId(event) || ('q' + Date.now()), ts: Date.now(), session: sid }
            waitState.sessionName = s.name
            return
          }
          if (type === 'tool/result') {
            if (waitState.pending && waitState.pending.kind === 'question') {
              const cid = eventCallId(event)
              if (!cid || cid === waitState.pending.id) waitState.pending = null
            }
            return
          }
          if (type === 'approval/asked') {
            waitState.pending = { kind: 'approval', id: String(d.id || ('a' + Date.now())), ts: Date.now(), session: sid }
            waitState.sessionName = s.name
            return
          }
          if (type.indexOf('approval/') === 0) {
            if (waitState.pending && waitState.pending.kind === 'approval') {
              const id2 = String(d.id || '')
              if (!id2 || id2 === waitState.pending.id) waitState.pending = null
            }
            return
          }
        } catch (err) { /* 单个事件异常绝不影响 agent loop */ }
      }))

      disposers.push(ctx.on('session/disposed', (session) => {
        try { const sid = (session && session.id) ? String(session.id) : ''; if (sid) sessions.delete(sid) } catch {}
      }))

      // —— 上下文窗口容量（可选服务，老宿主没有）——
      // tokenMeter.contextPressure(session) 返回 { pressureTokens?, contextWindow? }，
      // 两个字段都是"有就带、没就缺"，所以要分别判断，不能整体 null 掉。
      const ctxWarned = { tm: false }
      function contextOf(session) {
        if (!session) return null
        let out = null
        try {
          const tm = ctx.get('tokenMeter')
          if (tm && typeof tm.contextPressure === 'function') {
            const p = tm.contextPressure(session)
            if (p && (Number.isFinite(p.pressureTokens) || Number.isFinite(p.contextWindow))) {
              out = { pressure: p.pressureTokens, window: p.contextWindow }
            }
          } else if (!ctxWarned.tm) {
            ctxWarned.tm = true
            console.log(LOG + ' tokenMeter 服务不可用 —— 上下文容量将退回按路由声明推断')
          }
        } catch (err) {
          if (!ctxWarned.tm) { ctxWarned.tm = true; console.error(LOG + ' contextPressure 失败', err) }
        }
        // 兜底：从 llm 路由声明里取 contextWindow（很多宿主没有 tokenMeter 但有模型容量）
        if (!out || !(out.window > 0)) {
          try {
            const w = declaredContextWindow(session)
            if (w > 0) out = Object.assign(out || {}, { window: w })
          } catch {}
        }
        return out
      }

      /** 从会话最近一条 assistant/message 的 source 里读模型，再查路由声明的窗口大小。 */
      function declaredContextWindow(session) {
        let model = ''
        try {
          const s = sessions.get(String(session && session.id))
          if (s && s.model) model = s.model
        } catch {}
        if (!model) return 0
        try {
          const llm = ctx.get('llm')
          if (!llm) return 0
          // 兼容两种形态：routes() 列表 / resolve(route) 对象
          const list = typeof llm.routes === 'function' ? llm.routes() : (Array.isArray(llm.routes) ? llm.routes : [])
          for (const r of list) {
            const m = String((r && (r.model || (r.models && r.models.join(','))) ) || '')
            if (m && m.indexOf(model) !== -1) {
              const w = Number(r.contextWindow || r.maxInputTokens || 0)
              if (w > 0) return w
            }
          }
        } catch {}
        return 0
      }

      // —— 路由 ——
      route(ROUTE + '/state', async (req, res) => {
        const prefs = loadPrefs()
        // 选最近更新的会话作为「当前」；优先 running
        let cur = null
        for (const s of sessions.values()) {
          if (!cur) { cur = s; continue }
          if (s.running && !cur.running) { cur = s; continue }
          if (s.running === cur.running && s.updatedAt > cur.updatedAt) cur = s
        }
        // 上下文窗口容量：每轮现取（tokenMeter 是可选服务，老宿主没有）
        if (cur) {
          const ctxInfo = contextOf(cur._session)
          if (ctxInfo) {
            if (Number.isFinite(ctxInfo.window) && ctxInfo.window > 0) cur.contextWindow = ctxInfo.window
            if (Number.isFinite(ctxInfo.pressure) && ctxInfo.pressure > 0) cur.contextTokens = ctxInfo.pressure
          }
        }
        const bal = await fetchBalance(ctx, false)
        json(res, {
          ok: true,
          now: Date.now(),
          prefs,
          wait: waitState.pending ? { kind: waitState.pending.kind, session: waitState.sessionName || '' } : null,
          session: cur ? {
            id: cur.id, name: cur.name, turn: cur.turn, steps: cur.steps,
            inputTokens: cur.inputTokens, cacheReadTokens: cur.cacheReadTokens, outputTokens: cur.outputTokens,
            totalTokens: cur.totalTokens, contextTokens: cur.contextTokens, contextWindow: cur.contextWindow,
            cacheHitPct: (cur.inputTokens + cur.cacheReadTokens) > 0
              ? Math.round((cur.cacheReadTokens / (cur.inputTokens + cur.cacheReadTokens)) * 1000) / 10 : null,
            cost: Math.round(cur.cost * 1e6) / 1e6,
            model: cur.model, provider: cur.provider,
            running: cur.running, tokPerSec: cur.tokPerSec,
            lastTurnCost: cur.lastTurnCost, lastTurnTokens: cur.lastTurnTokens, lastTurnAt: cur.lastTurnAt,
          } : null,
          balance: bal,
          isPeak: isPeak(Math.floor(Date.now() / 1000)),
        })
      })

      route(ROUTE + '/prefs', async (req, res) => {
        if (req.method === 'GET') { json(res, { ok: true, prefs: loadPrefs() }); return }
        if (req.method !== 'POST' && req.method !== 'PUT') { res.writeHead(405); res.end(); return }
        let body = ''
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > 8192) { res.writeHead(413); res.end(); return }
          body += chunk
        }
        let patch = {}
        try { patch = JSON.parse(body || '{}') } catch { res.writeHead(400); res.end('bad json'); return }
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) { res.writeHead(400); res.end('bad body'); return }
        try { json(res, { ok: true, prefs: savePrefs(patch) }) } catch (err) {
          json(res, { ok: false, error: String(err && err.message || err).slice(0, 200) }, 500)
        }
      }, { write: true })

      route(ROUTE + '/widget.js', async (req, res) => {
        try {
          const file = path.join(PACKAGE_ROOT, 'assets', 'neko-widget.js')
          const buf = fs.readFileSync(file)
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
          })
          res.end(buf)
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('widget.js missing')
        }
      })

      route(ROUTE + '/frame.webp', async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://127.0.0.1')
          const raw = String(url.searchParams.get('name') || 'idle')
          const name = /^[a-z]+$/.test(raw) ? raw : 'idle'
          let file = path.join(PACKAGE_ROOT, 'assets', 'frames', name + '.webp')
          if (!fs.existsSync(file)) file = path.join(PACKAGE_ROOT, 'assets', 'frames', 'idle.webp')
          const buf = fs.readFileSync(file)
          res.writeHead(200, {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=300',
          })
          res.end(buf)
        } catch {
          res.writeHead(404); res.end()
        }
      })

      // web 形态的兜底注入通道（桌面端不走这条）
      try {
        disposers.push(ctx.webServer.tapIndex((html) => {
          if (html.indexOf(ROUTE + '/widget.js') !== -1) return html
          const tag = '<script defer src="' + ROUTE + '/widget.js?v=1"></script>'
          return html.indexOf('</body>') !== -1 ? html.replace('</body>', tag + '</body>') : html + tag
        }))
      } catch (err) { console.error(LOG + ' tapIndex 注册失败', err) }

      console.log(LOG + ' 已加载 · 路由前缀 ' + ROUTE)
    })
  },
}
