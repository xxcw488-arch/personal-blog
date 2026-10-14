/**
 * GET /api/wp/posts/:slug — 文章详情
 * ------------------------------------------------------------
 * 固定 2 条查询：① 文章主体（含分类） ② 该文章的标签。
 * 阅读量用「写后不管」的方式自增，不阻塞响应。
 */

import type { Tag } from '../../../../src/types'
import type { Handler } from '../../../_lib/context'
import { fail, notFound, preflight } from '../../../_lib/http'
import { prep, toPost, type PostRow, type TagRow } from '../../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, params, waitUntil }) => {
  const slug = String(params.slug ?? '').trim()
  if (!slug) return notFound('缺少文章 slug')

  try {
    const row = await prep(
      env.DB,
      `SELECT p.id, p.slug, p.title, p.excerpt, p.content, p.content_format, p.cover,
              p.status, p.views, p.reading_time, p.is_top, p.allow_comment,
              p.published_at, p.updated_at,
              c.id AS cat_id, c.name AS cat_name, c.slug AS cat_slug
         FROM posts p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.slug = ?
          AND p.deleted_at IS NULL
          AND p.status = 'published'
        LIMIT 1`,
      [slug],
    ).first<PostRow>()

    if (!row) return notFound('文章不存在')

    const tagRes = await prep(
      env.DB,
      `SELECT pt.post_id, t.id, t.name, t.slug
         FROM post_tags pt
         JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = ?`,
      [row.id],
    ).all<TagRow>()

    const tags: Tag[] = (tagRes.results ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    }))

    // 阅读量自增：失败也不该影响正文返回，所以放在 waitUntil 里
    waitUntil(
      env.DB.prepare('UPDATE posts SET views = views + 1 WHERE id = ?')
        .bind(row.id)
        .run()
        .catch(() => undefined),
    )

    return preflightJson(toPost(row, tags))
  } catch (e) {
    return fail(`查询文章失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

/** 详情页不缓存（阅读量要实时），但仍带 CORS 头 */
function preflightJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
