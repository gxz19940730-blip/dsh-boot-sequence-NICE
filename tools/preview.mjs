#!/usr/bin/env node
/**
 * 预览：把启动层打成一张独立 HTML，浏览器里直接看效果。
 *
 *   node tools/preview.mjs                          # 用 boot.config.json
 *   node tools/preview.mjs --config examples/video-only.json
 *   node tools/preview.mjs --out dist/demo.html
 *
 * 会把配置里引用到的媒体复制到 dist/media，并把 mediaBase 改成本地相对路径，
 * 这样 file:// 打开也能播视频。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { buildScreen, loadConfig, normalizeConfig, ROOT } from '../lib/build.js'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const configPath = flag('--config', '')
const outPath = resolve(ROOT, flag('--out', join('dist', 'preview.html')))
const outDir = resolve(outPath, '..')
const mediaOut = join(outDir, 'media')
mkdirSync(mediaOut, { recursive: true })

const raw = configPath
  ? JSON.parse(readFileSync(resolve(ROOT, configPath), 'utf8'))
  : loadConfig(ROOT)
const config = normalizeConfig(raw)

const USER_MEDIA = join(homedir(), '.dsh', 'boot-sequence-media')
const findMedia = (src) => [join(ROOT, 'media', src), join(USER_MEDIA, src)].find(existsSync) || ''

for (const phase of config.phases) {
  if (!phase.src) { continue }
  const from = findMedia(phase.src)
  if (!from) { console.warn('media missing:', phase.src); continue }
  copyFileSync(from, join(mediaOut, basename(phase.src)))
  phase.src = basename(phase.src)
}

const screen = buildScreen({ ...config, mediaBase: 'media' })
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>dsh-boot-sequence preview</title>
</head>
<body style="margin:0;background:#dfe6ee">
<script>${screen}</script>
</body>
</html>
`
writeFileSync(outPath, html)
console.log(outPath)
