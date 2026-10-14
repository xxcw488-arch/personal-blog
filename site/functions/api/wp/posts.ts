/**
 * GET /api/wp/posts — 文章列表
 * ------------------------------------------------------------
 * 查询参数：page / perPage / tag / category / type / q / sort
 * 返回：{ items, page, perPage, total, totalPages }
 *
 * 性能要点（免费版单次调用只有 50 条查询额度）：
 *   固定 3 条查询，与页大小无关 —— ① 总数 ② 当前页文章 ③ 当前页的标签。
 *   标签用一次 IN 查询取回后在内存里归并，绝不逐篇查。
 */

import type { Tag } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { fail, preflight, cachedJson } from '../../_lib/http'
import {
  groupTagsByPost,
  inClause,
  prep,
  toPostListItem,
  type PostRow,
  type TagRow,
} from '../../_lib/db'

const DEFAULT_PER_PAGE = 8
const MAX_PER_PAGE = 50

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, request }) => {
  const url = new URL(request.url)
  const params = url.searchParams

  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const perPageRaw = Number(params.get('perPage') ?? DEFAULT_PER_PAGE) || DEFAULT_PER_PAGE
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageRaw))

  const tag = (params.get('tag') ?? '').trim()
  const category = (params.get('category') ?? '').trim()
  const q = (params.get('q') ?? '').trim()
  const sort = params.get('sort') === 'popular' ? 'popular' : 'latest'

  /* ---------- 动态 WHERE（全部参数化，不做字符串拼接） ---------- */
  const where: string[] = ['p.deleted_at IS NULL', "p.status = 'published'"]
  const binds: (string | number)[] = []

  if (category) {
    where.push('c.slug = ?')
    binds.push(category)
  }
  if (tag) {
    where.push(
      'EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.slug = ?)',
    )
    binds.push(tag)
  }
  if (q) {
    where.push('(p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)')
    const like = `%${q}%`
    binds.push(like, like, like)
  }

  const whereSql = where.join(' AND ')
  const orderSql =
    sort === 'popular' ? 'p.views DESC, p.published_at DESC' : 'p.is_top DESC, p.published_at DESC'

  try {
    /* ---------- ① 总数 ---------- */
    const countRow = await prep(
      env.DB,
      `SELECT COUNT(*) AS n
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${whereSql}`,
      binds,
    ).first<{ n: number }>()

    const total = countRow?.n ?? 0
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const safePage = Math.min(page, totalPages)
    const offset = (safePage - 1) * perPage

    /* ---------- ② 当前页文章 ---------- */
    const listRes = await prep(
      env.DB,
      `SELECT p.id, p.slug, p.title, p.excerpt, p.cover, p.status,
              p.views, p.reading_time, p.is_top, p.allow_comment,
              p.published_at, p.updated_at,
              p.content_format,
              c.id AS cat_id, c.name AS cat_name, c.slug AS cat_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ? OFFSET ?`,
      [...binds, perPage, offset],
    ).all<PostRow>()

    const rows = listRes.results ?? []
    const ids = rows.map((r) => r.id)

    /* ---------- ③ 当前页的标签（一次 IN 查询） ---------- */
    let tagMap = new Map<number, Tag[]>()
    if (ids.length > 0) {
      const { placeholders, binds: tagBinds } = inClause(ids)
      const tagRes = await prep(
        env.DB,
        `SELECT pt.post_id, t.id, t.name, t.slug
           FROM post_tags pt
           JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id IN (${placeholders})`,
        tagBinds,
      ).all<TagRow>()
      tagMap = groupTagsByPost(tagRes.results ?? [])
    }

    const items = rows.map((row) => toPostListItem(row, tagMap.get(row.id) ?? []))

    return cachedJson({ items, page: safePage, perPage, total, totalPages }, 60)
  } catch (e) {
    // 把底层错误暴露成可读信息，方便上线初期排查
    return fail(`查询文章列表失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
