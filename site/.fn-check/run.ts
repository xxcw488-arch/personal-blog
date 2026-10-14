/**
 * 对 Pages Functions 的真实 handler 做端到端断言。
 * 由 verify.mjs 用 esbuild 打包后交给 Node 运行。
 */

import { createTestDb, makeContext, callJson, queryOne } from './harness'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { onRequestGet as listPosts } from '../functions/api/wp/posts'
import { onRequestGet as getPost } from '../functions/api/wp/posts/[slug]'
import { onRequestGet as getAdjacent } from '../functions/api/wp/posts/[slug]/adjacent'
import { onRequestGet as getRelated } from '../functions/api/wp/posts/[slug]/related'
import { onRequestGet as listTags } from '../functions/api/wp/tags'
import { onRequestGet as listPostDates } from '../functions/api/wp/post-dates'
import { onRequestGet as listCategories } from '../functions/api/wp/categories'
import { onRequestGet as getSettings } from '../functions/api/wp/settings'
import { onRequestGet as listAlbums } from '../functions/api/wp/albums'
import { onRequestGet as getAlbum } from '../functions/api/wp/albums/[slug]'
import { onRequestGet as listMoments } from '../functions/api/wp/moments'
import { onRequestGet as listMusic } from '../functions/api/wp/music'
import { onRequestGet as listProjects } from '../functions/api/wp/projects'
import { onRequestGet as listLinks } from '../functions/api/wp/links'
import { onRequestGet as doSearch } from '../functions/api/wp/search'
import { onRequestGet as feed } from '../functions/feed.xml'
import { onRequestGet as sitemap } from '../functions/sitemap.xml'
import {
  onRequestGet as listGuestbook,
  onRequestPost as postGuestbook,
} from '../functions/api/guestbook'
import { runAdminTests } from './admin'
import { runCommentTests, runStatsTests } from './comments'

/**
 * 仓库根目录。
 * ------------------------------------------------------------
 * ⚠️ 这里以前写死成绝对路径 —— 本地能跑，一上 GitHub Actions
 * （ubuntu runner）就找不到 db/schema.sql，verify:api 直接失败。
 * 改成从本文件位置往上推两级：`<repo>/site/.fn-check/run.ts`（或打包后的
 * `run.bundle.mjs`）→ `<repo>`，任何机器、任何检出目录都成立。
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = 'https://blog.test'

let pass = 0
let fail = 0

function ok(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${extra ? '  → ' + extra : ''}`)
  }
}

const db = await createTestDb(`${ROOT}/db/schema.sql`, `${ROOT}/db/seed.sql`)

/** 把生成的 XML 落盘，交给外部 XML 解析器做合法性校验 */
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'out')
mkdirSync(OUT_DIR, { recursive: true })
function dumpXml(name: string, xml: string) {
  writeFileSync(join(OUT_DIR, name), xml, 'utf8')
  return join(OUT_DIR, name)
}

/** 每次调用都新建 context（模拟独立请求） */
const call = (handler: never, opts: Parameters<typeof makeContext>[1]) =>
  callJson(handler as never, makeContext(db, opts))

console.log('\n=== GET /api/wp/posts（列表）===')
{
  const r = await call(listPosts as never, { url: `${BASE}/api/wp/posts` })
  const b = r.body as { items: unknown[]; total: number; page: number; totalPages: number }
  ok('状态码 200', r.status === 200, `got ${r.status}`)
  ok('total = 8', b.total === 8, `got ${b.total}`)
  ok('返回 8 条', b.items.length === 8, `got ${b.items.length}`)
  ok('page = 1', b.page === 1)

  const first = b.items[0] as Record<string, unknown>
  ok('含分类对象', typeof first.category === 'object' && first.category !== null)
  ok('含标签数组', Array.isArray(first.tags))
  ok('置顶排在最前 (isTop)', first.isTop === true)
  ok('列表不含正文 content（省流量）', !('content' in first))
  ok('有缓存头 s-maxage', (r.headers.get('Cache-Control') ?? '').includes('s-maxage'))

  // 回归：浏览器这一层不能留缓存余地。
  // 只写 s-maxage 时浏览器会启发式缓存；带 stale-while-revalidate 时
  // Chrome 会先吐过期旧数据 —— 两者都会造成「后台改了状态，站点还是旧的」。
  const cc = r.headers.get('Cache-Control') ?? ''
  ok('含 max-age=0（浏览器必须回源）', cc.includes('max-age=0'), cc)
  ok('含 must-revalidate', cc.includes('must-revalidate'), cc)
  ok('不含 stale-while-revalidate（否则 Chrome 会先返回旧数据）',
    !cc.includes('stale-while-revalidate'), cc)
}

