/**
 * POST /api/admin/logout — 退出登录
 * 删除服务端会话记录并清掉 Cookie。
 * 用服务端会话而不是纯 JWT，好处就是登出能立即生效。
 */

import type { Handler } from '../../_lib/context'
import { buildLogoutCookie, destroySession } from '../../_lib/auth'
import { json, preflight } from '../../_lib/http'

export const onRequestOptions: Handler = () => preflight()

export const onRequestPost: Handler = async ({ env, request }) => {
  await destroySession(env, request)
  return json({ ok: true }, { headers: { 'Set-Cookie': buildLogoutCookie(request) } })
}
