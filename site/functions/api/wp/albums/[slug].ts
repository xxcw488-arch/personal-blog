/**
 * GET /api/wp/albums/:slug — 相册详情（含图片列表）
 * 固定 2 条查询：相册主体 + 该相册的图片。
 */

import type { Album } from '../../../../src/types'
import type { Handler } from '../../../_lib/context'
import { fail, notFound, preflight, json } from '../../../_lib/http'
import { prep, toAlbum, type AlbumImageRow, type AlbumRow } from '../../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, params }) => {
  const slug = String(params.slug ?? '').trim()
  if (!slug) return notFound('缺少相册 slug')

  try {
    const album = await prep(
      env.DB,
      `SELECT a.id, a.slug, a.title, a.description, a.cover,
              a.location, a.taken_at, a.is_featured
         FROM albums a
        WHERE a.slug = ?
        LIMIT 1`,
      [slug],
    ).first<AlbumRow>()

    if (!album) return notFound('相册不存在')

    const imgRes = await prep(
      env.DB,
      `SELECT id, url, caption, width, height
         FROM album_images
        WHERE album_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [album.id],
    ).all<AlbumImageRow>()

    const images = imgRes.results ?? []
    const detail: Album = toAlbum({ ...album, image_count: images.length }, images)

    return json(detail)
  } catch (e) {
    return fail(`查询相册失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