console.log('\n=== GET /api/wp/posts?perPage=3（分页）===')
{
  const r = await call(listPosts as never, { url: `${BASE}/api/wp/posts?perPage=3` })
  const b = r.body as { items: unknown[]; totalPages: number }
  ok('每页 3 条', b.items.length === 3)
  ok('总页数 3（8 篇 / 3）', b.totalPages === 3, `got ${b.totalPages}`)

  const r2 = await call(listPosts as never, { url: `${BASE}/api/wp/posts?perPage=3&page=3` })
  const b2 = r2.body as { items: unknown[]; page: number }
  ok('第 3 页有 2 条', b2.items.length === 2, `got ${b2.items.length}`)
  ok('page 回显 3', b2.page === 3)
}

console.log('\n=== GET /api/wp/posts?tag=frontend（标签筛选）===')
{
  const r = await call(listPosts as never, { url: `${BASE}/api/wp/posts?tag=frontend` })
  const b = r.body as { items: { tags: { slug: string }[] }[]; total: number }
  ok('有结果', b.total > 0, `got ${b.total}`)
  ok(
    '每条都带 frontend 标签',
    b.items.every((p) => p.tags.some((t) => t.slug === 'frontend')),
  )
}

console.log('\n=== GET /api/wp/posts?q=Cloudflare（搜索）===')
{
  const r = await call(listPosts as never, { url: `${BASE}/api/wp/posts?q=Cloudflare` })
  const b = r.body as { total: number }
  ok('能搜到', b.total >= 1, `got ${b.total}`)
}

console.log('\n=== 回归：文章「类型」已移除（只剩分类 + 标签）===')
{
  const r = await call(listPosts as never, { url: `${BASE}/api/wp/posts` })
  const first = (r.body as { items: Record<string, unknown>[] }).items[0]
  ok('列表不再返回 type 字段', first !== undefined && !('type' in first))

  // 用另一篇文章验证详情路径：读详情会让阅读量自增，
  // 而下面有针对第一篇文章「自增前后」的断言，不能在这里抢先读它
  const detail = await call(getPost as never, {
    url: `${BASE}/api/wp/posts/building-a-serverless-comment-system`,
    params: { slug: 'building-a-serverless-comment-system' },
  })
  ok('详情也不再返回 type 字段', !('type' in (detail.body as Record<string, unknown>)))

  // 旧参数已移除：传了也只是被忽略，不再返回 400
  const legacy = await call(listPosts as never, { url: `${BASE}/api/wp/posts?type=bogus` })
  ok('旧的 ?type= 参数被忽略（200，而不是 400）', legacy.status === 200, `got ${legacy.status}`)
}

console.log('\n=== GET /api/wp/posts/:slug（详情）===')
{
  const ctx = makeContext(db, {
    url: `${BASE}/api/wp/posts/why-i-built-a-magazine-style-blog`,
    params: { slug: 'why-i-built-a-magazine-style-blog' },
  })
  const r = await callJson(getPost as never, ctx)
  const b = r.body as Record<string, unknown>
  ok('状态码 200', r.status === 200, `got ${r.status}`)
  ok('含正文 content', typeof b.content === 'string' && (b.content as string).length > 100)
  ok('含标签', Array.isArray(b.tags) && (b.tags as unknown[]).length > 0)
  // 接口返回的是「读到的」阅读量；自增通过 waitUntil 异步落库，作用于下一次请求
  ok('返回自增前的阅读量 1284', b.views === 1284, `got ${b.views}`)

  // 等 waitUntil 里的自增任务跑完，确认真的写进了数据库
  await ctx.drain()
  const row = queryOne(db, "SELECT views FROM posts WHERE slug = 'why-i-built-a-magazine-style-blog'")
  ok('阅读量已异步写回数据库（1284 → 1285）', row?.views === 1285, `got ${String(row?.views)}`)

  const miss = await call(getPost as never, {
    url: `${BASE}/api/wp/posts/nope`,
    params: { slug: 'nope' },
  })
  ok('不存在的 slug 返回 404', miss.status === 404, `got ${miss.status}`)
}

