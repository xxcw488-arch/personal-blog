/**
 * GET /api/wp/categories — 分类列表（含文章数）
 * 一条 GROUP BY 查询，不 N+1。
 */

import type { Category } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep, toCategory, type CategoryRow } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT c.id, c.name, c.slug, c.description, COUNT(p.id) AS count
         FROM categories c
         LEFT JOIN posts p ON p.category_id = c.id
              AND p.status = 'published' AND p.deleted_at IS NULL
        GROUP BY c.id, c.name, c.slug, c.description
        ORDER BY c.sort_order ASC, c.id ASC`,
    ).all<CategoryRow>()

    const categories: Category[] = (res.results ?? []).map(toCategory)
    return cachedJson(categories, 300)
  } catch (e) {
    return fail(`查询分类失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
