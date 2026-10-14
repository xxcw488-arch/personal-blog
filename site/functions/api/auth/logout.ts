/**
 * POST /api/auth/logout — 退出登录
 * ------------------------------------------------------------
 * 只删当前会话（服务端会话的好处：登出立即生效，不像 JWT 要等过期）。
 * 注意用的是 mb_user cookie，**不会影响管理后台的登录状态**。
 */

import type { Handler } from '../../_lib/context'
import { fail, json, preflight } from '../../_lib/http'
import { USER_COOKIE, clearCookie, destroyUserSession } from '../../_lib/auth'

export const onRequestOptions: Handler = () => preflight()

export const onRequestPost: Handler = async ({ env, request }) => {
  try {
    await destroyUserSession(env, request)
    return json(
      { ok: true },
      { headers: { 'Set-Cookie': clearCookie(USER_COOKIE, request), 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return fail(`退出登录失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
