/**
 * GET /api/wp/music — 音乐列表
 * 按 sort_order 排；audio/cover 都是 R2 自定义域上的直链。
 */

import type { Music } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep, toMusic, type MusicRow } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT id, title, artist, album, audio, cover, lyrics, duration
         FROM music
        ORDER BY sort_order ASC, id ASC`,
    ).all<MusicRow>()

    const tracks: Music[] = (res.results ?? []).map(toMusic)
    return cachedJson(tracks, 300)
  } catch (e) {
    return fail(`查询音乐失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
