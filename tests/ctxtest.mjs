import fs from 'node:fs'
import vm from 'node:vm'
import { makeDom } from './domsim.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const code = fs.readFileSync(join(ROOT, 'assets/neko-widget.js'), 'utf8')

function run(sample) {
  const { document, window } = makeDom()
  const box = document.createElement('div')
  box.setAttribute('data-testid', 'agent-input-box')
  const host = document.createElement('div'); host.appendChild(box); document.body.appendChild(host)
  const fetchFn = (url) => Promise.resolve({ ok: true, json: () => Promise.resolve(
    String(url).includes('/state') ? sample : { ok: true, prefs: sample.prefs }) })
  const ctx = vm.createContext({ window, document, console, fetch: fetchFn,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (f) => setTimeout(f, 0), Event: class { constructor(t){ this.type = t } },
    URL, JSON, Math, Date, Number, String, Array, Object, RegExp, isFinite, parseFloat, parseInt })
  ctx.globalThis = ctx
  vm.runInContext(code, ctx, { filename: 'w.js' })
  return { document, window }
}

const basePrefs = { enabled:true,size:112,opacity:1,soundEnabled:true,soundSet:'duck',volume:.78,
  showStatsBar:true,turnCostBubble:true,reviewAlert:true,reviewAlertSound:true,
  anchor:{h:'right',v:'bottom',hd:0,vd:0},customDialogues:[] }

let fails = 0
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name)
  else { fails++; console.log('  FAIL ' + name + (extra ? ' → ' + extra : '')) }
}

;(async () => {
  // 场景 A：窗口未知（contextWindow = 0）—— 这是之前的 bug 场景
  const A = {
    ok:true, now:Date.now(), isPeak:false, wait:null, prefs: basePrefs,
    session: { id:'s', name:'t', turn:3, steps:7, inputTokens:664, cacheReadTokens:270976,
               outputTokens:620, totalTokens:272260, contextTokens:271640, contextWindow: 0,
               cacheHitPct:99.8, cost:.02, model:'deepseek-v4.1-flash', provider:'workbuddy',
               running:false, tokPerSec:0, lastTurnCost:null, lastTurnTokens:null, lastTurnAt:null },
    balance: { ok:true, totalBalance:44.72, currency:'CNY', source:'apikey' },
  }
  let dom = run(A)
  await new Promise(r => setTimeout(r, 150))
  let bar = dom.document.getElementById('neko-stats')
  const htmlA = String(bar.innerHTML)
  check('窗口未知时不显示 0%', htmlA.indexOf('上下文 0%') < 0, htmlA.slice(0, 200))
  check('窗口未知时显示绝对 token', htmlA.indexOf('上下文 271.6K') >= 0, htmlA.slice(0, 200))

  // 场景 B：窗口已知
  const B = JSON.parse(JSON.stringify(A))
  B.session.contextWindow = 1000000
  dom = run(B)
  await new Promise(r => setTimeout(r, 150))
  bar = dom.document.getElementById('neko-stats')
  const htmlB = String(bar.innerHTML)
  check('窗口已知时显示百分比', htmlB.indexOf('上下文 27.2%') >= 0, htmlB.slice(0, 200))

  console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASSED'))
  process.exit(fails ? 1 : 0)
})()
