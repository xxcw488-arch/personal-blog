/**
 * 本地开发服务器（Pages + D1 + R2 的替身）
 * ============================================================
 * 用途：在没有 Cloudflare 账号、或 `wrangler pages dev` 跑不起来的环境里，
 * 把**真实的 Functions 代码**跑在本地 HTTP 服务上，以便端到端验证前端与后台界面。
 *
 * 它不是模拟实现：路由到的是 functions/ 下真实的 handler，
 * D1 用 sql.js（真 SQLite），R2 用内存 Map。
 *
 * 用法：
 *   npm run dev:local          # 构建 dist 后启动（默认 8788 端口）
 *   npm run dev:local -- --port 9000
 *
 * 注意：它只用于本地开发，不要拿去部署。
 */
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, extname } from 'node:path'
import initSqlJs from 'sql.js'

const here = dirname(fileURLToPath(import.meta.url))
const siteDir = join(here, '..')
const rootDir = join(siteDir, '..')
const distDir = join(siteDir, 'dist')
const functionsDir = join(siteDir, 'functions')

/* ============================================================
   本地配置
   ------------------------------------------------------------
   · `site/wrangler.toml` 的 `[vars]` —— 和线上**同一份**配置，避免两边不一致
     （最要紧的是 GITHUB_CLIENT_ID：不读它就没法在本地测评论登录）
   · `site/.dev.vars`（可选，已在 .gitignore 里）—— 放密钥：
     GITHUB_CLIENT_SECRET / ADMIN_PEPPER
   · SITE_URL / MEDIA_URL 始终强制指向本地，否则本地上传的图会指向线上域名
   ============================================================ */

/**
 * 从 wrangler.toml 里抠出 [vars] 段的字符串键值对。
 * ------------------------------------------------------------
 * 逐行解析而不是用一条正则 —— 因为文件顶部的注释里就出现过 `[vars]` 字样，
 * 正则会从注释里那个开始匹配，把 name / compatibility_date 也当成变量读进来。
 * 这里只认「整行就是 [vars]」的段头，遇到任何其它 [xxx] 段头就结束。
 */
function readWranglerVars() {
  const out = {}
  try {
    const lines = readFileSync(join(siteDir, 'wrangler.toml'), 'utf8').split(/\r?\n/)
    let inVars = false
    for (const line of lines) {
      if (/^\s*\[/.test(line)) {
        inVars = /^\s*\[vars\]\s*$/.test(line)
        continue
      }
      if (!inVars) continue
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"\s*$/.exec(line)
      if (m) out[m[1]] = m[2]
    }
  } catch {
    /* 没有配置文件就用空值，本地照样能跑 */
  }
  return out
}

/** 读 .dev.vars（KEY=value 每行一条，支持 # 注释），用于本地放密钥 */
function readDevVars() {
  const out = {}
  const file = join(siteDir, '.dev.vars')
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (key) out[key] = value
  }
  return out
}

const WRANGLER_VARS = readWranglerVars()
const DEV_VARS = readDevVars()

const portArgIdx = process.argv.indexOf('--port')
const PORT = portArgIdx >= 0 ? Number(process.argv[portArgIdx + 1]) : 8788

/* ============================================================
   1. 扫描 functions/ 生成路由表
   ============================================================ */

/** 把文件路径转成路由模式：/api/wp/posts/[slug].ts → /api/wp/posts/:slug */
function toRoute(fileRel) {
  const noExt = fileRel.replace(/\.ts$/, '').replace(/\\/g, '/')
  const parts = noExt.split('/').map((p) => (p.startsWith('[') && p.endsWith(']') ? `:${p.slice(1, -1)}` : p))
  return `/${parts.join('/')}`.replace(/\/index$/, '')
}

function scanFunctions(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // _lib 是共享模块，不是路由
      if (entry.name.startsWith('_')) continue
      out.push(...scanFunctions(full, base))
    } else if (entry.name.endsWith('.ts')) {
      const rel = relative(base, full)
      out.push({ file: full, rel, route: toRoute(rel) })
    }
  }
  return out
}

const fnFiles = scanFunctions(functionsDir)

