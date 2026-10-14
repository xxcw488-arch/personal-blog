/**
 * POST /api/admin/login — 管理员登录
 * ------------------------------------------------------------
 * 请求体：{ username, verifier }
 *   verifier 是客户端用 PBKDF2(password, salt, 600000) 推导出来的值，
 *   服务端只做一次 HMAC 比对（详见 _lib/auth.ts 顶部说明）。
 *
 * 两道防护：
 *   ① 按 IP 限流（15 分钟 10 次），防在线爆破
 *   ② 失败一律返回同一句提示，不区分「用户名不存在」和「口令错误」
 */

import type { Handler } from '../../_lib/context'
import { badRequest, fail, json, preflight, readJson } from '../../_lib/http'
import {
  buildSessionCookie,
  constantTimeEqual,
  createSession,
  makeVerifierHash,
  unpackHash,
} from '../../_lib/auth'
import { clientIpHash, consumeRateLimit } from '../../_lib/ratelimit'
import { prep } from '../../_lib/db'

/** 同一 IP 在 15 分钟内最多尝试多少次 */
const LOGIN_LIMIT = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

interface LoginBody {
  username?: string
  verifier?: string
}

export const onRequestOptions: Handler = () => preflight()

export const onRequestPost: Handler = async ({ env, request }) => {
  const body = await readJson<LoginBody>(request)
  if (!body) return badRequest('请求体不是合法的 JSON')

  const username = String(body.username ?? '').trim()
  const verifier = String(body.verifier ?? '').trim()

  if (!username || !verifier) return badRequest('缺少用户名或口令凭据')
  if (!/^[0-9a-f]{64}$/.test(verifier)) return badRequest('verifier 格式不合法')

  /* ---------- 限流 ---------- */
  const ipHash = await clientIpHash(request)
  const limit = await consumeRateLimit(env, 'admin-login', ipHash, LOGIN_LIMIT, LOGIN_WINDOW_MS)
  if (!limit.allowed) {
    return fail(`尝试过于频繁，请 ${limit.retryAfterMinutes} 分钟后再试`, 429)
  }

  try {
    const row = await prep(
      env.DB,
      `SELECT id, username, nickname, avatar, role, password_hash, status
         FROM users
        WHERE username = ? AND role = 'admin'
        LIMIT 1`,
      [username],
    ).first<{
      id: number
      username: string
      nickname: string
      avatar: string
      role: string
      password_hash: string
      status: string
    }>()

    // 统一的失败响应：不泄露用户名是否存在
    const deny = () => fail('用户名或口令不正确', 401)

    if (!row) return deny()
    if (row.status !== 'active') return fail('该账号已被停用', 403)

    const parsed = unpackHash(row.password_hash)
    if (!parsed) return fail('管理员口令记录已损坏，请重新初始化', 500)

    const computed = await makeVerifierHash(env, verifier)
    if (!constantTimeEqual(computed, parsed.hash)) return deny()

    /* ---------- 成功 ---------- */
    const { token } = await createSession(env, row.id, request)

    // 记录最近登录时间；失败不影响登录本身
    await prep(env.DB, `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [
      row.id,
    ]).run()

    return json(
      {
        user: {
          id: row.id,
          username: row.username,
          nickname: row.nickname,
          avatar: row.avatar,
          role: row.role,
        },
      },
      { headers: { 'Set-Cookie': buildSessionCookie(token, request) } },
    )
  } catch (e) {
    return fail(`登录失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
