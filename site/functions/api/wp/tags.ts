/**
 * GET /api/wp/tags — 标签列表（含文章数）
 * 一条 GROUP BY 查询搞定，不用 N+1。
 */

import type { Tag } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep } from '../../_lib/db'

interface TagCountRow {
  id: number
  name: string
  slug: string
  count: number
}

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT t.id, t.name, t.slug, COUNT(pt.post_id) AS count
         FROM tags t
         LEFT JOIN post_tags pt ON pt.tag_id = t.id
         LEFT JOIN posts p ON p.id = pt.post_id
              AND p.status = 'published' AND p.deleted_at IS NULL
        GROUP BY t.id, t.name, t.slug
       HAVING count > 0
        ORDER BY count DESC, t.id ASC`,
    ).all<TagCountRow>()

    const tags: Tag[] = (res.results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      count: r.count,
    }))

    return cachedJson(tags, 120)
  } catch (e) {
    return fail(`查询标签失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
