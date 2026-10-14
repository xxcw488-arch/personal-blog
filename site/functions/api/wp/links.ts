/**
 * GET /api/wp/links — 友链列表
 * 只返回审核通过的（status = 'approved'）；pending/rejected 只在后台可见。
 */

import type { FriendLink } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep, toFriendLink, type FriendLinkRow } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT id, name, url, avatar, description, group_name, status
         FROM friend_links
        WHERE status = 'approved'
        ORDER BY sort_order ASC, id ASC`,
    ).all<FriendLinkRow>()

    const links: FriendLink[] = (res.results ?? []).map(toFriendLink)
    return cachedJson(links, 300)
  } catch (e) {
    return fail(`查询友链失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
