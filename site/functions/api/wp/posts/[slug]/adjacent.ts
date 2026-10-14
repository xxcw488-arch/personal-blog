/**
 * GET /api/wp/posts/:slug/adjacent — 上一篇 / 下一篇
 * ------------------------------------------------------------
 * 语义与前端一致：
 *   prev = 更新的一篇（发布时间更晚）
 *   next = 更早的一篇
 * 固定 3 条查询：先取当前文章的发布时间，再各取一条相邻。
 */

import type { Post } from '../../../../../src/types'
import type { Handler } from '../../../../_lib/context'
import { fail, notFound, preflight, json } from '../../../../_lib/http'
import { prep, toPostListItem, type PostRow } from '../../../../_lib/db'

/** 与列表接口一致的字段（不含正文） */
const SELECT_FIELDS = `p.id, p.slug, p.title, p.excerpt, p.cover, p.status,
                       p.views, p.reading_time, p.is_top, p.published_at, p.updated_at,
                       p.content_format,
                       c.id AS cat_id, c.name AS cat_name, c.slug AS cat_slug`

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, params }) => {
  const slug = String(params.slug ?? '').trim()
  if (!slug) return notFound('缺少文章 slug')

  try {
    const cur = await prep(
      env.DB,
      `SELECT p.id, p.published_at
         FROM posts p
        WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL
        LIMIT 1`,
      [slug],
    ).first<{ id: number; published_at: string }>()

    if (!cur) return notFound('文章不存在')

    // 更晚发布的 = 上一篇
    const prevRow = await prep(
      env.DB,
      `SELECT ${SELECT_FIELDS}
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'published' AND p.deleted_at IS NULL
          AND p.published_at > ?
        ORDER BY p.published_at ASC
        LIMIT 1`,
      [cur.published_at],
    ).first<PostRow>()

    // 更早发布的 = 下一篇
    const nextRow = await prep(
      env.DB,
      `SELECT ${SELECT_FIELDS}
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'published' AND p.deleted_at IS NULL
          AND p.published_at < ?
        ORDER BY p.published_at DESC
        LIMIT 1`,
      [cur.published_at],
    ).first<PostRow>()

    const toItem = (row: PostRow | null): Omit<Post, 'content'> | null =>
      row ? toPostListItem(row) : null

    return json({ prev: toItem(prevRow), next: toItem(nextRow) })
  } catch (e) {
    return fail(`查询相邻文章失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
