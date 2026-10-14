/**
 * GitHub OAuth 公共部分
 * ============================================================
 * 流程（授权码模式）：
 *   ① 前端跳 /api/auth/github?redirect=/article/xxx
 *   ② 服务端 302 到 github.com/login/oauth/authorize，并下发 state cookie
 *   ③ GitHub 带 ?code=&state= 回调 /api/auth/github/callback
 *   ④ 服务端校验 state → 用 code 换 access_token → 读 /user
 *   ⑤ upsert users 表 → 建会话 → 下发 mb_user cookie → 302 回原页面
 *
 * 安全要点：
 *   · **state 必须校验**：否则攻击者能诱导受害者用攻击者的 GitHub 账号登录
 *     （登录 CSRF）。这里用「随机 state 存 HttpOnly cookie + 回调时定长比较」。
 *   · **access_token 不落库、不进 cookie**：只在回调那一次请求里用一下，
 *     之后一律用我们自己的会话 cookie。
 *   · client_secret 只存在于 Cloudflare Secret 里，绝不进 git。
 */

import type { Env } from './context'

export const OAUTH_STATE_COOKIE = 'mb_oauth_state'
export const OAUTH_NEXT_COOKIE = 'mb_oauth_next'

/** state / next cookie 的有效期：10 分钟，够走完一次授权 */
export const OAUTH_COOKIE_MAX_AGE = 600

/** GitHub OAuth 是否已配置（前端据此决定要不要显示登录按钮） */
export function oauthConfigured(env: Env): boolean {
  return Boolean((env.GITHUB_CLIENT_ID ?? '').trim() && (env.GITHUB_CLIENT_SECRET ?? '').trim())
}

/**
 * 回调地址。
 * ------------------------------------------------------------
 * **必须与 GitHub OAuth App 里填的 Callback URL 完全一致**，
 * 所以这里由请求自身的 origin 推导，而不是写死域名 ——
 * 这样 pages.dev 预览域名、自定义域名、本地开发都能用同一套代码。
 */
export function callbackUrl(request: Request): string {
  return `${new URL(request.url).origin}/api/auth/github/callback`
}

/**
 * 清洗登录后要跳回的地址。
 * 只接受站内相对路径，挡掉 `//evil.com`、`https://evil.com` 这类开放重定向。
 */
export function safeNext(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim()
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  if (value.includes('\\')) return '/'
  // 去掉可能的换行注入，并限制长度
  return value.replace(/[\r\n]/g, '').slice(0, 300) || '/'
}
