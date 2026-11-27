import fs from 'node:fs'
import vm from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeDom } from './domsim.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const code = fs.readFileSync(join(HERE, '..', 'assets', 'neko-widget.js'), 'utf8')

let fails = 0
const check = (n, c, e) => { if (c) console.log('  ok   ' + n); else { fails++; console.log('  FAIL ' + n + (e ? ' → ' + e : '')) } }
const stats = { osc: 0 }

function boot(state, sampleRef, volume) {
  const { document, window } = makeDom()
  window.AudioContext = class {
    constructor(){ this.state = state; this.currentTime = 0; this.sampleRate = 48000; this.destination = {} }
    resume(){ this.state='running'; return Promise.resolve() }
    createOscillator(){ stats.osc++; return { type:'sine', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, value:0 }, connect(){}, start(){}, stop(){} } }
    createGain(){ return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, value:0 }, connect(){} } }
    createBuffer(c,l){ return { getChannelData: () => new Float32Array(l) } }
    createBufferSource(){ return { buffer:null, connect(){}, start(){} } }
    createBiquadFilter(){ return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} } }
  }
  const box = document.createElement('div')
  box.setAttribute('data-testid','agent-input-box')
  const h = document.createElement('div'); h.appendChild(box); document.body.appendChild(h)
  const fetchFn = (u) => Promise.resolve({ ok:true, json: () => Promise.resolve(
    String(u).includes('/state') ? sampleRef.value : { ok:true, prefs: sampleRef.value.prefs }) })
  const ctx = vm.createContext({ window, document, console, fetch: fetchFn,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (f)=>setTimeout(f,0), Event: class{constructor(t){this.type=t}},
    URL,JSON,Math,Date,Number,String,Array,Object,RegExp,isFinite,parseFloat,parseInt })
  ctx.globalThis = ctx
  vm.runInContext(code, ctx, { filename:'w.js' })
  return { document, window }
}

function prefsWith(over) {
  return Object.assign({ enabled:true,size:112,opacity:1,soundEnabled:true,soundSet:'duck',volume:.78,
    showStatsBar:true,turnCostBubble:true,turnEndSound:true,reviewAlert:true,reviewAlertSound:true,
    anchor:{h:'right',v:'bottom',hd:0,vd:0},customDialogues:[] }, over)
}
const mk = (lastTurnAt, prefs) => ({ ok:true, now:Date.now(), isPeak:false, wait:null, prefs,
  session:{ id:'s',name:'t',turn:2,steps:3,inputTokens:10,cacheReadTokens:10,outputTokens:10,
            totalTokens:30,contextTokens:20,contextWindow:1000,cacheHitPct:50,cost:.01,
            model:'m',provider:'p',running:false,tokPerSec:0,
            lastTurnCost:.005,lastTurnTokens:15,lastTurnAt },
  balance:{ ok:true,totalBalance:1,currency:'CNY',source:'apikey' } })

async function scenario(name, over, expectSound, expectBubble) {
  const prefs = prefsWith(over)
  const ref = { value: mk(1, prefs) }
  stats.osc = 0
  const d = boot('running', ref, over.volume == null ? .78 : over.volume)
  await new Promise(r=>setTimeout(r, 200))
  const before = stats.osc
  ref.value = mk(2, prefs)
  await new Promise(r=>setTimeout(r, 2600))
  const gotSound = stats.osc > before
  const bubble = d.document.getElementById('neko-bubble')
  const gotBubble = String(bubble.innerHTML).indexOf('本轮消耗') >= 0
  console.log('    [' + name + '] 声音=' + gotSound + '(期望' + expectSound + ') 气泡=' + gotBubble + '(期望' + expectBubble + ')')
  check(name + ' → 声音', gotSound === expectSound, '实际=' + gotSound)
  check(name + ' → 气泡', gotBubble === expectBubble, '实际=' + gotBubble)
}

;(async () => {
  await scenario('默认（都开）', {}, true, true)
  await scenario('关掉提示音', { turnEndSound: false }, false, true)
  await scenario('关掉气泡', { turnCostBubble: false }, true, false)
  await scenario('两个都关', { turnEndSound: false, turnCostBubble: false }, false, false)
  await scenario('总音效关闭', { soundEnabled: false }, false, true)

  console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASSED'))
  process.exit(fails ? 1 : 0)
})()
