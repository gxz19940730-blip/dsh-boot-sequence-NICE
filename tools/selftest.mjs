#!/usr/bin/env node
/**
 * 自检：不启动宿主，mock ctx 跑一遍注入、健康检查与媒体路由。
 *
 *   node tools/selftest.mjs
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { ROOT, loadConfig } from '../lib/build.js'
import { apply } from '../lib/index.js'

const injectHandlers = []
const routes = []
const fakeCtx = {
  on(event, fn) { if (event === 'webserver/index-inject') { injectHandlers.push(fn) } },
  inject(_deps, cb) {
    cb({
      get(name) {
        if (name !== 'webServer') { return undefined }
        return { register(route) { routes.push(route); return () => {} } }
      },
    })
  },
  effect(fn) { fn() },
}

apply(fakeCtx)

let failed = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) { failed += 1 }
}

check('index-inject handler', injectHandlers.length === 1)
check('routes', routes.length === 2, routes.map((r) => r.kind + ' ' + r.path).join(', '))

const table = []
injectHandlers[0](table)
const rows = table.map((r) => r.kind + (r.placement ? ':' + r.placement : ''))
check('injected rows', table.length >= 1 && table.length <= 2, rows.join(' | '))

const script = table.find((r) => r.kind === 'script')
check('screen script', !!script && script.text.length > 4000, script ? script.text.length + ' bytes' : '')
check('runtime guard', !!script && script.text.includes('__DSH_BOOT_SEQUENCE__'))
check('no unreplaced placeholder', !!script && !script.text.includes('__CONFIG__') && !script.text.includes('__CSS__'))

let parses = true
try { new Function(script ? script.text : '') } catch (err) { parses = false; console.log('  parse error:', err.message) }
check('script compiles', parses)

const config = loadConfig(ROOT)
check('config phases', Array.isArray(config.phases) && config.phases.length > 0, JSON.stringify(config.phases))

const health = routes.find((r) => r.path.endsWith('/health'))
let healthBody = ''
health.handler({ method: 'GET', headers: {} }, { writeHead() {}, end(chunk) { healthBody = chunk || '' } })
let healthJson = {}
try { healthJson = JSON.parse(healthBody) } catch { /* ignore */ }
check('health', healthJson.ok === true && healthJson.screenBytes > 4000, JSON.stringify({ v: healthJson.version, bytes: healthJson.screenBytes }))

// 媒体路由：临时放一个假 mp4，验证 200 与 Range 206
const mediaRoute = routes.find((r) => r.kind === 'prefix')
const tmpDir = join(ROOT, 'media')
mkdirSync(tmpDir, { recursive: true })
const tmpFile = join(tmpDir, '__selftest__.mp4')
writeFileSync(tmpFile, Buffer.from('0123456789'))

function runMedia(url, headers = {}) {
  return new Promise((resolve) => {
    const chunks = []
    const res = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb() } })
    res.writeHead = (status, extra = {}) => { res.statusCode = status; res.headers = extra }
    res.on('finish', () => resolve({ status: res.statusCode, headers: res.headers || {}, body: Buffer.concat(chunks).toString() }))
    mediaRoute.handler({ method: 'GET', url, headers }, res)
  })
}

const full = await runMedia('/dsh-boot-sequence-nice/media/__selftest__.mp4')
check('media 200', full.status === 200 && full.body === '0123456789', `${full.status} ${full.headers['content-type']}`)

const ranged = await runMedia('/dsh-boot-sequence-nice/media/__selftest__.mp4', { range: 'bytes=2-5' })
check('media 206', ranged.status === 206 && ranged.body === '2345' && ranged.headers['content-range'] === 'bytes 2-5/10', `${ranged.status} ${ranged.headers['content-range']}`)

const traversal = await runMedia('/dsh-boot-sequence-nice/media/../package.json')
check('media traversal blocked', traversal.status === 404, String(traversal.status))

rmSync(tmpFile, { force: true })

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
