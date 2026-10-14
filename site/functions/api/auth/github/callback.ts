/**
 * GET /api/auth/github/callback — GitHub 回调
 * ------------------------------------------------------------
 * 做四件事：校验 state → 用 code 换 access_token → 读用户资料并 upsert
 * → 建会话、下发 mb_user cookie、跳回原页面。
 *
 * 注意：access_token 只在这次请求里用一下，**不落库、不进 cookie**。
 * 之后所有身份判断都靠我们自己的会话表。
 */

import type { Handler } from '../../../_lib/context'
import { fail } from '../../../_lib/http'
import {
  GITHUB_USER_PREFIX,
  buildUserCookie,
  clearCookie,
  constantTimeEqual,
  createSession,
  readCookie,
} from '../../../_lib/auth'
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  callbackUrl,
  oauthConfigured,
  safeNext,
} from '../../../_lib/oauth'
import { prep } from '../../../_lib/db'

/** GitHub /user 返回里我们真正用到的字段 */
interface GithubProfile {
  id?: number
  login?: string
  name?: string | null
  avatar_url?: string
  email?: string | null
}

interface TokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

const GH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'personal-blog',
} as const

export const onRequestGet: Handler = async ({ env, request }) => {
  const url = new URL(request.url)
  const next = safeNext(readCookie(request, OAUTH_NEXT_COOKIE))
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const ghError = url.searchParams.get('error')

  // 用户在 GitHub 上点了「取消」——这不是错误，安静地跳回去
  if (ghError) return redirectWith(withLoginFlag(next, 'denied'), request, [])

  if (!oauthConfigured(env)) {
    return fail('本站尚未配置 GitHub 登录（缺少 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET）', 503)
  }
  if (!code) return fail('缺少 code 参数', 400)

  /* ---------- ① 校验 state（防登录 CSRF） ---------- */
  const cookieState = readCookie(request, OAUTH_STATE_COOKIE)
  if (!state || !cookieState || !constantTimeEqual(state, cookieState)) {
    return fail('state 校验失败：可能是 CSRF 攻击或登录页停留过久，请重新登录', 400)
  }

  /* ---------- ② code 换 access_token ---------- */
  let accessToken = ''
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: (env.GITHUB_CLIENT_ID ?? '').trim(),
        client_secret: (env.GITHUB_CLIENT_SECRET ?? '').trim(),
        code,
        redirect_uri: callbackUrl(request),
      }),
    })
    const data = (await res.json()) as TokenResponse
    if (!data.access_token) {
      return fail(`GitHub 换取 token 失败：${data.error_description || data.error || '未知原因'}`, 502)
    }
    accessToken = data.access_token
  } catch (e) {
    return fail(`请求 GitHub 失败：${e instanceof Error ? e.message : '未知错误'}`, 502)
  }

  /* ---------- ③ 读用户资料 ---------- */
  let profile: GithubProfile
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { ...GH_HEADERS, Authorization: `Bearer ${accessToken}` },
    })
    profile = (await res.json()) as GithubProfile
  } catch (e) {
    return fail(`读取 GitHub 用户资料失败：${e instanceof Error ? e.message : '未知错误'}`, 502)
  }

  const providerUid = profile.id ? String(profile.id) : ''
  const login = (profile.login ?? '').trim()
  if (!providerUid || !login) return fail('GitHub 返回的用户资料不完整', 502)

  /* ---------- ④ upsert 用户 ---------- */
  const userId = await upsertGithubUser(env, {
    providerUid,
    // 加前缀避免与站长的管理员账号名撞车（users.username 是 UNIQUE）
    username: `${GITHUB_USER_PREFIX}${login}`,
    nickname: (profile.name ?? '').trim() || login,
    avatar: profile.avatar_url ?? '',
    email: (profile.email ?? '').trim() || null,
  })
  if (!userId) return fail('写入用户记录失败', 500)

  /* ---------- ⑤ 建会话并跳回 ---------- */
  const { token } = await createSession(env, userId, request)
  return redirectWith(next, request, [buildUserCookie(token, request)])
}

/* ============================================================
   辅助
   ============================================================ */

/**
 * 按 (provider, provider_uid) 找用户：有则更新资料，无则新建。
 * ------------------------------------------------------------
 * 为什么不用 `INSERT ... ON CONFLICT`：schema 里 idx_users_provider 是
 * **普通索引不是唯一索引**，没有可用的冲突目标。而且 email 是 UNIQUE，
 * GitHub 返回的邮箱可能与站长的管理员邮箱相同 —— 这种情况退化成不写邮箱。
 */
async function upsertGithubUser(
  env: Parameters<Handler>[0]['env'],
  u: { providerUid: string; username: string; nickname: string; avatar: string; email: string | null },
): Promise<number | null> {
  const existing = await prep(
    env.DB,
    'SELECT id FROM users WHERE provider = ? AND provider_uid = ? LIMIT 1',
    ['github', u.providerUid],
  ).first<{ id: number }>()

  if (existing) {
    try {
      await prep(
        env.DB,
        `UPDATE users
            SET username = ?, nickname = ?, avatar = ?, email = COALESCE(?, email),
                last_login_at = datetime('now')
          WHERE id = ?`,
        [u.username, u.nickname, u.avatar, u.email, existing.id],
      ).run()
    } catch {
      // 邮箱与别的账号冲突 → 放弃写邮箱，其余照常更新
      await prep(
        env.DB,
        `UPDATE users
            SET username = ?, nickname = ?, avatar = ?, last_login_at = datetime('now')
          WHERE id = ?`,
        [u.username, u.nickname, u.avatar, existing.id],
      ).run()
    }
    return existing.id
  }

  const insert = (email: string | null) =>
    prep(
      env.DB,
      `INSERT INTO users (username, email, password_hash, provider, provider_uid,
                          nickname, avatar, role, status, last_login_at)
       VALUES (?, ?, '', 'github', ?, ?, ?, 'user', 'active', datetime('now'))
       RETURNING id`,
      [u.username, email, u.providerUid, u.nickname, u.avatar],
    ).first<{ id: number }>()

  try {
    const created = await insert(u.email)
    return created?.id ?? null
  } catch {
    const created = await insert(null)
    return created?.id ?? null
  }
}

/** 302 跳转，顺带清掉 OAuth 临时 cookie */
function redirectWith(next: string, request: Request, cookies: string[]): Response {
  const headers = new Headers({ Location: next })
  for (const c of cookies) headers.append('Set-Cookie', c)
  headers.append('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE, request))
  headers.append('Set-Cookie', clearCookie(OAUTH_NEXT_COOKIE, request))
  return new Response(null, { status: 302, headers })
}

/** 在站内路径上追加 ?login=ok|denied，供前端提示用 */
function withLoginFlag(next: string, value: string): string {
  const u = new URL(next, 'https://placeholder.local')
  u.searchParams.set('login', value)
  return `${u.pathname}${u.search}${u.hash}`
}