/** 生成一个入口文件：把每个 handler 都 import 进来并建表 */
function generateEntry() {
  const imports = []
  const table = []

  fnFiles.forEach((f, i) => {
    const id = `m${i}`
    const relPath = `../${relative(siteDir, f.file).replace(/\\/g, '/')}`
    imports.push(`import * as ${id} from '${relPath.replace(/\.ts$/, '')}'`)
    table.push(`  { route: ${JSON.stringify(f.route)}, mod: ${id} }`)
  })

  return `${imports.join('\n')}

export const ROUTES = [
${table.join(',\n')}
]
`
}

const entryPath = join(here, '.devserver-routes.ts')
writeFileSync(entryPath, generateEntry(), 'utf8')

const bundlePath = join(here, '.devserver-routes.mjs')
await build({
  entryPoints: [entryPath],
  outfile: bundlePath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['sql.js'],
  logLevel: 'warning',
})

const { ROUTES } = await import(pathToFileURL(bundlePath).href)

/* ============================================================
   2. D1 替身（sql.js）
   ============================================================ */

const SQL = await initSqlJs()
const db = new SQL.Database()
db.run(readFileSync(join(rootDir, 'db', 'schema.sql'), 'utf8'))
db.run(readFileSync(join(rootDir, 'db', 'seed.sql'), 'utf8'))

function exec(sql, params) {
  const stmt = db.prepare(sql)
  try {
    if (params.length > 0) stmt.bind(params)
    const out = []
    while (stmt.step()) out.push(stmt.getAsObject())
    return out
  } finally {
    stmt.free()
  }
}

function makeStmt(sql, params) {
  return {
    __sql: sql,
    __params: params,
    bind: (...args) => makeStmt(sql, args),
    first: async (col) => {
      const row = exec(sql, params)[0]
      if (!row) return null
      return col ? (row[col] ?? null) : row
    },
    all: async () => ({ results: exec(sql, params), success: true, meta: {} }),
    run: async () => ({ results: exec(sql, params), success: true, meta: {} }),
  }
}

const D1 = {
  prepare: (sql) => makeStmt(sql, []),
  batch: async (stmts) => {
    const out = []
    for (const s of stmts) out.push({ results: exec(s.__sql, s.__params), success: true, meta: {} })
    return out
  },
}

/* ============================================================
   3. R2 替身（内存），并把对象通过 /media/<key> 暴露出来
   ============================================================ */

const objects = new Map()

const R2 = {
  async put(key, value, options) {
    // value 是 ReadableStream，读成 Buffer 存起来
    const chunks = []
    const reader = value.getReader()
    for (;;) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(chunk))
    }
    objects.set(key, {
      body: Buffer.concat(chunks),
      contentType: options?.httpMetadata?.contentType ?? 'application/octet-stream',
      cacheControl: options?.httpMetadata?.cacheControl ?? '',
    })
    console.log(`  [R2] put ${key} (${Buffer.concat(chunks).length} bytes)`)
    return { key }
  },
  async get(key) {
    return objects.get(key) ?? null
  },
}

/* ============================================================
   4. 路由匹配与请求分发
   ============================================================ */

