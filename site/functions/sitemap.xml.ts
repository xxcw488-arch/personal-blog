/**
 * GET /sitemap.xml — 站点地图
 * ------------------------------------------------------------
 * 收录：静态页面 + 全部已发布文章 + 全部相册。
 * 同样在 functions/ 根下，需要在 public/_routes.json 里声明。
 */

import type { Env, Handler } from './_lib/context'
import { fail } from './_lib/http'
import { prep } from './_lib/db'

interface UrlRow {
  slug: string
  lastmod: string | null
}

/** 固定页面（与 src/router 的路由对齐） */
const STATIC_PATHS = ['/', '/article', '/album', '/moment', '/music', '/projects', '/links', '/about']

export const onRequestGet: Handler = async ({ env, request }) => {
  try {
    const base = siteBase(env, request)

    const [posts, albums] = await Promise.all([
      prep(
        env.DB,
        `SELECT slug, COALESCE(updated_at, published_at) AS lastmod
           FROM posts
          WHERE status = 'published' AND deleted_at IS NULL
          ORDER BY published_at DESC`,
      ).all<UrlRow>(),
      prep(
        env.DB,
        `SELECT slug, NULL AS lastmod FROM albums ORDER BY sort_order ASC`,
      ).all<UrlRow>(),
    ])

    const entries: string[] = []

    for (const p of STATIC_PATHS) {
      entries.push(urlEntry(`${base}${p}`, null, p === '/' ? '1.0' : '0.8'))
    }
    for (const row of posts.results ?? []) {
      entries.push(urlEntry(`${base}/article/${encodeURIComponent(row.slug)}`, row.lastmod, '0.7'))
    }
    for (const row of albums.results ?? []) {
      entries.push(urlEntry(`${base}/album/${encodeURIComponent(row.slug)}`, row.lastmod, '0.5'))
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (e) {
    return fail(`生成 sitemap 失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

/* ============================================================
   辅助
   ============================================================ */

function urlEntry(loc: string, lastmod: string | null, priority: string): string {
  const parts = [`    <loc>${esc(loc)}</loc>`]
  if (lastmod) parts.push(`    <lastmod>${toDate(lastmod)}</lastmod>`)
  parts.push(`    <priority>${priority}</priority>`)
  return `  <url>\n${parts.join('\n')}\n  </url>`
}

/** 把各种时间格式统一成 YYYY-MM-DD */
function toDate(value: string): string {
  const d = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'))
  if (Number.isNaN(d.getTime())) return value.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function siteBase(env: Env, request: Request): string {
  const configured = (env.SITE_URL ?? '').trim()
  if (configured && !configured.includes('example.')) return configured.replace(/\/+$/, '')
  return new URL(request.url).origin
}

function esc(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
