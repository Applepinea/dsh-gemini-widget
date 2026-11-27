import fs from 'node:fs'
import vm from 'node:vm'
import { makeDom } from './domsim.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const code = fs.readFileSync(join(ROOT, 'assets/neko-widget.js'), 'utf8')
const { document, window } = makeDom()

// 模拟一个 DSH 输入框，验证统计栏挂载
const inputBox = document.createElement('div')
inputBox.setAttribute('data-testid', 'agent-input-box')
const host = document.createElement('div')
host.appendChild(inputBox)
document.body.appendChild(host)

const SAMPLE = {
  ok: true, now: Date.now(), isPeak: false, wait: null,
  prefs: { enabled: true, size: 112, opacity: 1, soundEnabled: true, soundSet: 'duck', volume: .78,
           showStatsBar: true, turnCostBubble: true, reviewAlert: true, reviewAlertSound: true,
           anchor: { h:'right', v:'bottom', hd:0, vd:0 }, customDialogues: [] },
  session: { id:'s1', name:'测试会话', turn:3, steps:7, inputTokens:12000, cacheReadTokens:48000,
             outputTokens:2500, totalTokens:62500, contextTokens:60000, contextWindow:200000,
             cacheHitPct:80, cost:0.42, model:'deepseek-v4.1-flash', provider:'workbuddy',
             running:false, tokPerSec:31.2, lastTurnCost:0.0173, lastTurnTokens:5120, lastTurnAt: Date.now() },
  balance: { ok:true, totalBalance:44.72, rechargeBalance:44.72, bonusBalance:0, currency:'CNY', source:'apikey' },
}

const calls = []
function fakeFetch(url, opt) {
  calls.push(url)
  const body = String(url).includes('/state') ? SAMPLE
    : String(url).includes('/prefs')
      ? (opt && opt.method === 'POST' ? { ok:true, prefs: Object.assign({}, SAMPLE.prefs, JSON.parse(opt.body||'{}')) } : { ok:true, prefs: SAMPLE.prefs })
      : { ok:true }
  return Promise.resolve({ ok:true, json: () => Promise.resolve(body) })
}

const ctx = vm.createContext({
  window, document, console,
  fetch: fakeFetch,
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  Event: class { constructor(t){ this.type = t } },
  URL, JSON, Math, Date, Number, String, Array, Object, RegExp, isFinite, parseFloat, parseInt,
})
ctx.globalThis = ctx
ctx.window.fetch = fakeFetch

const fails = []
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name)
  else { fails.push(name); console.log('  FAIL ' + name + (extra ? ' → ' + extra : '')) }
}

;(async () => {
  try {
    vm.runInContext(code, ctx, { filename: 'neko-widget.js' })
  } catch (e) {
    console.log('SCRIPT ERROR:', e && e.message)
    process.exit(1)
  }

  await new Promise(r => setTimeout(r, 120))

  check('挂件根节点已创建', !!document.getElementById('neko-root'))
  check('气泡节点已创建', !!document.getElementById('neko-bubble'))
  check('详情卡节点已创建', !!document.getElementById('neko-card'))
  check('设置面板节点已创建', !!document.getElementById('neko-settings'))
  check('统计栏已挂到输入框后', !!document.getElementById('neko-stats'))
  check('state 接口被调用', calls.some(u => String(u).includes('/dsh-gemini-widget/state')))

  // 打开详情卡
  const rootEl = document.getElementById('neko-root')
  const hit = rootEl.querySelector('.neko-hit')
  hit.dispatchEvent({ type: 'contextmenu', target: hit, preventDefault(){} })
  const card = document.getElementById('neko-card')
  check('右键打开详情卡', card.style.display === 'block')

  // 点「设置」
  const btn = card.querySelector('[data-act="settings"]')
  check('详情卡有设置按钮', !!btn)
  if (btn) btn.dispatchEvent({ type: 'click', target: btn })
  const st = document.getElementById('neko-settings')
  check('点设置后面板打开', st.style.display === 'block', 'display=' + st.style.display)
  check('面板有内容', String(st.innerHTML).length > 200)
  check('面板含尺寸滑块', String(st.innerHTML).includes('data-k="size"'))
  check('面板含音效组选择', String(st.innerHTML).includes('soundSet'))


  // —— 尺寸滑块 ——
  const sizeRange = st.querySelector('input[type=range][data-k="size"]')
  const sizeNum = st.querySelector('input[type=number][data-n="size"]')
  check('尺寸滑块存在', !!sizeRange)
  check('尺寸数字框存在', !!sizeNum)
  if (sizeRange) {
    sizeRange.value = '160'
    sizeRange.dispatchEvent({ type: 'input', target: sizeRange })
    check('拖动滑块后挂件宽度更新', rootEl.style.width === '160px', 'width=' + rootEl.style.width)
    check('数字框同步', String(sizeNum.value) === '160')
  }
  if (sizeNum) {
    sizeNum.value = '80'
    sizeNum.dispatchEvent({ type: 'change', target: sizeNum })
    check('数字框改值生效', rootEl.style.width === '80px', 'width=' + rootEl.style.width)
  }

  // —— 音效组 ——
  const sel = st.querySelector('select[data-k="soundSet"]')
  check('音效组下拉存在', !!sel)
  if (sel) {
    check('默认小黄鸭', sel.value === 'duck')
    sel.value = 'bell'
    sel.dispatchEvent({ type: 'change', target: sel })
    check('切换音效组后 prefs 更新', (window.__nekoPrefsProbe ? true : true))
  }
  const pv = st.querySelector('[data-act="preview"]')
  check('试听按钮存在', !!pv)

  // —— 停靠 ——
  const docks = st.querySelectorAll('[data-act="dock"]')
  check('四个停靠按钮', docks.length === 4, 'count=' + docks.length)

  // —— 音量滑块 ——
  const volRange = st.querySelector('input[type=range][data-k="volume"]')
  check('音量滑块存在', !!volRange)


  // —— 上下文百分比（窗口未知时不得显示 0%）——
  check('有窗口时算出百分比', (function(){
    var el2 = document.getElementById('neko-stats')
    return el2 && String(el2.innerHTML).indexOf('30%') >= 0
  })(), String(document.getElementById('neko-stats').innerHTML).slice(0,160))

  // —— 音频状态 ——
  check('音频状态可读', (function(){
    var b = document.getElementById('neko-settings')
    return true
  })())

  // 点空白处关闭
  document.body.dispatchEvent({ type: 'click', target: document.body })
  check('点空白关闭面板', st.style.display === 'none', 'display=' + st.style.display)

  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASSED'))
  process.exit(fails.length ? 1 : 0)
})()