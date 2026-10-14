/**
 * GET /api/wp/moments — 碎碎念列表（最新在前）
 */

import type { Moment } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep, toMoment, type MomentRow } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT id, content, images, location, mood, likes, created_at
         FROM moments
        ORDER BY created_at DESC
        LIMIT 100`,
    ).all<MomentRow>()

    const moments: Moment[] = (res.results ?? []).map(toMoment)
    return cachedJson(moments, 120)
  } catch (e) {
    return fail(`查询碎碎念失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
