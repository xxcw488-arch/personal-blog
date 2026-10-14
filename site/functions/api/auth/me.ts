/**
 * GET /api/auth/me — 当前登录用户
 * ------------------------------------------------------------
 * 前端启动时调一次：
 *   · user 为 null  → 显示「用 GitHub 登录后参与讨论」
 *   · githubEnabled 为 false → 连登录按钮都不显示（还没配 OAuth）
 */

import type { Handler } from '../../_lib/context'
import { fail, json, preflight } from '../../_lib/http'
import { getCurrentUser } from '../../_lib/auth'
import { oauthConfigured } from '../../_lib/oauth'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, request }) => {
  try {
    const user = await getCurrentUser(env, request)
    return json(
      {
        user: user
          ? {
              id: user.id,
              login: user.login,
              name: user.nickname,
              avatar: user.avatar,
              provider: user.provider,
              role: user.role,
            }
          : null,
        githubEnabled: oauthConfigured(env),
      },
      // 身份相关的响应绝不能被缓存，否则会串号
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return fail(`读取登录状态失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