/** 把路由模式编译成正则 + 参数名 */
const compiled = ROUTES.map(({ route, mod }) => {
  const names = []
  const pattern = route
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        names.push(seg.slice(1))
        return '([^/]+)'
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { route, mod, re: new RegExp(`^${pattern}$`), names }
})

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const path = decodeURIComponent(url.pathname)

  // 本地媒体：把 R2 里的对象直接吐出来，方便验证上传后的预览
  if (path.startsWith('/media/')) {
    const key = path.slice('/media/'.length)
    const obj = objects.get(key)
    if (!obj) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, { 'Content-Type': obj.contentType })
    res.end(obj.body)
    return
  }

  // 匹配 Functions 路由
  for (const c of compiled) {
    const m = c.re.exec(path)
    if (!m) continue

    const params = {}
    c.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])))

    const method = (req.method ?? 'GET').toUpperCase()
    const exportName =
      method === 'GET' ? 'onRequestGet'
      : method === 'POST' ? 'onRequestPost'
      : method === 'PUT' ? 'onRequestPut'
      : method === 'DELETE' ? 'onRequestDelete'
      : method === 'OPTIONS' ? 'onRequestOptions'
      : null

    const handler = exportName ? c.mod[exportName] : undefined
    if (!handler) {
      // 该路由存在但不支持这个方法
      if (c.mod.onRequestGet || c.mod.onRequestPost) {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: `方法 ${method} 不被支持` }))
        return
      }
      continue
    }

    // 读 body（FormData 与 JSON 都要原样传给 handler）
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const bodyBuf = Buffer.concat(chunks)

    const request = new Request(url.href, {
      method,
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '')]),
      ),
      body: ['GET', 'HEAD'].includes(method) ? undefined : bodyBuf,
    })

    const waits = []
    const ctx = {
      env: {
        DB: D1,
        BUCKET: R2,
        // 先铺 wrangler.toml 的 [vars]（与线上同一份配置）与 .dev.vars（本地密钥），
        // 再用本地专用值覆盖 —— 顺序不能反
        ...WRANGLER_VARS,
        ...DEV_VARS,
        // 本地始终用 localhost：否则上传返回的 URL 会指向线上域名
        SITE_URL: `http://localhost:${PORT}`,
        MEDIA_URL: `http://localhost:${PORT}/media`,
        ADMIN_PEPPER: DEV_VARS.ADMIN_PEPPER || 'local-dev-pepper',
      },
      request,
      params,
      waitUntil: (p) => waits.push(p),
      next: async () => new Response('next'),
      data: {},
    }

    try {
      const response = await handler(ctx)
      await Promise.allSettled(waits)
      const headers = {}
      response.headers.forEach((v, k) => (headers[k] = v))
      const buf = Buffer.from(await response.arrayBuffer())
      res.writeHead(response.status, headers)
      res.end(buf)
    } catch (e) {
      console.error('  [handler error]', e)
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: String(e?.message ?? e) }))
    }
    return
  }

  // 静态资源
  if (!existsSync(distDir)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('dist/ 不存在，请先执行 npm run build')
    return
  }

  let filePath = join(distDir, path)
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    // no-store：本地开发服务器必须保证「重新构建 → 刷新就是新代码」。
    // 不加这个头时浏览器会启发式缓存 index.html，于是重启服务器后
    // 页面还在跑旧 bundle —— 会让人误以为「改了没生效」而白查半天。
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(readFileSync(filePath))
    return
  }

  // SPA 回退
  const indexPath = join(distDir, 'index.html')
  if (existsSync(indexPath)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(readFileSync(indexPath))
    return
  }

  res.writeHead(404).end('not found')
})

mkdirSync(here, { recursive: true })
server.listen(PORT, () => {
  console.log('')
  console.log(`  本地开发服务器已启动（Pages + D1 + R2 替身）`)
  console.log(`  → http://localhost:${PORT}/`)
  console.log(`  → 后台登录：http://localhost:${PORT}/admin/login`)
  console.log('')
  console.log(`  已注册 ${ROUTES.length} 条 Functions 路由，数据来自 db/schema.sql + seed.sql`)
  console.log('  数据库在内存里，重启即回到初始数据')

  // 评论登录是唯一「需要额外配置才会出现」的功能，启动时直接说清楚，
  // 免得对着「评论还没开启」反复排查
  if (WRANGLER_VARS.GITHUB_CLIENT_ID && DEV_VARS.GITHUB_CLIENT_SECRET) {
    console.log('')
    console.log('  评论登录：已启用（GitHub OAuth）')
    console.log(`  → 记得把 OAuth App 的回调地址设为 http://localhost:${PORT}/api/auth/github/callback`)
  } else {
    console.log('')
    console.log('  评论登录：未配置 —— 评论区会显示「评论还没开启」')
    console.log('  → 想本地测评论：把 GITHUB_CLIENT_ID 填进 site/wrangler.toml 的 [vars]，')
    console.log('     再把 GITHUB_CLIENT_SECRET 写进 site/.dev.vars（见 site/.dev.vars.example）')
  }
  console.log('')
})
