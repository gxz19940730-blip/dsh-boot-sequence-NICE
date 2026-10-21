/**
 * dsh-boot-sequence — 配置加载与启动层合成。
 *
 * 宿主每次渲染 index 时调用 buildScreen()，把
 *   screen.css + runtime.js + 当前配置
 * 合成一段可直接注入 <head> 的脚本。没有生成物、没有构建步骤。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, '..')

const DEFAULTS = {
  mediaBase: '/dsh-boot-sequence/media',
  fadeMs: 600,
  minShowMs: 1200,
  oncePerSession: false,
  skip: { click: true, keys: ['Escape', ' ', 'Enter'] },
  ending: { blackoutMs: 450, holdMs: 250, revealMs: 900 },
  phases: [{ type: 'blank', duration: 1400 }],
}

function num(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) { return fallback }
  return Math.min(max, Math.max(min, n))
}

function normalizePhase(raw) {
  if (!raw || typeof raw !== 'object') { return { type: 'blank', duration: 1400 } }
  const type = raw.type === 'video' || raw.type === 'image' ? raw.type : 'blank'
  const phase = { type }
  if (type !== 'blank') {
    if (typeof raw.src !== 'string' || !raw.src.trim()) { return { type: 'blank', duration: 1400 } }
    phase.src = raw.src.trim()
    phase.fit = raw.fit === 'contain' ? 'contain' : 'cover'
    if (type === 'video') { phase.muted = raw.muted !== false }
  }
  const duration = Number(raw.duration)
  if (Number.isFinite(duration) && duration >= 0) { phase.duration = Math.min(600000, duration) }
  return phase
}

/** 读取并规范化 boot.config.json。坏配置一律回落到安全的默认值。 */
export function loadConfig(root = ROOT) {
  let raw = {}
  try {
    raw = JSON.parse(readFileSync(join(root, 'boot.config.json'), 'utf8'))
  } catch { raw = {} }
  return normalizeConfig(raw)
}

/** 把任意对象规范成完整配置（预览/示例配置也走这里）。 */
export function normalizeConfig(raw = {}) {
  const skip = raw.skip && typeof raw.skip === 'object' ? raw.skip : {}
  const ending = raw.ending && typeof raw.ending === 'object' ? raw.ending : {}
  const brand = raw.brand && typeof raw.brand === 'object' ? raw.brand : {}

  const phases = Array.isArray(raw.phases) && raw.phases.length
    ? raw.phases.map(normalizePhase)
    : DEFAULTS.phases

  return {
    mediaBase: typeof raw.mediaBase === 'string' && raw.mediaBase
      ? raw.mediaBase.replace(/\/+$/, '')
      : DEFAULTS.mediaBase,
    fadeMs: num(raw.fadeMs, DEFAULTS.fadeMs, 0, 5000),
    minShowMs: num(raw.minShowMs, DEFAULTS.minShowMs, 0, 60000),
    oncePerSession: raw.oncePerSession === true,
    skip: {
      click: skip.click !== false,
      keys: Array.isArray(skip.keys) && skip.keys.length
        ? skip.keys.filter((k) => typeof k === 'string').slice(0, 8)
        : DEFAULTS.skip.keys,
    },
    ending: {
      blackoutMs: num(ending.blackoutMs, DEFAULTS.ending.blackoutMs, 0, 10000),
      holdMs: num(ending.holdMs, DEFAULTS.ending.holdMs, 0, 10000),
      revealMs: num(ending.revealMs, DEFAULTS.ending.revealMs, 0, 10000),
    },
    phases,
    brand: brand.show === true && typeof brand.text === 'string'
      ? { show: true, text: brand.text.slice(0, 80) }
      : { show: false },
    hint: typeof raw.hint === 'string' ? raw.hint.slice(0, 60) : '',
  }
}

/** 配置签名：只有配置变化时才重新合成脚本。 */
export function configSignature(config) {
  return JSON.stringify(config)
}

function jsString(value) {
  // 转义 <，避免配置/样式里出现 </script> 提前结束标签
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * 合成可直接注入的启动层脚本。
 * @param {ReturnType<typeof loadConfig>} config
 * @param {string} root
 */
export function buildScreen(config, root = ROOT) {
  const css = readFileSync(join(HERE, 'screen.css'), 'utf8')
  const runtime = readFileSync(join(HERE, 'runtime.js'), 'utf8')
  const composed = runtime
    .split('__CONFIG__').join(jsString(config))
    .split('__CSS__').join(jsString(css))
  if (composed.indexOf('__CONFIG__') !== -1) {
    throw new Error('[dsh-boot-sequence] runtime 缺少 __CONFIG__ 占位符')
  }
  return composed
}

/** 首段是视频时返回其 URL，供宿主注入 preload。 */
export function firstVideoUrl(config) {
  const first = config.phases.find((p) => p.type === 'video' && p.src)
  if (!first) { return '' }
  return config.mediaBase + '/' + first.src.replace(/^\.?\//, '')
}
