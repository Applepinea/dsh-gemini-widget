// 极简 DOM shim —— 只为跑通挂件启动路径与交互，不追求完整
const VOID_TAGS = new Set(['input','br','img','hr','meta','link'])

export function makeDom() {
  const byId = new Map()
  const all = []
  let docRef = null

  // style 要能读写任意 CSS 属性（display/width/left...）—— 用 Proxy 兜住
  function makeStyle() {
    const p = {}
    return new Proxy(p, {
      get(t, k) {
        if (k === 'setProperty') return (kk, vv) => { t[kk] = String(vv) }
        if (k === 'removeProperty') return (kk) => { delete t[kk] }
        if (k === 'getPropertyValue') return (kk) => t[kk] || ''
        if (k in t) return t[k]
        return ''
      },
      set(t, k, v) { t[k] = String(v); return true },
    })
  }
  class ClassList {
    constructor(el){ this.el = el }
    _set(){ return new Set(String(this.el.className||'').split(/\s+/).filter(Boolean)) }
    _write(s){ this.el.className = Array.from(s).join(' ') }
    add(...c){ const s=this._set(); c.forEach(x=>s.add(x)); this._write(s) }
    remove(...c){ const s=this._set(); c.forEach(x=>s.delete(x)); this._write(s) }
    toggle(c,f){ const s=this._set(); const on = f===undefined ? !s.has(c) : !!f; on?s.add(c):s.delete(c); this._write(s); return on }
    contains(c){ return this._set().has(c) }
  }
  class TextNode {
    constructor(t){ this.nodeType=3; this._text=String(t); this.children=[]; this.parentNode=null }
  }
  class El {
    constructor(tag){
      this.tagName = String(tag).toUpperCase()
      this.nodeType = 1
      this.children = []
      this.parentNode = null
      this.style = makeStyle()
      this.classList = new ClassList(this)
      this._attrs = {}
      this._text = ''
      this._html = ''
      this._listeners = {}
      this.className = ''
      all.push(this)
    }
    get value(){
      if (this.tagName === 'SELECT') {
        const opts = this.querySelectorAll('option')
        const sel = opts.find(o => o._attrs.selected !== undefined) || opts[0]
        return sel ? (sel._attrs.value !== undefined ? sel._attrs.value : sel._text) : ''
      }
      if (this.tagName === 'INPUT' && this._attrs.type === 'checkbox') return this._checked === true
      return this._attrs.value !== undefined ? this._attrs.value : ''
    }
    set value(v){
      if (this.tagName === 'SELECT') {
        for (const o of this.querySelectorAll('option')) {
          if (String(o._attrs.value) === String(v)) o._attrs.selected = ''
          else delete o._attrs.selected
        }
        this._attrs.value = String(v)
        return
      }
      if (this.tagName === 'INPUT' && this._attrs.type === 'checkbox') { this._checked = !!v; return }
      this._attrs.value = String(v)
    }
    get checked(){ return this._checked === true }
    set checked(v){ this._checked = !!v }
    get parentElement(){ return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null }
    get nextSibling(){ if(!this.parentNode) return null; const a=this.parentNode.children; const i=a.indexOf(this); return a[i+1] || null }
    get id(){ return this._attrs.id || '' }
    set id(v){ this._attrs.id = v; byId.set(v, this) }
    setAttribute(k,v){ this._attrs[k]=String(v); if(k==='id') byId.set(String(v), this) }
    getAttribute(k){ return this._attrs[k] === undefined ? null : this._attrs[k] }
    hasAttribute(k){ return k in this._attrs }
    get textContent(){ return this._text }
    set textContent(v){ this._text = String(v); this.children = []; this._html = '' }
    get innerHTML(){
      if (this._html) return this._html
      if (this.children.length) return this.children.map(serialize).join('')
      return this._text || ''
    }
    // 真实 DOM 里游离元素同样能序列化；shim 之前没有 → rows() 返回空串
    get outerHTML(){
      if (this.nodeType === 3) return this._text
      const attrs = Object.keys(this._attrs)
        .filter(k => this._attrs[k] !== undefined && this._attrs[k] !== '')
        .map(k => ' ' + k + '="' + String(this._attrs[k]).replace(/"/g, '&quot;') + '"').join('')
      const cls = this.className ? ' class="' + this.className + '"' : ''
      const inner = this._html || (this.children.length ? this.children.map(serialize).join('') : (this._text || ''))
      return '<' + this.tagName.toLowerCase() + attrs + cls + '>' + inner + '</' + this.tagName.toLowerCase() + '>'
    }
    set innerHTML(v){ this._html = String(v); this.children = []; parseInto(this, this._html) }
    appendChild(c){ c.parentNode = this; this.children.push(c); if (c._attrs && c._attrs.id) byId.set(c._attrs.id, c); return c }
    insertBefore(c, ref){ c.parentNode = this; const i = this.children.indexOf(ref); if(i<0) this.children.push(c); else this.children.splice(i,0,c); return c }
    removeChild(c){ const i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1); c.parentNode=null }
    remove(){ if(this.parentNode) this.parentNode.removeChild(this) }
    contains(n){ if(n===this) return true; for(const c of this.children) if(c.contains && c.contains(n)) return true; return false }
    getBoundingClientRect(){ return { left:1000, top:600, right:1112, bottom:712, width:112, height:112 } }
    get offsetWidth(){ return 112 }
    get offsetHeight(){ return 112 }
    addEventListener(t,fn){ (this._listeners[t]=this._listeners[t]||[]).push(fn) }
    removeEventListener(t,fn){ const a=this._listeners[t]||[]; const i=a.indexOf(fn); if(i>=0)a.splice(i,1) }
    dispatchEvent(ev){
      ev.target = ev.target || this
      if (!ev.preventDefault) ev.preventDefault = function(){}
      let node = this
      while (node) {
        // 属性式监听（el.onclick = fn）在真实 DOM 里同样参与冒泡
        const on = node['on' + ev.type]
        if (typeof on === 'function') on.call(node, ev)
        const a = node._listeners && node._listeners[ev.type]
        if (a) for (const fn of a.slice()) fn.call(node, ev)
        node = node.parentNode
      }
      return true
    }
    click(){ this.dispatchEvent({ type:'click', target:this }) }
    _match(sel){
      const parts = /^([a-zA-Z]+)?((?:[.#][\w-]+)*)((?:\[[^\]]+\])*)$/.exec(sel.trim())
      if (!parts) return false
      if (parts[1] && this.tagName !== parts[1].toUpperCase()) return false
      for (const m of (parts[2]||'').matchAll(/([.#])([\w-]+)/g)) {
        if (m[1] === '.' && !this.classList.contains(m[2])) return false
        if (m[1] === '#' && this._attrs.id !== m[2]) return false
      }
      for (const m of (parts[3]||'').matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g)) {
        const k = m[1], v = m[2]
        if (!(k in this._attrs)) return false
        if (v !== undefined && String(this._attrs[k]) !== v) return false
      }
      return true
    }
    querySelectorAll(sel){
      const out = []
      const walk = (n) => { for (const c of n.children) { if (c._match && c._match(sel)) out.push(c); if (c.children && c.children.length) walk(c) } }
      walk(this); return out
    }
    querySelector(sel){ return this.querySelectorAll(sel)[0] || null }
  }

  function serialize(n) {
    if (!n) return ''
    if (n.nodeType === 3) return n._text
    if (n.outerHTML !== undefined && n.children) return n.outerHTML
    return ''
  }

  function parseInto(parent, html) {
    const stack = [parent]
    let i = 0
    const top = () => stack[stack.length-1]
    while (i < html.length) {
      const lt = html.indexOf('<', i)
      if (lt < 0) { const t = html.slice(i); if (t) top().appendChild(new TextNode(t)); break }
      if (lt > i) { const t = html.slice(i, lt); if (t) top().appendChild(new TextNode(t)) }
      const gt = html.indexOf('>', lt)
      if (gt < 0) { const t = html.slice(lt); if (t) top().appendChild(new TextNode(t)); break }
      const raw = html.slice(lt + 1, gt)
      i = gt + 1
      if (raw[0] === '/') { if (stack.length > 1) stack.pop(); continue }
      const close = raw.endsWith('/')
      const body = close ? raw.slice(0, -1) : raw
      const m = /^([a-zA-Z][\w-]*)/.exec(body)
      if (!m) continue
      const tag = m[1].toLowerCase()
      const el = new El(tag)
      for (const a of body.slice(m[1].length).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        const k = a[1]
        const v = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : ''
        if (k === 'class') el.className = v
        else el.setAttribute(k, v)
      }
      top().appendChild(el)
      if (!close && !VOID_TAGS.has(tag)) stack.push(el)
    }
  }

  const body = new El('body')
  const head = new El('head')
  const documentEl = new El('html')
  documentEl.appendChild(head); documentEl.appendChild(body)

  const document = {
    readyState: 'complete',
    body, head, documentElement: documentEl,
    createElement: (t) => new El(t),
    createTextNode: (t) => new TextNode(t),
    getElementById: (id) => byId.get(id) || null,
    querySelector: (s) => documentEl.querySelector(s),
    querySelectorAll: (s) => documentEl.querySelectorAll(s),
    addEventListener: (t, fn) => documentEl.addEventListener(t, fn),
  }

  const winListeners = {}
  const win = {
    innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
    addEventListener: (t, fn) => { (winListeners[t]=winListeners[t]||[]).push(fn) },
    removeEventListener: () => {},
    setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    AudioContext: class {
      constructor(){ this.state='running'; this.currentTime=0; this.sampleRate=48000; this.destination={} }
      resume(){}
      createOscillator(){ return { type:'sine', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, value:0 }, connect(){}, start(){}, stop(){} } }
      createGain(){ return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}, value:0 }, connect(){} } }
      createBuffer(ch,len){ return { getChannelData: () => new Float32Array(len) } }
      createBufferSource(){ return { buffer:null, connect(){}, start(){} } }
      createBiquadFilter(){ return { type:'', frequency:{value:0}, Q:{value:0}, connect(){} } }
    },
  }
  win.window = win
  docRef = document
  return { document, window: win, El }
}
