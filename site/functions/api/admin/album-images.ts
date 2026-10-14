/**
 * /api/admin/album-images — 相册图片列表（GET）/ 新增（POST）
 * 用 ?albumId= 过滤某个相册下的图片。
 */
import type { Handler } from '../../_lib/context'
import { adminPreflight, createHandler, rowToApi } from '../../_lib/crud'
import { albumImagesConfig } from '../../_lib/resources'
import { fail, json } from '../../_lib/http'
import { getSessionUser } from '../../_lib/auth'
import { prep } from '../../_lib/db'

export const onRequestOptions = adminPreflight

/** 列表：带 albumId 时按相册过滤（相册详情页要按顺序列出图片） */
export const onRequestGet: Handler = async ({ env, request }) => {
  const admin = await getSessionUser(env, request)
  if (!admin) return fail('未登录或登录已过期', 401)

  const albumId = Number(new URL(request.url).searchParams.get('albumId') ?? NaN)

  try {
    const where = Number.isFinite(albumId) ? 'WHERE album_id = ?' : ''
    const stmt = prep(
      env.DB,
      `SELECT * FROM album_images ${where} ORDER BY sort_order ASC, id ASC`,
      Number.isFinite(albumId) ? [albumId] : [],
    )
    const res = await stmt.all<Record<string, unknown>>()
    return json({ items: (res.results ?? []).map((r) => rowToApi(albumImagesConfig, r)) })
  } catch (e) {
    return fail(`查询相册图片失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

export const onRequestPost = createHandler(albumImagesConfig)
