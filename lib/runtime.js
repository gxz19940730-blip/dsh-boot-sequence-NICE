/* dsh-boot-sequence — 启动层运行时
 *
 * 这是被宿主内联进 <head> 的脚本本体；配置与样式在构建时填入末尾的调用参数。
 * 设计目标只有四个：早于应用 UI、只做合成器动画、随时可跳过、拆得干净。
 */
(function (CFG, CSS) {
  'use strict'

  var GUARD = '__DSH_BOOT_SEQUENCE__'
  if (globalThis[GUARD]) { return }
  globalThis[GUARD] = true

  var SEEN_KEY = 'dsh-boot-sequence:seen'
  if (CFG.oncePerSession) {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) { return }
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch (e) { /* 隐私模式下没有 sessionStorage，照常播放 */ }
  }

  var reduced = false
  try {
    reduced = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (e) { /* ignore */ }

  var MIN_SHOW_MS = Number(CFG.minShowMs) > 0 ? Number(CFG.minShowMs) : 1200
  var FADE_MS = reduced ? 0 : (Number(CFG.fadeMs) >= 0 ? Number(CFG.fadeMs) : 600)
  var ENDING = CFG.ending || {}
  var BLACKOUT_MS = reduced ? 0 : (Number(ENDING.blackoutMs) >= 0 ? Number(ENDING.blackoutMs) : 450)
  var HOLD_MS = reduced ? 0 : (Number(ENDING.holdMs) >= 0 ? Number(ENDING.holdMs) : 250)
  var REVEAL_MS = reduced ? 0 : (Number(ENDING.revealMs) >= 0 ? Number(ENDING.revealMs) : 900)

  var startedAt = Date.now()
  var timers = []
  var root = null
  var styleEl = null
  var finished = false
  var current = null

  function later(fn, ms) { timers.push(setTimeout(fn, ms)) }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) { clearTimeout(timers[i]) }
    timers = []
  }
  function el(tag, cls) {
    var node = document.createElement(tag)
    if (cls) { node.className = cls }
    return node
  }
  function wait(ms) {
    return new Promise(function (resolve) { later(resolve, ms) })
  }
  function mediaUrl(src) {
    if (!src) { return '' }
    if (/^(https?:)?\/\//.test(src) || src.charAt(0) === '/') { return src }
    return (CFG.mediaBase || '') + '/' + src.replace(/^\.?\//, '')
  }

  function mount() {
    styleEl = el('style')
    styleEl.setAttribute('data-dsh-boot-sequence', 'css')
    styleEl.textContent = CSS
    ;(document.head || document.documentElement).appendChild(styleEl)

    root = el('div')
    root.id = 'dsh-boot-sequence'
    root.setAttribute('aria-hidden', 'true')
    root.style.setProperty('--seq-fade', FADE_MS + 'ms')
    root.style.setProperty('--seq-blackout', BLACKOUT_MS + 'ms')
    root.style.setProperty('--seq-reveal', REVEAL_MS + 'ms')
    ;(document.body || document.documentElement).appendChild(root)

    // 应用 UI 起来后把层移到 body 末尾，保证始终在最上面
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () {
        if (root && document.body && root.parentNode !== document.body) {
          document.body.appendChild(root)
        }
      }, { once: true })
    }
  }

  /* ---------- 阶段层 ---------- */

  function buildPhase(phase, index) {
    var layer = el('div', 'seq-phase')
    layer.setAttribute('data-index', String(index))
    var fit = phase.fit === 'contain' ? 'contain' : 'cover'
    layer.setAttribute('data-fit', fit)

    if (phase.type === 'image' && phase.src) {
      var img = el('img')
      img.alt = ''
      img.decoding = 'async'
      img.src = mediaUrl(phase.src)
      img.addEventListener('error', function () { layer.setAttribute('data-failed', '1') })
      layer.appendChild(img)
    } else if (phase.type === 'video' && phase.src) {
      var video = el('video')
      video.muted = phase.muted !== false
      video.playsInline = true
      video.preload = 'auto'
      video.setAttribute('muted', '')
      video.setAttribute('playsinline', '')
      video.src = mediaUrl(phase.src)
      video.addEventListener('error', function () { layer.setAttribute('data-failed', '1') })
      layer.appendChild(video)
      layer._video = video
    } else {
      var blank = el('div', 'seq-blank')
      layer.appendChild(blank)
    }
    return layer
  }

  function durationOf(phase) {
    var d = Number(phase.duration)
    if (Number.isFinite(d) && d >= 0) { return (reduced ? Math.min(d, 800) : d) }
    return phase.type === 'video' ? 30000 : (reduced ? 800 : 2400)
  }

  function show(layer) {
    layer.classList.add('seq-on')
    current = layer
  }
  function hide(layer) {
    return new Promise(function (resolve) {
      layer.classList.remove('seq-on')
      later(resolve, FADE_MS + 40)
    })
  }

  function playVideo(layer, phase) {
    var video = layer._video
    var cap = Math.max(1000, durationOf(phase))
    return new Promise(function (resolve) {
      var done = false
      function finish() {
        if (done) { return }
        done = true
        resolve()
      }
      video.addEventListener('ended', finish, { once: true })
      later(finish, cap)
      var playing = video.play()
      if (playing && playing.catch) { playing.catch(function () { /* 自动播放被拦：按 duration 走 */ }) }
    })
  }

  /* ---------- 收尾 ---------- */

  function teardown() {
    clearTimers()
    document.removeEventListener('click', onSkip, true)
    document.removeEventListener('keydown', onSkip, true)
    try {
      if (root && root.parentNode) { root.parentNode.removeChild(root) }
      if (styleEl && styleEl.parentNode) { styleEl.parentNode.removeChild(styleEl) }
    } catch (e) { /* 已经拆掉就算了 */ }
    root = null
    styleEl = null
  }

  function finish(reason) {
    if (finished) { return }
    finished = true
    clearTimers()
    var skip = reason === 'skip'
    var elapsed = Date.now() - startedAt
    var waitForMin = skip ? 0 : Math.max(0, MIN_SHOW_MS - elapsed)

    later(function () {
      if (!root) { return }
      if (skip) {
        // 用户主动跳过：不等最短时长，快速淡出即可
        root.style.transitionDuration = '260ms'
        root.classList.add('seq-leaving')
        later(teardown, 300)
        return
      }
      var black = el('div', 'seq-black')
      root.appendChild(black)
      // 强制一帧后再上色，保证过渡生效
      requestAnimationFrame(function () { black.classList.add('seq-on') })
      later(function () {
        root.classList.add('seq-leaving')
        later(teardown, REVEAL_MS + 120)
      }, BLACKOUT_MS + HOLD_MS)
    }, waitForMin)
  }

  function onSkip(e) {
    if (e && e.type === 'keydown') {
      var keys = (CFG.skip && CFG.skip.keys) || ['Escape', ' ', 'Enter']
      var key = e.key === 'Spacebar' ? ' ' : e.key
      if (keys.indexOf(key) === -1) { return }
      e.preventDefault()
    }
    finish('skip')
  }

  function bindSkip() {
    var skip = CFG.skip || {}
    if (skip.click !== false) {
      document.addEventListener('click', onSkip, true)
    }
    document.addEventListener('keydown', onSkip, true)
  }

  /* ---------- 主流程 ---------- */

  async function run() {
    var phases = (CFG.phases && CFG.phases.length)
      ? CFG.phases
      : [{ type: 'blank', duration: 1400 }]

    var layers = []
    for (var i = 0; i < phases.length; i++) {
      var layer = buildPhase(phases[i], i)
      root.appendChild(layer)
      layers.push(layer)
    }

    root.appendChild(el('div', 'seq-grain'))
    root.appendChild(el('div', 'seq-vignette'))

    if (CFG.brand && CFG.brand.show && CFG.brand.text) {
      var brand = el('div', 'seq-brand')
      brand.textContent = CFG.brand.text
      root.appendChild(brand)
      later(function () { brand.classList.add('seq-on') }, 600)
    }
    if (CFG.hint) {
      var hint = el('div', 'seq-hint')
      hint.textContent = CFG.hint
      root.appendChild(hint)
      later(function () { hint.classList.add('seq-on') }, 900)
    }

    for (var j = 0; j < layers.length; j++) {
      if (finished) { return }
      var phase = phases[j]
      var node = layers[j]
      show(node)
      if (phase.type === 'video' && node._video) {
        await playVideo(node, phase)
      } else {
        await wait(durationOf(phase))
      }
      if (finished) { return }
      if (j < layers.length - 1) { await hide(node) }
    }
    finish('auto')
  }

  function boot() {
    mount()
    bindSkip()
    run()
  }

  if (document.readyState === 'loading') {
    boot()
  } else {
    boot()
  }
})(__CONFIG__, __CSS__);
