/**
 * GET /api/auth/github — 开始 GitHub 登录
 * ------------------------------------------------------------
 * 302 到 GitHub 的授权页，同时下发两个 HttpOnly cookie：
 *   · mb_oauth_state —— 随机 state，回调时定长比较（防登录 CSRF）
 *   · mb_oauth_next  —— 登录成功后跳回哪个站内页面
 *
 * 未配置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 时返回 503，
 * 前端会隐藏登录入口，所以正常用户看不到这个错误。
 */

import type { Handler } from '../../_lib/context'
import { fail } from '../../_lib/http'
import { buildCookie, randomHex } from '../../_lib/auth'
import {
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  callbackUrl,
  oauthConfigured,
  safeNext,
} from '../../_lib/oauth'

export const onRequestGet: Handler = async ({ env, request }) => {
  if (!oauthConfigured(env)) {
    return fail('本站尚未配置 GitHub 登录（缺少 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET）', 503)
  }

  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('redirect'))
  const state = randomHex(16)

  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', (env.GITHUB_CLIENT_ID ?? '').trim())
  authorize.searchParams.set('redirect_uri', callbackUrl(request))
  // 只读用户公开资料，不碰仓库（权限越小越好）
  authorize.searchParams.set('scope', 'read:user')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('allow_signup', 'true')

  const headers = new Headers({ Location: authorize.toString() })
  headers.append('Set-Cookie', buildCookie(OAUTH_STATE_COOKIE, state, request, OAUTH_COOKIE_MAX_AGE))
  headers.append('Set-Cookie', buildCookie(OAUTH_NEXT_COOKIE, next, request, OAUTH_COOKIE_MAX_AGE))

  return new Response(null, { status: 302, headers })
}
