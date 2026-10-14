/**
 * GET /api/wp/search?q=关键词 — 站内搜索
 * ------------------------------------------------------------
 * 标题 / 摘要 / 正文三处匹配。
 *
 * 注意：`LIKE '%词%'` 用不上索引（前置通配符），是全表扫描。
 * 免费版行读额度 500 万/天，个人博客的正文量级下够用，
 * 但**不要让它成为可被高频触发的昂贵操作** —— 所以：
 *   · 限制返回条数（默认 20，最多 50）
 *   · 关键词长度上限 50（同时也是 D1 对 LIKE 模式串 50 字节的限制）
 *   · 结果走短缓存，重复搜索由边缘吸收
 *
 * 返回结构与列表接口一致（不含正文），前端用同一套卡片渲染。
 */

import type { Post } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { badRequest, cachedJson, fail, preflight } from '../../_lib/http'
import {
  groupTagsByPost,
  inClause,
  prep,
  toPostListItem,
  type PostRow,
  type TagRow,
} from '../../_lib/db'

const MAX_KEYWORD = 50
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, request }) => {
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim()

  if (!q) return badRequest('缺少搜索关键词 q')
  if (q.length > MAX_KEYWORD) return badRequest(`关键词最多 ${MAX_KEYWORD} 个字符`)

  const limitRaw = Number(params.get('limit') ?? DEFAULT_LIMIT)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT))

  try {
    const like = `%${q}%`

    const res = await prep(
      env.DB,
      `SELECT p.id, p.slug, p.title, p.excerpt, p.cover, p.status,
              p.views, p.reading_time, p.is_top, p.published_at, p.updated_at,
              p.content_format,
              c.id AS cat_id, c.name AS cat_name, c.slug AS cat_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'published'
          AND p.deleted_at IS NULL
          AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
        ORDER BY p.is_top DESC, p.published_at DESC
        LIMIT ?`,
      [like, like, like, limit],
    ).all<PostRow>()

    const rows = res.results ?? []
    const ids = rows.map((r) => r.id)

    // 一次 IN 查询补上标签，避免逐篇查
    let tagMap = new Map<number, { id: number; name: string; slug: string }[]>()
    if (ids.length > 0) {
      const { placeholders, binds } = inClause(ids)
      const tagRes = await prep(
        env.DB,
        `SELECT pt.post_id, t.id, t.name, t.slug
           FROM post_tags pt
           JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id IN (${placeholders})`,
        binds,
      ).all<TagRow>()
      tagMap = groupTagsByPost(tagRes.results ?? [])
    }

    const items: Omit<Post, 'content'>[] = rows.map((r) => toPostListItem(r, tagMap.get(r.id) ?? []))
    return cachedJson(items, 60)
  } catch (e) {
    return fail(`搜索失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
