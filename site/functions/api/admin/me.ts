/**
 * GET /api/admin/me — 当前登录的管理员
 * 前端启动时用它判断登录态；未登录返回 401。
 */

import type { Handler } from '../../_lib/context'
import { getSessionUser } from '../../_lib/auth'
import { fail, json, preflight } from '../../_lib/http'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, request }) => {
  const admin = await getSessionUser(env, request)
  if (!admin) return fail('未登录或登录已过期', 401)
  return json({ user: admin })
}
