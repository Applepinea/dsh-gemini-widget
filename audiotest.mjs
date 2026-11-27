import fs from 'node:fs'
import vm from 'node:vm'
import { makeDom } from './domsim.mjs'

const code = fs.readFileSync('./assets/neko-widget.js', 'utf8')
let fails = 0
function check(n, c, e) { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (e ? ' → ' + e : '')) } }

// 记录所有被创建的振荡器/缓冲区，验证发声路径真的走到了
const stats = { osc: 0, buf: 0, resumes: 0, states: [] }

function makeWin(state) {
  const { document, window } = makeDom()
  window.AudioContext = class {
    constructor() { this.state = state; this.currentTime = 0; this.sampleRate = 48000; this.destination = {} }
    resume() { stats.resumes++; this.state = 'running'; return Promise.resolve() }
    createOscillator() { stats.osc++; return { type:'sine', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, value:0 }, connect(){}, start(){}, stop(){} } }
    createGain() { return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, value:0 }, connect(){} } }
    createBuffer(ch,len){ stats.buf++; return { getChannelData: () => new Float32Array(len) } }
    createBufferSource(){ return { buffer:null, connect(){}, start(){} } }
    createBiquadFilter(){ return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} } }
  }
  return { document, window }
}

const prefs = { enabled:true,size:112,opacity:1,soundEnabled:true,soundSet:'duck',volume:.78,
  showStatsBar:true,turnCostBubble:true,reviewAlert:true,reviewAlertSound:true,
  anchor:{h:'right',v:'bottom',hd:0,vd:0},customDialogues:[] }
const sample = { ok:true, now:Date.now(), isPeak:false, wait:null, prefs,
  session:{ id:'s',name:'t',turn:1,steps:1,inputTokens:1,cacheReadTokens:1,outputTokens:1,
            totalTokens:3,contextTokens:2,contextWindow:0,cacheHitPct:50,cost:0,
            model:'m',provider:'p',running:false,tokPerSec:0,lastTurnCost:null,lastTurnTokens:null,lastTurnAt:null },
  balance:{ ok:true,totalBalance:1,currency:'CNY',source:'apikey' } }

function boot(state) {
  const { document, window } = makeWin(state)
  const box = document.createElement('div')
  box.setAttribute('data-testid','agent-input-box')
  const h = document.createElement('div'); h.appendChild(box); document.body.appendChild(h)
  const fetchFn = (u) => Promise.resolve({ ok:true, json: () => Promise.resolve(
    String(u).includes('/state') ? sample : { ok:true, prefs }) })
  const ctx = vm.createContext({ window, document, console, fetch: fetchFn,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (f) => setTimeout(f,0), Event: class{constructor(t){this.type=t}},
    URL,JSON,Math,Date,Number,String,Array,Object,RegExp,isFinite,parseFloat,parseInt })
  ctx.globalThis = ctx
  vm.runInContext(code, ctx, { filename:'w.js' })
  return { document, window }
}

;(async () => {
  // —— 场景 1：正常 running ——
  stats.osc = 0
  let d = boot('running')
  await new Promise(r => setTimeout(r, 120))
  const hit = d.document.getElementById('neko-root').querySelector('.neko-hit')
  hit.dispatchEvent({ type:'pointerdown', target:hit, button:0, clientX:10, clientY:10, preventDefault(){} })
  check('pointerdown 触发发声', stats.osc > 0, 'osc=' + stats.osc)
  const afterDown = stats.osc
  hit.dispatchEvent({ type:'pointerup', target:hit, clientX:10, clientY:10, preventDefault(){} })
  check('pointerup 再发声', stats.osc > afterDown, 'osc=' + stats.osc)

  // —— 场景 2：初始 suspended（自动播放策略）——
  stats.osc = 0; stats.resumes = 0
  d = boot('suspended')
  await new Promise(r => setTimeout(r, 120))
  const hit2 = d.document.getElementById('neko-root').querySelector('.neko-hit')
  hit2.dispatchEvent({ type:'pointerdown', target:hit2, button:0, clientX:10, clientY:10, preventDefault(){} })
  check('suspended 时仍尝试发声', stats.osc > 0, 'osc=' + stats.osc)
  check('suspended 时调用了 resume', stats.resumes > 0, 'resumes=' + stats.resumes)

  // —— 场景 3：试听按钮 ——
  stats.osc = 0
  d = boot('running')
  await new Promise(r => setTimeout(r, 120))
  const rootEl = d.document.getElementById('neko-root')
  const hit3 = rootEl.querySelector('.neko-hit')
  hit3.dispatchEvent({ type:'contextmenu', target:hit3, preventDefault(){} })
  const card = d.document.getElementById('neko-card')
  card.querySelector('[data-act="settings"]').dispatchEvent({ type:'click', target: card.querySelector('[data-act="settings"]') })
  const st = d.document.getElementById('neko-settings')
  const pv = st.querySelector('[data-act="preview"]')
  check('试听按钮存在', !!pv)
  if (pv) {
    pv.dispatchEvent({ type:'click', target: pv })
    check('试听产生声音', stats.osc > 0, 'osc=' + stats.osc)
  }

  console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASSED'))
  process.exit(fails ? 1 : 0)
})()
