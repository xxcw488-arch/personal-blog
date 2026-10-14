/**
 * GET /api/wp/albums — 相册列表（含图片数）
 * 一条 GROUP BY 查询取回全部相册与图片数。
 */

import type { Album } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep, toAlbum, type AlbumRow } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT a.id, a.slug, a.title, a.description, a.cover,
              a.location, a.taken_at, a.is_featured,
              COUNT(ai.id) AS image_count
         FROM albums a
         LEFT JOIN album_images ai ON ai.album_id = a.id
        GROUP BY a.id, a.slug, a.title, a.description, a.cover,
                 a.location, a.taken_at, a.is_featured, a.sort_order
        ORDER BY a.is_featured DESC, a.sort_order ASC, a.id ASC`,
    ).all<AlbumRow>()

    const albums: Album[] = (res.results ?? []).map((r) => toAlbum(r))
    return cachedJson(albums, 300)
  } catch (e) {
    return fail(`查询相册失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
