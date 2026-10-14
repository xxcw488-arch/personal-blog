/**
 * GET /api/wp/posts/:slug/related?limit=3 — 相关文章
 * ------------------------------------------------------------
 * 打分规则（与前端 mock 保持一致）：
 *   共同标签 ×2  +  同分类 ×1
 * 固定 2 条查询：① 取当前文章的分类与标签 ② 一次打分查询取回结果。
 * 全部在 SQL 里算分排序，不做多次往返。
 */

import type { Post } from '../../../../../src/types'
import type { Handler } from '../../../../_lib/context'
import { fail, notFound, preflight, json } from '../../../../_lib/http'
import { prep, toPostListItem, type PostRow } from '../../../../_lib/db'

const SELECT_FIELDS = `p.id, p.slug, p.title, p.excerpt, p.cover, p.status,
                       p.views, p.reading_time, p.is_top, p.published_at, p.updated_at,
                       p.content_format,
                       c.id AS cat_id, c.name AS cat_name, c.slug AS cat_slug`

const MAX_LIMIT = 12
const DEFAULT_LIMIT = 3

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, params, request }) => {
  const slug = String(params.slug ?? '').trim()
  if (!slug) return notFound('缺少文章 slug')

  const limitRaw = Number(new URL(request.url).searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT))

  try {
    const cur = await prep(
      env.DB,
      `SELECT p.id, p.category_id
         FROM posts p
        WHERE p.slug = ? AND p.status = 'published' AND p.deleted_at IS NULL
        LIMIT 1`,
      [slug],
    ).first<{ id: number; category_id: number | null }>()

    if (!cur) return notFound('文章不存在')

    // 一次查询完成打分与排序：共同标签数 ×2 + 同分类 ×1
    const res = await prep(
      env.DB,
      `SELECT ${SELECT_FIELDS},
              (
                CASE WHEN p.category_id = ?2 THEN 1 ELSE 0 END
                + COUNT(DISTINCT CASE WHEN pt.tag_id IN (
                    SELECT tag_id FROM post_tags WHERE post_id = ?1
                  ) THEN pt.tag_id END) * 2
              ) AS score
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN post_tags pt ON pt.post_id = p.id
        WHERE p.id != ?1
          AND p.status = 'published'
          AND p.deleted_at IS NULL
        GROUP BY p.id
       HAVING score > 0
        ORDER BY score DESC, p.published_at DESC
        LIMIT ?3`,
      [cur.id, cur.category_id ?? -1, limit],
    ).all<PostRow>()

    const related: Omit<Post, 'content'>[] = (res.results ?? []).map((r) => toPostListItem(r))
    return json(related)
  } catch (e) {
    return fail(`查询相关文章失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
