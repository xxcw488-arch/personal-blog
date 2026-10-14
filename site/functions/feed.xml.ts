/**
 * GET /feed.xml — RSS 2.0 订阅
 * ------------------------------------------------------------
 * 注意：这个文件在 functions/ 根下，所以路由是 /feed.xml（不在 /api/ 前缀内）。
 * 必须在 public/_routes.json 的 include 里显式声明，否则会被当成静态资源而 404。
 */

import type { Env, Handler } from './_lib/context'
import { fail } from './_lib/http'
import { prep } from './_lib/db'

interface FeedRow {
  slug: string
  title: string
  excerpt: string
  published_at: string
}

/** 一次取 20 篇，够订阅用；不做分页 */
const FEED_SIZE = 20

export const onRequestGet: Handler = async ({ env, request }) => {
  try {
    const base = siteBase(env, request)
    const res = await prep(
      env.DB,
      `SELECT p.slug, p.title, p.excerpt, p.published_at
         FROM posts p
        WHERE p.status = 'published' AND p.deleted_at IS NULL
        ORDER BY p.published_at DESC
        LIMIT ?`,
      [FEED_SIZE],
    ).all<FeedRow>()

    const rows = res.results ?? []
    const settings = await loadSiteMeta(env)

    const lastBuild = rows[0]?.published_at
      ? new Date(rows[0].published_at).toUTCString()
      : new Date().toUTCString()

    const items = rows
      .map((r) => {
        const url = `${base}/article/${encodeURIComponent(r.slug)}`
        return `    <item>
      <title>${esc(r.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${new Date(r.published_at).toUTCString()}</pubDate>
      <description>${esc(r.excerpt)}</description>
    </item>`
      })
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(settings.siteName)}</title>
    <link>${esc(base)}</link>
    <description>${esc(settings.tagline)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${esc(base)}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        // 订阅源给个中等缓存，避免爬虫频繁打库
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    })
  } catch (e) {
    return fail(`生成 RSS 失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

/* ============================================================
   辅助
   ============================================================ */

/**
 * 站点根地址。
 * wrangler.toml 里的 SITE_URL 是占位符时，回退到请求本身的 origin，
 * 这样在没配域名之前也能生成可用的绝对链接。
 */
function siteBase(env: Env, request: Request): string {
  const configured = (env.SITE_URL ?? '').trim()
  if (configured && !configured.includes('example.')) return configured.replace(/\/+$/, '')
  return new URL(request.url).origin
}

async function loadSiteMeta(env: Env): Promise<{ siteName: string; tagline: string }> {
  try {
    const res = await prep(
      env.DB,
      "SELECT key, value FROM site_settings WHERE key IN ('siteName', 'tagline')",
    ).all<{ key: string; value: string }>()
    const map = new Map((res.results ?? []).map((r) => [r.key, r.value]))
    return {
      siteName: map.get('siteName') || '个人博客',
      tagline: map.get('tagline') || '',
    }
  } catch {
    return { siteName: '个人博客', tagline: '' }
  }
}

/** XML 转义：& < > " ' 五个字符都要处理，否则标题里的引号会破坏文档结构 */
function esc(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
