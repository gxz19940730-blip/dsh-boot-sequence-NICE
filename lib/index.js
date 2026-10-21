/**
 * dsh-boot-sequence — 宿主半边。
 *
 * 职责三条，没有客户端条目：
 *   1) 订阅 webserver/index-inject，注入 preload（首段是视频时）与启动层脚本；
 *   2) 注册 /dsh-boot-sequence/media/*，带 Range 的静态媒体服务（仅限 media/ 目录）；
 *   3) 注册 /dsh-boot-sequence/health 只读诊断。
 *
 * 合成失败绝不挡界面：拿不到脚本就注入空表，应用照常启动。
 */
import { createReadStream, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import {
  buildScreen, configSignature, firstVideoUrl, loadConfig, ROOT,
} from './build.js'

export const name = 'dsh-boot-sequence'

const ROUTE = '/dsh-boot-sequence'
const MEDIA_PREFIX = ROUTE + '/media/'
const MEDIA_ROOT = join(ROOT, 'media')
// 用户素材目录：插件目录外的“用户数据”，重装/升级都不会被覆盖
const USER_MEDIA = join(homedir(), '.dsh', 'boot-sequence-media')

const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
}

let cache = { key: '', source: '' }

function sourceForKey(key, config) {
  if (cache.key === key && cache.source) { return cache.source }
  try {
    const source = buildScreen(config, ROOT)
    cache = { key, source }
    return source
  } catch (err) {
    console.error('[dsh-boot-sequence] 合成启动层失败：', err && err.message ? err.message : err)
    return ''
  }
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('not found')
}

function safeJoin(base, rel) {
  const file = resolve(base, rel)
  if (file !== base && !file.startsWith(base + sep)) { return '' }
  return file
}

/** 先在包内 media/ 找，再回落到 ~/.dsh/boot-sequence-media/（用户素材目录）。 */
function findMediaFile(rel) {
  for (const base of [MEDIA_ROOT, USER_MEDIA]) {
    const file = safeJoin(base, rel)
    if (!file) { continue }
    try {
      if (statSync(file).isFile()) { return file }
    } catch { /* 继续找下一个目录 */ }
  }
  return ''
}

function serveMedia(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { return notFound(res) }

  let pathname
  try {
    pathname = decodeURIComponent((req.url || '').split('?')[0])
  } catch {
    return notFound(res)
  }
  if (!pathname.startsWith(MEDIA_PREFIX)) { return notFound(res) }

  const relativePath = pathname.slice(MEDIA_PREFIX.length)
  if (!relativePath || relativePath.indexOf('\0') !== -1) { return notFound(res) }

  const file = findMediaFile(relativePath)
  if (!file) { return notFound(res) }

  const type = MIME[extname(file).toLowerCase()]
  if (!type) { return notFound(res) }

  let stat
  try {
    stat = statSync(file)
  } catch {
    return notFound(res)
  }
  if (!stat.isFile()) { return notFound(res) }

  const baseHeaders = {
    'content-type': type,
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
  }

  const range = req.headers && req.headers.range
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim())
    if (!match) { return notFound(res) }
    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Number(match[2]) : stat.size - 1
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
      res.writeHead(416, { ...baseHeaders, 'content-range': `bytes */${stat.size}` })
      return res.end()
    }
    res.writeHead(206, {
      ...baseHeaders,
      'content-range': `bytes ${start}-${end}/${stat.size}`,
      'content-length': end - start + 1,
    })
    if (req.method === 'HEAD') { return res.end() }
    return createReadStream(file, { start, end }).pipe(res)
  }

  res.writeHead(200, { ...baseHeaders, 'content-length': stat.size })
  if (req.method === 'HEAD') { return res.end() }
  return createReadStream(file).pipe(res)
}

/** 样式/运行时改动也应立即生效：把 mtime 计入缓存键。 */
function assetStamp() {
  try {
    const css = statSync(join(ROOT, 'lib', 'screen.css')).mtimeMs
    const rt = statSync(join(ROOT, 'lib', 'runtime.js')).mtimeMs
    return css + ':' + rt
  } catch {
    return '0'
  }
}

export function apply(ctx) {
  ctx.on('webserver/index-inject', (table) => {
    const config = loadConfig(ROOT)
    const key = assetStamp() + '|' + configSignature(config)
    const source = sourceForKey(key, config)
    if (!source) { return }

    const preload = firstVideoUrl(config)
    if (preload) {
      table.push({
        kind: 'html',
        placement: 'head',
        html: '<link rel="preload" as="video" href="' + preload.replace(/"/g, '&quot;') + '" type="video/mp4">',
      })
    }
    table.push({ kind: 'script', placement: 'head', text: source })
  })

  ctx.inject(['webServer'], (webCtx) => {
    const server = webCtx.get('webServer')
    if (!server || typeof server.register !== 'function') { return }

    ctx.effect(() => server.register({
      kind: 'prefix',
      path: ROUTE + '/media',
      handler: serveMedia,
    }), 'dsh-boot-sequence: media route')

    ctx.effect(() => server.register({
      kind: 'exact',
      path: ROUTE + '/health',
      handler: (req, res) => {
        const config = loadConfig(ROOT)
        const source = sourceForKey(assetStamp() + '|' + configSignature(config), config)
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify({
          ok: true,
          plugin: name,
          version: '0.1.0',
          phases: config.phases.map((p) => p.type),
          screenBytes: source.length,
          mediaBase: config.mediaBase,
        }))
      },
    }), 'dsh-boot-sequence: health route')
  })
}