console.log('\n=== GET /api/wp/tags ===')
{
  const r = await call(listTags as never, { url: `${BASE}/api/wp/tags` })
  const b = r.body as { name: string; count: number }[]
  ok('状态码 200', r.status === 200)
  ok('有标签', b.length > 0)
  ok('都带 count 且 > 0', b.every((t) => typeof t.count === 'number' && t.count > 0))
  ok(
    '按 count 降序',
    b.every((t, i) => i === 0 || (b[i - 1] as { count: number }).count >= t.count),
  )
}

console.log('\n=== GET /api/wp/post-dates（发布日历）===')
{
  const r = await call(listPostDates as never, { url: `${BASE}/api/wp/post-dates` })
  const b = r.body as { date: string; count: number }[]
  ok('状态码 200', r.status === 200)
  ok('返回数组', Array.isArray(b))
  ok('有发布日期', b.length > 0, `got ${b.length}`)
  ok(
    '日期都是 YYYY-MM-DD',
    b.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)),
  )
  ok('篇数都是正整数', b.every((d) => Number.isInteger(d.count) && d.count > 0))
  ok(
    '按日期升序',
    b.every((d, i) => i === 0 || b[i - 1].date <= d.date),
  )
  // 日历按日期取标记，重复日期会让同一天的点算两次
  ok('日期不重复', new Set(b.map((d) => d.date)).size === b.length)

  /* 边界：草稿 / 软删不该点亮日历。
     同时插一条已发布做正对照 —— 否则「日期不在结果里」也可能只是接口整体没数据。 */
  db.run(
    "INSERT INTO posts (slug, title, status, published_at) VALUES ('fn-check-draft', '日历断言：草稿', 'draft', '2099-01-01 00:00:00')",
  )
  db.run(
    "INSERT INTO posts (slug, title, status, published_at, deleted_at) VALUES ('fn-check-deleted', '日历断言：已删', 'published', '2099-01-02 00:00:00', '2099-01-03 00:00:00')",
  )
  db.run(
    "INSERT INTO posts (slug, title, status, published_at) VALUES ('fn-check-live', '日历断言：已发布', 'published', '2099-02-02 00:00:00')",
  )
  const r2 = await call(listPostDates as never, { url: `${BASE}/api/wp/post-dates` })
  const b2 = r2.body as { date: string; count: number }[]
  const days = new Map(b2.map((d) => [d.date, d.count]))
  ok('正对照：已发布的日期会点亮', days.get('2099-02-02') === 1, `got ${days.get('2099-02-02')}`)
  ok('草稿不点亮日历', !days.has('2099-01-01'))
  ok('软删的文章不点亮日历', !days.has('2099-01-02'))
  db.run("DELETE FROM posts WHERE slug LIKE 'fn-check-%'")
}

console.log('\n=== GET /api/wp/settings ===')
{
  const r = await call(getSettings as never, { url: `${BASE}/api/wp/settings` })
  const b = r.body as Record<string, unknown>
  ok('状态码 200', r.status === 200)
  ok('siteName = 纸上', b.siteName === '纸上', `got ${String(b.siteName)}`)
  ok('chatEnabled 是布尔值', typeof b.chatEnabled === 'boolean')
  ok('social 已解析成对象', typeof b.social === 'object' && b.social !== null)
}

console.log('\n=== GET /api/guestbook（留言板）===')
{
  const r = await call(listGuestbook as never, { url: `${BASE}/api/guestbook` })
  const b = r.body as { nickname: string; reply: string; isFriendLinkApply?: boolean }[]
  ok('状态码 200', r.status === 200)
  ok('有 seed 留言', b.length === 1, `got ${b.length}`)
  ok('站长回复已返回', b[0]?.reply === '欢迎，随便坐。')
}

console.log('\n=== POST /api/guestbook（发布）===')
{
  const r = await call(postGuestbook as never, {
    url: `${BASE}/api/guestbook`,
    method: 'POST',
    body: { nickname: '测试访客', content: '这是接口测试留言。' },
  })
  const b = r.body as { id: number; nickname: string; content: string }
  ok('返回 201', r.status === 201, `got ${r.status}`)
  ok('昵称正确', b.nickname === '测试访客')
  ok('内容正确', b.content === '这是接口测试留言。')

  const list = await call(listGuestbook as never, { url: `${BASE}/api/guestbook` })
  const lb = list.body as { content: string }[]
  ok('新留言出现在列表最前', lb[0]?.content === '这是接口测试留言。')
  ok('列表变 2 条', lb.length === 2, `got ${lb.length}`)

  const apply = await call(postGuestbook as never, {
    url: `${BASE}/api/guestbook`,
    method: 'POST',
    body: { nickname: '申请者', content: '链接：https://example.com' },
  })
  const ab = apply.body as { isFriendLinkApply?: boolean }
  ok('含链接自动标记为友链申请', ab.isFriendLinkApply === true)
}

