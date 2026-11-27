/* dsh-gemini-widget —— 客户端半（纯 DOM，无 React、无 require） */
(function () {
  'use strict'
  if (window.__DSH_GEMINI_WIDGET__) return
  window.__DSH_GEMINI_WIDGET__ = true

  var ROUTE = '/dsh-gemini-widget'
  var IDS = { style: 'neko-style', root: 'neko-root', stats: 'neko-stats', bubble: 'neko-bubble', card: 'neko-card', settings: 'neko-settings' }
  var STATE = { prefs: null, snap: null, frame: 'idle', clickStage: 0, bubbleTimer: 0, lastWait: null, lastTurnAt: 0 }
  var POLL_MS = 2000

  var DIALOGUES = [
    '好猫猫... ♥',
    'token 自由喵～',
    '今天也要一起写厉害的代码喵！',
    '上下文才占 {ctx}% 呢，本喵还很有精神喵！',
    '本对话已用 {tokens} token 啦，真能聊喵～',
    '缓存命中了 {cache}% 喵，省钱了！',
    '余额还有 ¥{balance} 喵，放心使唤～',
    '不知道主人有什么用…反正本喵很可爱喵！',
    '别戳太用力啦……会变笨的喵 ><'
  ]

  var CSS = [
    '#' + IDS.root + '{position:fixed;z-index:2147483000;user-select:none;-webkit-user-select:none;',
    '  transition:opacity .18s ease;will-change:transform}',
    '#' + IDS.root + ' .neko-img{display:block;width:100%;height:auto;pointer-events:none;',
    '  filter:drop-shadow(0 6px 14px rgba(80,60,140,.28));transition:transform .12s cubic-bezier(.34,1.56,.64,1)}',
    '#' + IDS.root + '.flip .neko-img{transform:scaleX(-1)}',
    '#' + IDS.root + '.pressed .neko-img{transform:scale(.93,.90) translateY(2px)}',
    '#' + IDS.root + '.flip.pressed .neko-img{transform:scaleX(-1) scale(.93,.90) translateY(2px)}',
    '#' + IDS.root + ' .neko-hit{position:absolute;inset:0;cursor:grab}',
    '#' + IDS.root + '.dragging .neko-hit{cursor:grabbing}',

    '#' + IDS.bubble + '{position:fixed;z-index:2147483001;max-width:290px;padding:9px 12px;border-radius:14px;',
    '  background:rgba(38,34,54,.96);color:#ece9f5;font-size:12.5px;line-height:1.62;',
    '  box-shadow:0 8px 28px rgba(0,0,0,.34);border:1px solid rgba(160,140,255,.34);',
    '  backdrop-filter:blur(8px);display:none;word-break:break-word}',
    '#' + IDS.bubble + '.alert{border-color:#f5a524;box-shadow:0 0 0 1px rgba(245,165,36,.5),0 8px 28px rgba(0,0,0,.4);',
    '  background:rgba(56,42,20,.97)}',
    '#' + IDS.bubble + ' .neko-b-row{display:flex;justify-content:space-between;gap:14px;white-space:nowrap}',
    '#' + IDS.bubble + ' .neko-b-k{opacity:.68;font-size:11.5px}',
    '#' + IDS.bubble + ' .neko-b-v{font-weight:700;font-variant-numeric:tabular-nums}',
    '#' + IDS.bubble + ' .neko-b-sep{height:1px;background:rgba(255,255,255,.1);margin:6px 0}',

    '#' + IDS.stats + '{display:flex;align-items:center;justify-content:center;gap:8px;width:fit-content;',
    '  max-width:calc(100% - 12px);margin:0 auto -4px;padding:0 8px;font-size:10.5px;line-height:15px;',
    '  white-space:nowrap;overflow:hidden;color:var(--muted-foreground,#8e929b);user-select:none;',
    '  cursor:pointer;border-radius:999px;transition:background .16s,color .16s}',
    '#' + IDS.stats + ':hover{color:var(--foreground,#e5e7eb);background:rgba(128,128,128,.1)}',
    '#' + IDS.stats + ' .neko-sep{opacity:.4}',
    '#' + IDS.stats + ' .neko-warn{color:#f59e0b;font-weight:600}',

    '#' + IDS.card + '{position:fixed;z-index:2147483002;width:290px;padding:14px 16px;border-radius:16px;',
    '  background:rgba(30,27,44,.97);color:#eae7f4;font-size:12.5px;line-height:1.7;display:none;',
    '  box-shadow:0 16px 48px rgba(0,0,0,.45);border:1px solid rgba(160,140,255,.3);backdrop-filter:blur(10px)}',
    '#' + IDS.card + ' h4{margin:0 0 10px;font-size:13px;font-weight:700;color:#c9b8ff}',
    '#' + IDS.card + ' .neko-kv{display:flex;justify-content:space-between;gap:12px;padding:2px 0}',
    '#' + IDS.card + ' .neko-kv span:first-child{opacity:.66}',
    '#' + IDS.card + ' .neko-kv span:last-child{font-variant-numeric:tabular-nums;font-weight:600}',
    '#' + IDS.card + ' .neko-tools{display:flex;gap:8px;margin-top:12px}',
    '#' + IDS.card + ' button{flex:1;padding:6px 0;border-radius:9px;border:1px solid rgba(160,140,255,.34);',
    '  background:rgba(120,100,200,.22);color:#ddd6ff;font-size:11.5px;cursor:pointer}',
    '#' + IDS.card + ' button:hover{background:rgba(120,100,200,.36)}',

    // —— 设置面板 ——
    '#' + IDS.settings + '{position:fixed;z-index:2147483003;width:296px;max-height:78vh;overflow-y:auto;',
    '  padding:14px 16px;border-radius:16px;background:rgba(28,25,42,.98);color:#eae7f4;font-size:12.5px;',
    '  display:none;box-shadow:0 18px 52px rgba(0,0,0,.5);border:1px solid rgba(160,140,255,.32);',
    '  backdrop-filter:blur(12px)}',
    '#' + IDS.settings + ' h4{margin:0 0 4px;font-size:13px;font-weight:700;color:#c9b8ff}',
    '#' + IDS.settings + ' .neko-sect{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.09)}',
    '#' + IDS.settings + ' .neko-sect:first-of-type{margin-top:10px;padding-top:0;border-top:0}',
    '#' + IDS.settings + ' .neko-lab{display:flex;justify-content:space-between;align-items:center;',
    '  font-size:11.5px;opacity:.72;margin-bottom:5px}',
    '#' + IDS.settings + ' .neko-row{display:flex;align-items:center;gap:8px;margin:5px 0}',
    '#' + IDS.settings + ' input[type=range]{flex:1;accent-color:#8b74e8;height:16px}',
    '#' + IDS.settings + ' input[type=number]{width:56px;flex:0 0 auto;padding:3px 5px;border-radius:7px;',
    '  border:1px solid rgba(160,140,255,.34);background:rgba(0,0,0,.28);color:#eae7f4;font-size:11.5px;',
    '  font-variant-numeric:tabular-nums}',
    '#' + IDS.settings + ' select{flex:1;padding:4px 6px;border-radius:7px;border:1px solid rgba(160,140,255,.34);',
    '  background:rgba(0,0,0,.28);color:#eae7f4;font-size:11.5px;cursor:pointer}',
    '#' + IDS.settings + ' .neko-chk{display:flex;align-items:center;gap:7px;margin:6px 0;cursor:pointer;',
    '  font-size:11.5px;opacity:.9}',
    '#' + IDS.settings + ' .neko-chk input{accent-color:#8b74e8;margin:0;cursor:pointer}',
    '#' + IDS.settings + ' .neko-foot{display:flex;gap:8px;margin-top:16px}',
    '#' + IDS.settings + ' button{flex:1;padding:7px 0;border-radius:9px;border:1px solid rgba(160,140,255,.34);',
    '  background:rgba(120,100,200,.22);color:#ddd6ff;font-size:11.5px;cursor:pointer}',
    '#' + IDS.settings + ' button:hover{background:rgba(120,100,200,.38)}',
    '#' + IDS.settings + ' button.primary{background:rgba(139,116,232,.5);color:#fff}'
  ].join('\n')

  function el(tag, cls, text) {
    var d = document.createElement(tag)
    if (cls) d.className = cls
    if (text != null) d.textContent = text
    return d
  }
  function fmt(n) {
    var v = Number(n) || 0
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
    return String(Math.round(v))
  }
  function fmtMoney(n) {
    var v = Number(n) || 0
    if (v === 0) return '0.00'
    if (v < 0.01) return v.toFixed(4)
    return v.toFixed(2)
  }

  // ── 音效引擎 ────────────────────────────────────────────────────────
  // 两套预设，全部 WebAudio 现场合成，零音频资源：
  //   duck「小黄鸭」：按压"嘎"（下滑方波）+ 松开"啾"（上滑正弦），双段式
  //   bell「叮咚」  ：按压叮 + 松开咚
  //
  // ⚠️ 关键坑（这就是"音频有时放不出来"的根因）：
  //   浏览器的 autoplay policy 要求 AudioContext 必须在**用户手势的同一个调用栈里**创建/恢复。
  //   旧实现在"轮询回调"里才第一次 new AudioContext（回合结束音、确认提醒），
  //   那是异步上下文，没有用户激活 → 创建出来就是 suspended，resume() 也是异步的，
  //   于是音被排进了 suspended 的时钟里，永远不响。
  //   修法：① 在 document 的首次 pointerdown/keydown 里同步预热（unlock）；
  //        ② 每次发声前检查 state，suspended 就先 resume 再排期（不等它完成）；
  //        ③ 全程 try/catch，音频挂了绝不影响挂件本身。
  var audioCtx = null
  var audioUnlocked = false
  var soundDiag = { lastError: '', failures: 0 }

  function audioCtor() {
    return window.AudioContext || window.webkitAudioContext || null
  }

  /** 在用户手势里同步创建并解锁上下文。返回是否可用。 */
  function unlockAudio() {
    try {
      var Ctor = audioCtor()
      if (!Ctor) return false
      if (!audioCtx) audioCtx = new Ctor()
      if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
        var p = audioCtx.resume()
        if (p && typeof p.catch === 'function') p.catch(function () {})
      }
      // 播一个 0 增益的极短音：某些浏览器要真的排过声音才会把状态推到 running
      try {
        var o = audioCtx.createOscillator()
        var g = audioCtx.createGain()
        g.gain.value = 0
        o.connect(g); g.connect(audioCtx.destination)
        o.start(); o.stop(audioCtx.currentTime + 0.001)
      } catch (e) {}
      audioUnlocked = audioCtx.state === 'running'
      return true
    } catch (err) {
      soundDiag.lastError = String((err && err.message) || err).slice(0, 120)
      soundDiag.failures++
      return false
    }
  }

  function ac() {
    if (!audioCtx) {
      var Ctor = audioCtor()
      if (!Ctor) throw new Error('no AudioContext')
      audioCtx = new Ctor()
    }
    // 每次发声都尝试拉起（不 await：手势外的恢复可能失败，但排期照样进行）
    if (audioCtx.state === 'suspended') {
      try {
        var p = audioCtx.resume()
        if (p && typeof p.catch === 'function') p.catch(function () {})
      } catch (e) {}
    }
    return audioCtx
  }

  function tone(opt) {
    var c = ac()
    if (!c || c.state === 'closed') return null
    var now = c.currentTime
    var t0 = now + (opt.at || 0)
    var o = c.createOscillator()
    var g = c.createGain()
    o.type = opt.type || 'sine'
    o.frequency.setValueAtTime(opt.from, t0)
    if (opt.to && opt.to !== opt.from) {
      o.frequency.exponentialRampToValueAtTime(opt.to, t0 + (opt.glide || opt.dur))
    }
    var peak = Math.max(0.0002, opt.vol)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.014, opt.dur * 0.3))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur)
    o.connect(g); g.connect(c.destination)
    o.start(t0); o.stop(t0 + opt.dur + 0.03)
    return { osc: o, at: t0 }
  }

  /** 包一层：记录失败原因，避免"没声音但毫无线索"。 */
  function safePlay(fn) {
    try {
      var r = fn()
      soundDiag.lastError = ''
      return r
    } catch (err) {
      soundDiag.lastError = String((err && err.message) || err).slice(0, 120)
      soundDiag.failures++
      return null
    }
  }

  // 「小黄鸭」按压：短促下滑 + 一点噪声感的方波，像捏了一下
  function duckPress(vol) {
    var c = ac()
    tone({ type: 'square', from: 620, to: 300, dur: 0.075, vol: vol * 0.11, glide: 0.06 })
    tone({ type: 'sine', from: 1240, to: 620, dur: 0.06, vol: vol * 0.07 })
    // 极短噪声爆点，模拟橡皮摩擦
    try {
      var len = Math.floor(c.sampleRate * 0.03)
      var buf = c.createBuffer(1, len, c.sampleRate)
      var d = buf.getChannelData(0)
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.5
      var src = c.createBufferSource(); src.buffer = buf
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.value = 1400; bp.Q.value = 1.6
      var ng = c.createGain(); ng.gain.value = vol * 0.09
      src.connect(bp); bp.connect(ng); ng.connect(c.destination)
      src.start()
    } catch (e) {}
  }
  // 「小黄鸭」松开：轻快上滑"啾"
  function duckRelease(vol) {
    tone({ type: 'sine', from: 520, to: 1180, dur: 0.13, vol: vol * 0.1, glide: 0.1 })
    tone({ type: 'triangle', from: 780, to: 1560, dur: 0.09, vol: vol * 0.05, glide: 0.07 })
  }
  function bellPress(vol) {
    tone({ type: 'sine', from: 880, dur: 0.09, vol: vol * 0.16 })
  }
  function bellRelease(vol) {
    tone({ type: 'sine', from: 1318, dur: 0.14, vol: vol * 0.14 })
  }

  var SOUND_SETS = { duck: { press: duckPress, release: duckRelease }, bell: { press: bellPress, release: bellRelease } }

  function soundVol() {
    var p = STATE.prefs || {}
    if (p.soundEnabled === false) return 0
    var v = Number(p.volume)
    return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.78
  }

  /** 按压（双段式第 1 段） */
  function pressSound() {
    var vol = soundVol()
    if (vol <= 0) return
    var set = SOUND_SETS[(STATE.prefs || {}).soundSet] || SOUND_SETS.duck
    safePlay(function () { return set.press(vol) })
  }
  /** 松开（双段式第 2 段） */
  function releaseSound() {
    var vol = soundVol()
    if (vol <= 0) return
    var set = SOUND_SETS[(STATE.prefs || {}).soundSet] || SOUND_SETS.duck
    safePlay(function () { return set.release(vol) })
  }

  /** 一次性提示音（提醒 / 回合结束），与按压音效解耦 */
  function beep(kind) {
    try {
      var p = STATE.prefs || {}
      if (p.soundEnabled === false) return
      if (kind === 'alert' && p.reviewAlertSound === false) return
      if (kind === 'done' && p.turnEndSound === false) return
      var vol = soundVol()
      if (vol <= 0) return
      if (kind === 'alert') {
        tone({ type: 'sine', from: 880, dur: 0.12, vol: vol * 0.17 })
        tone({ type: 'sine', from: 1174, at: 0.13, dur: 0.18, vol: vol * 0.15 })
      } else if (kind === 'done') {
        tone({ type: 'sine', from: 880, dur: 0.09, vol: vol * 0.14 })
        tone({ type: 'sine', from: 1318, at: 0.09, dur: 0.14, vol: vol * 0.13 })
      }
    } catch (e) { /* 音效失败绝不影响挂件 */ }
  }

  /** 试听（设置面板里用）：完整走一遍按压+松开。点击本身就是手势，顺带解锁上下文。 */
  function previewSound(setKey) {
    unlockAudio()
    var vol = soundVol()
    if (vol <= 0) vol = 0.78
    var set = SOUND_SETS[setKey] || SOUND_SETS.duck
    safePlay(function () { return set.press(vol) })
    setTimeout(function () { safePlay(function () { return set.release(vol) }) }, 90)
  }

  /** 音频状态摘要，给设置面板显示（"没声音"时能自己看出来是哪一步的问题）。 */
  function audioStatusText() {
    if (!audioCtor()) return '浏览器不支持 Web Audio'
    if (!audioCtx) return '尚未激活（点一下页面即可）'
    if (audioCtx.state === 'running') return '正常'
    if (audioCtx.state === 'suspended') return '被浏览器挂起（点一下页面）'
    return String(audioCtx.state)
  }

  // ── 构建 DOM ──
  function build() {
    if (document.getElementById(IDS.root)) return true

    var style = document.createElement('style')
    style.id = IDS.style
    style.textContent = CSS
    document.head.appendChild(style)

    var rootEl = el('div')
    rootEl.id = IDS.root
    var img = el('img', 'neko-img')
    img.src = ROUTE + '/frame.webp?name=idle'
    img.alt = ''
    img.draggable = false
    var hit = el('div', 'neko-hit')
    rootEl.appendChild(img); rootEl.appendChild(hit)
    document.body.appendChild(rootEl)

    var bubble = el('div')
    bubble.id = IDS.bubble
    document.body.appendChild(bubble)

    var card = el('div')
    card.id = IDS.card
    document.body.appendChild(card)

    var settings = el('div')
    settings.id = IDS.settings
    document.body.appendChild(settings)

    return true
  }

  // ── 位置 ──
  function applyAnchor() {
    var rootEl = document.getElementById(IDS.root)
    if (!rootEl) return
    var p = STATE.prefs || {}
    var size = Number(p.size) || 112
    var a = p.anchor || { h: 'right', v: 'bottom', hd: 0, vd: 0 }
    rootEl.style.width = size + 'px'
    rootEl.style.opacity = String(p.opacity == null ? 1 : p.opacity)
    if (a.h === 'right') { rootEl.style.right = (Number(a.hd) || 0) + 'px'; rootEl.style.left = 'auto' }
    else { rootEl.style.left = (Number(a.hd) || 0) + 'px'; rootEl.style.right = 'auto' }
    if (a.v === 'bottom') { rootEl.style.bottom = (Number(a.vd) || 0) + 'px'; rootEl.style.top = 'auto' }
    else { rootEl.style.top = (Number(a.vd) || 0) + 'px'; rootEl.style.bottom = 'auto' }
    rootEl.classList.toggle('flip', a.h === 'left')
  }

  /** 改尺寸：以"贴边的那个角"为定点，变大时向上/向内长，不会跳位。 */
  function setSize(px) {
    var rootEl = document.getElementById(IDS.root)
    var next = Math.round(Math.min(180, Math.max(64, Number(px) || 112)))
    var p = STATE.prefs || {}
    if (!rootEl) { postPrefs({ size: next }); return }
    // 定点 = 吸附的那个角：CSS 用的是 left/right + top/bottom，
    // 宽度一变，右锚自然向左长、左锚向右长、底锚向上长 —— 角本身不动，无需补偿。
    STATE.prefs = Object.assign({}, p, { size: next })
    rootEl.style.width = next + 'px'
    var bar = document.getElementById(IDS.stats)
    if (bar) renderStatsBar(bar)
    postPrefs({ size: next })
  }
  function postPrefs(patch) {
    return fetch(ROUTE + '/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(function (r) { return r.json() }).then(function (j) {
      if (j && j.ok) { STATE.prefs = j.prefs; applyAnchor() }
      return j
    }).catch(function () {})
  }

  // ── 拖拽 + 吸附 ──
  function bindDrag() {
    var rootEl = document.getElementById(IDS.root)
    var hit = rootEl.querySelector('.neko-hit')
    var drag = null
    hit.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return
      pressSound()
      drag = { sx: e.clientX, sy: e.clientY, moved: false, t: Date.now() }
      var r = rootEl.getBoundingClientRect()
      drag.x0 = r.left; drag.y0 = r.top
      rootEl.classList.add('dragging', 'pressed')
      try { hit.setPointerCapture(e.pointerId) } catch (err) {}
      e.preventDefault()
    })
    hit.addEventListener('pointermove', function (e) {
      if (!drag) return
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
      if (!drag.moved) return
      var nx = drag.x0 + dx, ny = drag.y0 + dy
      rootEl.style.left = nx + 'px'; rootEl.style.top = ny + 'px'
      rootEl.style.right = 'auto'; rootEl.style.bottom = 'auto'
    })
    function endDrag(e) {
      if (!drag) return
      var moved = drag.moved
      var dur = Date.now() - drag.t
      rootEl.classList.remove('dragging', 'pressed')
      try { hit.releasePointerCapture(e.pointerId) } catch (err) {}
      drag = null
      releaseSound()
      if (!moved) { onPoke(); return }
      // 吸附到最近边
      var r = rootEl.getBoundingClientRect()
      var vw = window.innerWidth, vh = window.innerHeight
      var zone = Math.min(vw, vh) * 0.12
      var leftDist = r.left, rightDist = vw - (r.left + r.width)
      var topDist = r.top, bottomDist = vh - (r.top + r.height)
      var a = { h: rightDist <= leftDist ? 'right' : 'left', v: bottomDist <= topDist ? 'bottom' : 'top', hd: 0, vd: 0 }
      if (rightDist <= zone || leftDist <= zone) a.hd = Math.max(0, Math.round(a.h === 'right' ? rightDist : leftDist))
      else a.hd = Math.max(0, Math.round(a.h === 'right' ? rightDist : leftDist))
      a.vd = Math.max(0, Math.round(a.v === 'bottom' ? bottomDist : topDist))
      saveAnchor(a)
    }
    hit.addEventListener('pointerup', endDrag)
    hit.addEventListener('pointercancel', function (e) { if (drag) { rootEl.classList.remove('dragging', 'pressed'); drag = null } })
    hit.addEventListener('contextmenu', function (e) { e.preventDefault(); showCard() })
    hit.addEventListener('click', function (e) { e.preventDefault() })
  }

  // ── 表情切换 ──
  function setFrame(name) {
    if (STATE.frame === name) return
    STATE.frame = name
    var img = document.querySelector('#' + IDS.root + ' .neko-img')
    if (!img) return
    img.src = ROUTE + '/frame.webp?name=' + name
  }

  function computeFrame() {
    var s = STATE.snap
    if (!s) return 'idle'
    if (s.wait) return 'wait'
    if (s.session && s.session.running) return 'eat'
    return 'idle'
  }

  // ── 气泡 ──
  function hideBubble() {
    var b = document.getElementById(IDS.bubble)
    if (b) { b.style.display = 'none'; b.classList.remove('alert') }
    if (STATE.bubbleTimer) { clearTimeout(STATE.bubbleTimer); STATE.bubbleTimer = 0 }
  }
  function positionBubble(bubble) {
    var rootEl = document.getElementById(IDS.root)
    if (!rootEl || !bubble) return
    var r = rootEl.getBoundingClientRect()
    bubble.style.display = 'block'
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight
    var vw = window.innerWidth, vh = window.innerHeight
    var left = r.left + r.width / 2 - bw / 2
    left = Math.max(8, Math.min(vw - bw - 8, left))
    var top = r.top - bh - 10
    if (top < 8) top = Math.min(vh - bh - 8, r.top + r.height + 10)
    bubble.style.left = Math.round(left) + 'px'
    bubble.style.top = Math.round(top) + 'px'
  }
  function showBubble(html, opts) {
    var bubble = document.getElementById(IDS.bubble)
    if (!bubble) return
    bubble.innerHTML = html
    bubble.classList.toggle('alert', Boolean(opts && opts.alert))
    positionBubble(bubble)
    if (STATE.bubbleTimer) clearTimeout(STATE.bubbleTimer)
    var ms = (opts && opts.ms) || 0
    if (ms > 0) STATE.bubbleTimer = setTimeout(hideBubble, ms)
  }

  function rows(pairs) {
    return pairs.map(function (p) {
      var d = el('div', 'neko-b-row')
      d.appendChild(el('span', 'neko-b-k', p[0]))
      d.appendChild(el('span', 'neko-b-v', p[1]))
      return d.outerHTML
    }).join('')
  }

  /** 上下文占比：窗口未知时返回 null，绝不显示成 0% */
  function ctxPctOf(sess) {
    var win = Number(sess && sess.contextWindow)
    var used = Number(sess && sess.contextTokens)
    if (!isFinite(win) || win <= 0 || !isFinite(used) || used <= 0) return null
    var pct = (used / win) * 100
    return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10
  }

  /** 还没有任何会话事件时（刚打开页面），返回一个占位说明而不是一排 0。 */
  function noSessionHint() {
    return '<div style="opacity:.72;font-size:12px;line-height:1.6">还没有对话数据喵～<br>开始一轮对话后本喵就能记账了。</div>'
  }

  function statsBubbleHtml() {
    var s = STATE.snap || {}
    var sess = s.session
    var bal = s.balance || {}
    if (!sess) {
      var h0 = noSessionHint()
      if (bal && bal.ok) h0 += '<div class="neko-b-sep"></div>' + rows([['余额', '¥' + fmtMoney(bal.totalBalance)]])
      return h0
    }
    var ctxPct = ctxPctOf(sess)
    var pairs = []
    var usedCtx = Number(sess.contextTokens) || 0
    pairs.push(['上下文', ctxPct != null ? ctxPct + '% · ' + fmt(usedCtx)
      : (usedCtx > 0 ? fmt(usedCtx) : '—')])
    pairs.push(['本轮 Token', fmt(sess.totalTokens || 0)])
    pairs.push(['缓存命中', (sess.cacheHitPct == null ? '—' : sess.cacheHitPct + '%')])
    if (bal && bal.ok) {
      pairs.push(['余额', '¥' + fmtMoney(bal.totalBalance) + (s.isPeak ? ' · 峰价' : ' · 谷价')])
    } else {
      // 把失败原因塞进 title，悬停能看到（气泡里放长文会撑爆布局）
      var why = (bal && bal.code === 'NO_CRED_SVC') ? '无凭据服务'
        : (bal && bal.code === 'NO_KEY') ? '未配置 key'
        : (bal && bal.code === 'NONE') ? '网络/凭据均失败'
        : '不可用'
      pairs.push(['余额', '— <span style="font-size:10px;opacity:.55">' + why + '</span>'])
    }
    return rows(pairs)
  }
  function costBubbleHtml() {
    var s = STATE.snap || {}
    var sess = s.session || {}
    var bal = s.balance || {}
    var html = ''
    if (sess.lastTurnCost != null) {
      html += rows([['本轮消耗', '¥' + fmtMoney(sess.lastTurnCost)], ['本轮新增', fmt(sess.lastTurnTokens || 0) + ' tok']])
    } else {
      html += rows([['本轮新增', fmt(sess.totalTokens || 0) + ' tok']])
    }
    if (bal && bal.ok) html += '<div class="neko-b-sep"></div>' + rows([['剩余余额', '¥' + fmtMoney(bal.totalBalance)]])
    return html
  }

  function showTurnCost() {
    var p = STATE.prefs || {}
    if (p.turnCostBubble === false) return
    showBubble(costBubbleHtml(), { ms: 10000 })
  }

  function pickDialogue() {
    var p = STATE.prefs || {}
    var list = DIALOGUES.slice()
    if (Array.isArray(p.customDialogues)) {
      p.customDialogues.forEach(function (x) { if (x && String(x).trim()) list.push(String(x)) })
    }
    var s = STATE.snap || {}
    var sess = s.session || {}
    var bal = s.balance || {}
    var cp = ctxPctOf(sess)
    var ctxPct = cp == null ? 0 : Math.round(cp)
    var line = list[Math.floor(Math.random() * list.length)]
    return line
      .replace('{ctx}', String(ctxPct))
      .replace('{tokens}', fmt(sess.totalTokens || 0))
      .replace('{cache}', String(sess.cacheHitPct == null ? '—' : sess.cacheHitPct))
      .replace('{balance}', bal && bal.ok ? fmtMoney(bal.totalBalance) : '—')
  }

  // ── 交互：戳一下（三段式）──
  var patCount = 0
  function onPoke() {
    var rootEl = document.getElementById(IDS.root)
    if (rootEl) {
      rootEl.classList.add('pressed')
      setTimeout(function () { rootEl.classList.remove('pressed') }, 130)
    }
    setFrame('xd')
    setTimeout(function () { setFrame(computeFrame()) }, 420)

    patCount++
    if (patCount >= 3) { patCount = 0; setFrame('grin'); setTimeout(function () { setFrame(computeFrame()) }, 700) }

    STATE.clickStage = (STATE.clickStage + 1) % 4
    if (STATE.clickStage === 1) showBubble(statsBubbleHtml(), { ms: 0 })
    else if (STATE.clickStage === 2) showBubble(pickDialogue(), { ms: 0 })
    else { STATE.clickStage = 0; hideBubble() }
  }

  // ── 详情卡（右键）──
  function showCard() {
    var card = document.getElementById(IDS.card)
    var rootEl = document.getElementById(IDS.root)
    if (!card || !rootEl) return
    var s = STATE.snap || {}
    var sess = s.session || {}
    var bal = s.balance || {}
    var ctxPct = ctxPctOf(sess)
    var h = '<h4>Gemini娘详情</h4>'
    function kv(k, v) { return '<div class="neko-kv"><span>' + k + '</span><span>' + v + '</span></div>' }
    h += kv('会话', sess.name ? String(sess.name).slice(0, 16) : '—')
    h += kv('模型', sess.model || '—')
    h += kv('轮次 / 步数', (sess.turn || 0) + ' / ' + (sess.steps || 0))
    var winN = Number(sess.contextWindow) || 0
    h += kv('上下文', ctxPct == null
      ? fmt(sess.contextTokens || 0) + (winN > 0 ? ' / ' + fmt(winN) : '')
      : ctxPct + '% (' + fmt(sess.contextTokens || 0) + '/' + fmt(winN) + ')')
    h += kv('累计 Token', fmt(sess.totalTokens || 0))
    h += kv('缓存命中', sess.cacheHitPct == null ? '—' : sess.cacheHitPct + '%')
    h += kv('本会话花费', '¥' + fmtMoney(sess.cost || 0))
    h += kv('余额', bal && bal.ok
      ? '¥' + fmtMoney(bal.totalBalance) + (bal.source === 'account' ? '（账号）' : '（API key）')
      : '<span style="opacity:.6" title="' + String((bal && bal.error) || '').replace(/"/g, '&quot;') + '">—</span>')
    h += kv('峰谷', s.isPeak ? '高峰时段' : '空闲时段')
    h += '<div class="neko-tools"><button data-act="refresh">刷新</button><button data-act="settings">设置</button><button data-act="close">关闭</button></div>'
    card.innerHTML = h
    var r = rootEl.getBoundingClientRect()
    card.style.display = 'block'
    var cw = card.offsetWidth, ch = card.offsetHeight
    var vw = window.innerWidth, vh = window.innerHeight
    var left = Math.min(vw - cw - 8, Math.max(8, r.left + r.width / 2 - cw / 2))
    var top = r.top - ch - 10
    if (top < 8) top = Math.min(vh - ch - 8, r.top + r.height + 10)
    card.style.left = Math.round(left) + 'px'
    card.style.top = Math.round(top) + 'px'
    card.querySelector('[data-act="refresh"]').onclick = function () { poll(true) }
    card.querySelector('[data-act="settings"]').onclick = function () { showSettings() }
    card.querySelector('[data-act="close"]').onclick = function () { card.style.display = 'none' }
  }

  // ── 输入框下方统计栏 ──
  function mountStatsBar() {
    var p = STATE.prefs || {}
    var existing = document.getElementById(IDS.stats)
    if (p.showStatsBar === false) { if (existing) existing.remove(); return }
    var box = document.querySelector('[data-testid="agent-input-box"]')
    if (!box) return
    var host = box.parentElement
    if (!host) return
    if (existing && existing.parentElement === host) { renderStatsBar(existing); return }
    if (existing) existing.remove()
    var bar = el('div')
    bar.id = IDS.stats
    bar.addEventListener('click', function () { onPoke() })
    host.insertBefore(bar, box.nextSibling)
    renderStatsBar(bar)
  }
  function renderStatsBar(bar) {
    var s = STATE.snap || {}
    var sess = s.session
    var bal = s.balance || {}
    if (!sess) {
      var b0 = '<span style="opacity:.6">等待对话喵～</span>'
      if (bal && bal.ok) b0 += '<span class="neko-sep">·</span><span>¥' + fmtMoney(bal.totalBalance) + '</span>'
      bar.innerHTML = b0
      return
    }
    var ctxPct = ctxPctOf(sess)
    var parts = []
    parts.push((sess.turn || 0) + '轮 · ' + (sess.steps || 0) + '步')
    if (sess.tokPerSec > 0) parts.push(sess.tokPerSec + ' tok/s')
    parts.push(fmt(sess.totalTokens || 0) + ' tok')
    if (sess.cacheHitPct != null) parts.push('缓存 ' + sess.cacheHitPct + '%')
    if (ctxPct != null) parts.push('上下文 ' + ctxPct + '%')
    else if (Number(sess.contextTokens) > 0) parts.push('上下文 ' + fmt(sess.contextTokens))
    if (bal && bal.ok) parts.push('¥' + fmtMoney(bal.totalBalance))
    bar.innerHTML = parts.map(function (x, i) {
      return (i ? '<span class="neko-sep">·</span>' : '') + '<span>' + x + '</span>'
    }).join('')
  }

  // ── 设置面板 ────────────────────────────────────────────────────────
  function showSettings() {
    var card = document.getElementById(IDS.card)
    if (card) card.style.display = 'none'
    var box = document.getElementById(IDS.settings)
    var rootEl = document.getElementById(IDS.root)
    if (!box || !rootEl) return
    var p = STATE.prefs || {}
    var size = Number(p.size) || 112
    var op = p.opacity == null ? 1 : Number(p.opacity)
    var vol = Number(p.volume)
    if (!isFinite(vol)) vol = 0.78

    var h = '<h4>⚙️ Gemini娘设置</h4>'

    h += '<div class="neko-sect">'
    h += '<div class="neko-lab"><span>📏 挂件大小</span><span data-out="size">' + size + 'px</span></div>'
    h += '<div class="neko-row"><input type="range" data-k="size" min="64" max="180" step="4" value="' + size + '">'
    h += '<input type="number" data-n="size" min="64" max="180" step="4" value="' + size + '"></div>'
    h += '<div class="neko-lab"><span>👁 透明度</span><span data-out="opacity">' + Math.round(op * 100) + '%</span></div>'
    h += '<div class="neko-row"><input type="range" data-k="opacity" min="35" max="100" step="5" value="' + Math.round(op * 100) + '">'
    h += '<input type="number" data-n="opacity" min="35" max="100" step="5" value="' + Math.round(op * 100) + '"></div>'
    h += '</div>'

    h += '<div class="neko-sect">'
    h += '<div class="neko-lab"><span>🔊 音效组</span></div>'
    h += '<div class="neko-row"><select data-k="soundSet">'
    h += '<option value="duck"' + (p.soundSet === 'duck' || !p.soundSet ? ' selected' : '') + '>小黄鸭</option>'
    h += '<option value="bell"' + (p.soundSet === 'bell' ? ' selected' : '') + '>叮咚</option>'
    h += '</select><button data-act="preview" style="flex:0 0 62px">试听</button></div>'
    h += '<div class="neko-lab"><span>🔉 音量</span><span data-out="volume">' + Math.round(vol * 100) + '%</span></div>'
    h += '<div class="neko-row"><input type="range" data-k="volume" min="0" max="100" step="1" value="' + Math.round(vol * 100) + '"></div>'
    h += '<label class="neko-chk"><input type="checkbox" data-k="soundEnabled"' + (p.soundEnabled === false ? '' : ' checked') + '>启用按压音效</label>'
    h += '<div class="neko-lab"><span>音频状态</span><span data-out="audio">' + audioStatusText() + '</span></div>'
    h += '</div>'

    h += '<div class="neko-sect">'
    h += '<label class="neko-chk"><input type="checkbox" data-k="showStatsBar"' + (p.showStatsBar === false ? '' : ' checked') + '>显示输入框下方统计栏</label>'
    h += '<label class="neko-chk"><input type="checkbox" data-k="turnCostBubble"' + (p.turnCostBubble === false ? '' : ' checked') + '>每轮结束播报消耗</label>'
    h += '<label class="neko-chk"><input type="checkbox" data-k="turnEndSound"' + (p.turnEndSound === false ? '' : ' checked') + '>每轮结束提示音</label>'
    h += '<label class="neko-chk"><input type="checkbox" data-k="reviewAlert"' + (p.reviewAlert === false ? '' : ' checked') + '>确认提醒气泡</label>'
    h += '<label class="neko-chk"><input type="checkbox" data-k="reviewAlertSound"' + (p.reviewAlertSound === false ? '' : ' checked') + '>确认提醒音效</label>'
    h += '</div>'

    h += '<div class="neko-sect">'
    h += '<div class="neko-lab"><span>📍 停靠</span></div>'
    h += '<div class="neko-row">'
    h += '<button data-act="dock" data-v="tl">左上</button><button data-act="dock" data-v="tr">右上</button>'
    h += '<button data-act="dock" data-v="bl">左下</button><button data-act="dock" data-v="br">右下</button>'
    h += '</div></div>'

    h += '<div class="neko-foot"><button data-act="close">关闭</button></div>'
    box.innerHTML = h

    var r = rootEl.getBoundingClientRect()
    box.style.display = 'block'
    var bw = box.offsetWidth, bh = box.offsetHeight
    var vw = window.innerWidth, vh = window.innerHeight
    var left = Math.min(vw - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2))
    var top = r.top - bh - 10
    if (top < 8) top = Math.min(vh - bh - 8, r.top + r.height + 10)
    box.style.left = Math.round(left) + 'px'
    box.style.top = Math.round(top) + 'px'

    var saveTimer = 0
    function scheduleSave(patch) {
      STATE.prefs = Object.assign({}, STATE.prefs, patch)
      applyAnchor(); applyVisibility()
      var bar = document.getElementById(IDS.stats)
      if (bar) renderStatsBar(bar)
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(function () { postPrefs(patch) }, 220)
    }

    box.querySelectorAll('input[type=range][data-k]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-k')
        var v = Number(inp.value)
        var num = box.querySelector('input[type=number][data-n="' + k + '"]')
        if (num) num.value = String(v)
        var out = box.querySelector('[data-out="' + k + '"]')
        if (k === 'size') { setSize(v); if (out) out.textContent = v + 'px' }
        else if (k === 'opacity') { scheduleSave({ opacity: v / 100 }); if (out) out.textContent = v + '%' }
        else if (k === 'volume') { scheduleSave({ volume: v / 100 }); if (out) out.textContent = v + '%' }
      })
    })
    box.querySelectorAll('input[type=number][data-n]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var k = inp.getAttribute('data-n')
        var v = Number(inp.value)
        var rng = box.querySelector('input[type=range][data-k="' + k + '"]')
        if (rng) { rng.value = String(v); rng.dispatchEvent(new Event('input')) }
      })
    })
    box.querySelectorAll('input[type=checkbox][data-k]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var patch = {}
        patch[inp.getAttribute('data-k')] = inp.checked
        scheduleSave(patch)
      })
    })
    var sel = box.querySelector('select[data-k="soundSet"]')
    if (sel) sel.addEventListener('change', function () { scheduleSave({ soundSet: sel.value }) })
    box.querySelectorAll('[data-act="dock"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-v')
        var h2 = v.charAt(1) === 'l' ? 'left' : 'right'
        var v2 = v.charAt(0) === 't' ? 'top' : 'bottom'
        postPrefs({ anchor: { h: h2, v: v2, hd: 0, vd: 0 } })
        showSettings()
      })
    })
    var pv = box.querySelector('[data-act="preview"]')
    if (pv) pv.addEventListener('click', function () {
      previewSound((STATE.prefs || {}).soundSet || 'duck')
      var out = box.querySelector('[data-out="audio"]')
      if (out) setTimeout(function () { out.textContent = audioStatusText() }, 120)
    })
    var cl = box.querySelector('[data-act="close"]')
    if (cl) cl.addEventListener('click', function () { box.style.display = 'none' })
  }

  // ── 轮询 ──
  var polling = false
  function poll(force) {
    if (polling) return
    polling = true
    fetch(ROUTE + '/state?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (s) {
        if (!s || !s.ok) return
        var prev = STATE.snap
        STATE.snap = s
        if (s.prefs) STATE.prefs = s.prefs
        applyVisibility()
        applyAnchor()
        setFrame(computeFrame())
        mountStatsBar()
        var bar = document.getElementById(IDS.stats)
        if (bar) renderStatsBar(bar)

        // 新的等待事件 → 提醒
        var w = s.wait
        var prevW = STATE.lastWait
        if (w && (!prevW || prevW.kind !== w.kind || prevW.session !== w.session)) {
          if ((STATE.prefs || {}).reviewAlert !== false) {
            beep('alert')
            var label = w.kind === 'approval' ? '授权/权限待确认' : '提问等待回答'
            var who = w.session ? '【' + w.session + '】' : ''
            showBubble(who + '请求主人确认啦！<div class="neko-b-sep"></div><div style="font-size:11.5px;opacity:.8">' + label + '</div>',
              { alert: true, ms: 4000 })
          }
        }
        STATE.lastWait = w ? { kind: w.kind, session: w.session } : null

        // 新一轮结束 → 消耗播报（气泡）与提示音各自独立开关，
        // 关掉气泡仍可只听声音，反之亦然。
        if (prev && s.session && prev.session &&
            s.session.lastTurnAt && s.session.lastTurnAt !== prev.session.lastTurnAt) {
          var tp = STATE.prefs || {}
          if (tp.turnCostBubble !== false) showTurnCost()
          if (tp.turnEndSound !== false) beep('done')
          if (tp.turnCostBubble !== false) {
            setFrame('grin')
            setTimeout(function () { setFrame(computeFrame()) }, 900)
          }
        }
        if (force) { hideBubble() }
      })
      .catch(function () {})
      .then(function () { polling = false })
  }

  function applyVisibility() {
    var p = STATE.prefs || {}
    var rootEl = document.getElementById(IDS.root)
    if (rootEl) rootEl.style.display = p.enabled === false ? 'none' : 'block'
    if (p.enabled === false) { hideBubble() }
  }

  // ── 启动 ──
  var tries = 0
  function boot() {
    if (!document.body) { if (tries++ < 100) return setTimeout(boot, 100); return }
    if (!build()) return
    bindDrag()

    // 在**用户手势**里同步解锁音频（自动播放策略要求）。
    // 用 capture + once 语义：第一次交互时解锁，之后持续监听以应对被系统重新挂起。
    ;['pointerdown', 'keydown', 'touchstart'].forEach(function (t) {
      window.addEventListener(t, function () { unlockAudio() }, { capture: true, passive: true })
    })
    fetch(ROUTE + '/prefs', { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (j) { if (j && j.ok && j.prefs) { STATE.prefs = j.prefs; applyAnchor(); applyVisibility(); mountStatsBar() } })
      .catch(function () {})
    poll(true)
    setInterval(function () { poll(false) }, POLL_MS)
    setInterval(mountStatsBar, 3000)
    window.addEventListener('resize', function () {
      applyAnchor()
      var card = document.getElementById(IDS.card)
      if (card && card.style.display === 'block') showCard()
    })
    // 「点击外部关闭」：挂件本体 / 统计栏 / 详情卡 / 设置面板 —— 这四处都算"内部"。
    // 关键：详情卡里的「设置」按钮在卡内，若此处不把卡片算作内部，
    // 这次点击冒泡上来会被判成外部点击，面板刚打开就被关掉（"设置页面打不开"）。
    document.addEventListener('click', function (e) {
      var t = e.target
      function inside(el) { return !!(el && t && (el === t || el.contains(t))) }
      var rootEl = document.getElementById(IDS.root)
      var bar = document.getElementById(IDS.stats)
      var card = document.getElementById(IDS.card)
      var st = document.getElementById(IDS.settings)
      if (inside(rootEl) || inside(bar) || inside(card) || inside(st)) return
      if (card && card.style.display === 'block') card.style.display = 'none'
      if (st && st.style.display === 'block') st.style.display = 'none'
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