console.log('\n=== POST /api/guestbook（校验）===')
{
  const empty = await call(postGuestbook as never, {
    url: `${BASE}/api/guestbook`,
    method: 'POST',
    body: { nickname: 'x', content: '   ' },
  })
  ok('空内容 400', empty.status === 400, `got ${empty.status}`)

  const long = await call(postGuestbook as never, {
    url: `${BASE}/api/guestbook`,
    method: 'POST',
    body: { nickname: 'x', content: 'a'.repeat(501) },
  })
  ok('超 500 字 400', long.status === 400, `got ${long.status}`)

  const badJson = await callJson(postGuestbook as never, {
    ...makeContext(db, { url: `${BASE}/api/guestbook`, method: 'POST' }),
    request: new Request(`${BASE}/api/guestbook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
      body: '{ 这不是 json',
    }),
  })
  ok('非法 JSON 400', badJson.status === 400, `got ${badJson.status}`)

  const anon = await call(postGuestbook as never, {
    url: `${BASE}/api/guestbook`,
    method: 'POST',
    body: { content: '昵称留空应该变成匿名' },
  })
  const anonBody = anon.body as { nickname: string }
  ok('昵称留空 → 匿名', anonBody.nickname === '匿名', `got ${anonBody.nickname}`)
}

console.log('\n=== POST /api/guestbook（限流：每小时 5 条）===')
{
  // 前面已成功写入 4 条（测试访客 / 申请者 / 匿名 = 3，加上 seed 不算）
  // 再写 2 条，第 6 次应被限流
  let last = 0
  for (let i = 0; i < 4; i++) {
    const r = await call(postGuestbook as never, {
      url: `${BASE}/api/guestbook`,
      method: 'POST',
      body: { nickname: `压测${i}`, content: `第 ${i} 条压测留言` },
    })
    last = r.status
  }
  ok('超过阈值后返回 429', last === 429, `got ${last}`)
}

console.log('\n=== GET /api/wp/categories ===')
{
  const r = await call(listCategories as never, { url: `${BASE}/api/wp/categories` })
  const b = r.body as { name: string; count: number }[]
  ok('状态码 200', r.status === 200)
  ok('4 个分类', b.length === 4, `got ${b.length}`)
  ok('都带 count', b.every((c) => typeof c.count === 'number'))
  ok('count 之和 = 8 篇', b.reduce((s, c) => s + c.count, 0) === 8)
}

console.log('\n=== GET /api/wp/albums（含图片数）===')
{
  const r = await call(listAlbums as never, { url: `${BASE}/api/wp/albums` })
  const b = r.body as { slug: string; imageCount: number }[]
  ok('状态码 200', r.status === 200)
  ok('3 个相册', b.length === 3, `got ${b.length}`)
  ok('图片数合计 = 7', b.reduce((s, a) => s + a.imageCount, 0) === 7)
}

console.log('\n=== GET /api/wp/albums/:slug（含图片）===')
{
  const r = await call(getAlbum as never, {
    url: `${BASE}/api/wp/albums/old-town`,
    params: { slug: 'old-town' },
  })
  const b = r.body as { slug: string; images: unknown[]; imageCount: number }
  ok('状态码 200', r.status === 200)
  ok('返回 images 数组', Array.isArray(b.images))
  ok('old-town 有 3 张图', b.images.length === 3, `got ${b.images.length}`)
  ok('imageCount 与 images 一致', b.imageCount === b.images.length)

  const miss = await call(getAlbum as never, {
    url: `${BASE}/api/wp/albums/nope`,
    params: { slug: 'nope' },
  })
  ok('不存在返回 404', miss.status === 404, `got ${miss.status}`)
}

console.log('\n=== GET /api/wp/moments ===')
{
  const r = await call(listMoments as never, { url: `${BASE}/api/wp/moments` })
  const b = r.body as { content: string; images: string[] }[]
  ok('状态码 200', r.status === 200)
  ok('3 条碎碎念', b.length === 3, `got ${b.length}`)
  ok('images 已解析成数组', Array.isArray(b[0]?.images))
}

console.log('\n=== GET /api/wp/music ===')
{
  const r = await call(listMusic as never, { url: `${BASE}/api/wp/music` })
  const b = r.body as { title: string; audio: string }[]
  ok('状态码 200', r.status === 200)
  ok('2 首曲目', b.length === 2, `got ${b.length}`)
  ok('含音频直链', b.every((t) => typeof t.audio === 'string' && t.audio.length > 0))
}

console.log('\n=== GET /api/wp/projects ===')
{
  const r = await call(listProjects as never, { url: `${BASE}/api/wp/projects` })
  const b = r.body as { name: string; techStack: string[] }[]
  ok('状态码 200', r.status === 200)
  ok('2 个项目', b.length === 2, `got ${b.length}`)
  ok('techStack 已解析成数组', b.every((p) => Array.isArray(p.techStack)))
}

console.log('\n=== GET /api/wp/links（只返回已通过）===')
{
  const r = await call(listLinks as never, { url: `${BASE}/api/wp/links` })
  const b = r.body as { name: string; status: string }[]
  ok('状态码 200', r.status === 200)
  ok('1 条友链', b.length === 1, `got ${b.length}`)
  ok('全部是 approved', b.every((l) => l.status === 'approved'))

  // 插入一条 pending，确认不会出现在公开列表里
  db.run(
    "INSERT INTO friend_links (name, url, description, group_name, status, sort_order) VALUES ('待审站点', 'https://pending.example', 'x', '朋友', 'pending', 9)",
  )
  const r2 = await call(listLinks as never, { url: `${BASE}/api/wp/links` })
  const b2 = r2.body as unknown[]
  ok('pending 的友链不公开（仍为 1 条）', b2.length === 1, `got ${b2.length}`)
}

console.log('\n=== GET /api/wp/posts/:slug/adjacent ===')
{
  // 最新一篇：应该没有「上一篇」，但有「下一篇」
  const newest = await call(getAdjacent as never, {
    url: `${BASE}/api/wp/posts/why-i-built-a-magazine-style-blog/adjacent`,
    params: { slug: 'why-i-built-a-magazine-style-blog' },
  })
  const nb = newest.body as { prev: unknown; next: { slug: string } | null }
  ok('状态码 200', newest.status === 200)
  ok('最新一篇没有上一篇', nb.prev === null)
  ok('最新一篇有下一篇', nb.next !== null)

  // 最老一篇：应该有「上一篇」，没有「下一篇」
  const oldest = await call(getAdjacent as never, {
    url: `${BASE}/api/wp/posts/building-a-serverless-comment-system/adjacent`,
    params: { slug: 'building-a-serverless-comment-system' },
  })
  const ob = oldest.body as { prev: unknown; next: unknown }
  ok('最老一篇有上一篇', ob.prev !== null)
  ok('最老一篇没有下一篇', ob.next === null)
}

console.log('\n=== GET /api/wp/posts/:slug/related ===')
{
  const r = await call(getRelated as never, {
    url: `${BASE}/api/wp/posts/why-i-built-a-magazine-style-blog/related?limit=3`,
    params: { slug: 'why-i-built-a-magazine-style-blog' },
  })
  const b = r.body as { slug: string }[]
  ok('状态码 200', r.status === 200)
  ok('返回数组', Array.isArray(b))
  ok('不超过 limit', b.length <= 3, `got ${b.length}`)
  ok(
    '不包含自己',
    !b.some((p) => p.slug === 'why-i-built-a-magazine-style-blog'),
  )
}

console.log('\n=== GET /api/wp/search ===')
{
  const hit = await call(doSearch as never, { url: `${BASE}/api/wp/search?q=Cloudflare` })
  const hb = hit.body as unknown[]
  ok('状态码 200', hit.status === 200)
  ok('能搜到', hb.length >= 1, `got ${hb.length}`)

  const none = await call(doSearch as never, {
    url: `${BASE}/api/wp/search?q=zzzzz不存在的词`,
  })
  ok('搜不到时返回空数组', Array.isArray(none.body) && (none.body as unknown[]).length === 0)

  const noQ = await call(doSearch as never, { url: `${BASE}/api/wp/search` })
  ok('缺少 q 返回 400', noQ.status === 400, `got ${noQ.status}`)

  const tooLong = await call(doSearch as never, {
    url: `${BASE}/api/wp/search?q=${'a'.repeat(51)}`,
  })
  ok('关键词过长返回 400', tooLong.status === 400, `got ${tooLong.status}`)
}

console.log('\n=== GET /feed.xml ===')
{
  const r = await callJson(feed as never, makeContext(db, { url: `${BASE}/feed.xml` }))
  const xml = String(r.body)
  ok('状态码 200', r.status === 200)
  ok('Content-Type 是 RSS', (r.headers.get('Content-Type') ?? '').includes('rss+xml'))
  ok('是合法 XML 声明', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  ok('含 <rss version="2.0">', xml.includes('<rss version="2.0"'))
  ok('含 8 个 <item>', (xml.match(/<item>/g) ?? []).length === 8)
  ok('链接是绝对地址', xml.includes('<link>https://blog.test/article/'))
  ok('站点名从 D1 读取（纸上）', xml.includes('<title>纸上</title>'))
  dumpXml('feed.xml', xml)
}

console.log('\n=== GET /sitemap.xml ===')
{
  const r = await callJson(sitemap as never, makeContext(db, { url: `${BASE}/sitemap.xml` }))
  const xml = String(r.body)
  ok('状态码 200', r.status === 200)
  ok('Content-Type 是 XML', (r.headers.get('Content-Type') ?? '').includes('xml'))
  ok('含 urlset 命名空间', xml.includes('http://www.sitemaps.org/schemas/sitemap/0.9'))
  // 8 个静态页 + 8 篇文章 + 3 个相册 = 19
  ok('19 条 URL（8 静态 + 8 文章 + 3 相册）', (xml.match(/<loc>/g) ?? []).length === 19,
    `got ${(xml.match(/<loc>/g) ?? []).length}`)
  ok('文章链接已收录', xml.includes('/article/why-i-built-a-magazine-style-blog'))
  ok('相册链接已收录', xml.includes('/album/old-town'))
  ok('lastmod 是 YYYY-MM-DD', /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(xml))
  dumpXml('sitemap.xml', xml)
}

console.log('\n=== XML 转义（注入特殊字符的真实测试）===')
{
  // 种子数据里的引号是全角「」和“”，不需要转义，所以上面那条断言其实是空的。
  // 这里插入一条含 ASCII 特殊字符的文章，才能真正验证转义。
  const nasty = `A & B <tag> "quote" 'single'`
  db.run(
    `INSERT INTO posts (slug, title, excerpt, content, status, published_at, updated_at)
     VALUES ('xml-escape-test', ?, ?, 'x', 'published', datetime('now'), datetime('now'))`,
    [nasty, nasty],
  )

  const r = await callJson(feed as never, makeContext(db, { url: `${BASE}/feed.xml` }))
  const xml = String(r.body)

  ok('原文中的裸 & 不再出现', !xml.includes('A & B'))
  ok('& 转义成 &amp;', xml.includes('A &amp; B'))
  ok('< 转义成 &lt;', xml.includes('&lt;tag&gt;'))
  ok('双引号转义成 &quot;', xml.includes('&quot;quote&quot;'))
  ok('单引号转义成 &apos;', xml.includes('&apos;single&apos;'))
  dumpXml('feed-escaped.xml', xml)

  // 清理，避免影响其它断言
  db.run("DELETE FROM posts WHERE slug = 'xml-escape-test'")
}

console.log(`\n${'='.repeat(46)}`)
console.log(`公开接口与 XML：通过 ${pass} 项，失败 ${fail} 项`)
console.log('='.repeat(46))

/* ============================================================
   阶段 5：评论 + 访客统计（放在后台测试之前，两者互不干扰）
   ============================================================ */
await runCommentTests(db, ok)
await runStatsTests(db, ok)

console.log(`\n${'='.repeat(46)}`)
console.log(`含阶段 5：通过 ${pass} 项，失败 ${fail} 项`)
console.log('='.repeat(46))

/* ============================================================
   管理后台（放在最后，避免它创建的数据影响上面的计数断言）
   ============================================================ */
await runAdminTests(db, ok)

console.log(`\n${'='.repeat(46)}`)
console.log(`合计：通过 ${pass} 项，失败 ${fail} 项`)
console.log('='.repeat(46))
if (fail > 0) process.exitCode = 1
