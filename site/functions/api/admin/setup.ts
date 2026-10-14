/**
 * POST /api/admin/setup — 首次初始化管理员
 * ------------------------------------------------------------
 * 只在「一个管理员都没有」时可用，之后永久关闭 —— 否则任何人都能
 * 通过这个接口重置后台口令。
 *
 * 客户端负责算 PBKDF2（见 _lib/auth.ts 顶部说明），这里只接收
 * salt 与 verifier，做一次廉价的 HMAC 后入库。
 */

import type { Handler } from '../../_lib/context'
import { badRequest, fail, json, preflight, readJson } from '../../_lib/http'
import {
  buildSessionCookie,
  createSession,
  makeVerifierHash,
  packHash,
  PBKDF2_ITERATIONS,
} from '../../_lib/auth'
import { prep } from '../../_lib/db'

interface SetupBody {
  username?: string
  nickname?: string
  salt?: string
  verifier?: string
}

export const onRequestOptions: Handler = () => preflight()

export const onRequestPost: Handler = async ({ env, request }) => {
  const body = await readJson<SetupBody>(request)
  if (!body) return badRequest('请求体不是合法的 JSON')

  const username = String(body.username ?? '').trim()
  const nickname = String(body.nickname ?? '').trim() || username
  const salt = String(body.salt ?? '').trim()
  const verifier = String(body.verifier ?? '').trim()

  /* ---------- 校验 ---------- */
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    return badRequest('用户名只能是 3-32 位的字母、数字、下划线或连字符')
  }
  // salt / verifier 都是 hex：salt 16 字节 = 32 字符，verifier 32 字节 = 64 字符
  if (!/^[0-9a-f]{32}$/.test(salt)) return badRequest('salt 格式不合法（应为 32 位十六进制）')
  if (!/^[0-9a-f]{64}$/.test(verifier)) {
    return badRequest('verifier 格式不合法（应为 64 位十六进制）')
  }

  try {
    /* ---------- 只在无管理员时可用 ---------- */
    const existing = await prep(
      env.DB,
      "SELECT COUNT(*) AS n FROM users WHERE role = 'admin'",
    ).first<{ n: number }>()

    if ((existing?.n ?? 0) > 0) {
      return fail('后台已经初始化过了，不能重复执行初始化', 403)
    }

    /* ---------- 写入 ---------- */
    const hash = await makeVerifierHash(env, verifier)
    const row = await prep(
      env.DB,
      `INSERT INTO users (username, nickname, password_hash, role, provider, status, email_verified)
       VALUES (?, ?, ?, 'admin', 'local', 'active', 0)
       RETURNING id, username, nickname, avatar, role`,
      [username, nickname, packHash(salt, hash)],
    ).first<{ id: number; username: string; nickname: string; avatar: string; role: string }>()

    if (!row) return fail('创建管理员失败', 500)

    // 建完直接登录，省一次输入
    const { token } = await createSession(env, row.id, request)

    return json(
      {
        user: {
          id: row.id,
          username: row.username,
          nickname: row.nickname,
          avatar: row.avatar,
          role: row.role,
        },
        pbkdf2Iterations: PBKDF2_ITERATIONS,
      },
      {
        status: 201,
        headers: { 'Set-Cookie': buildSessionCookie(token, request) },
      },
    )
  } catch (e) {
    return fail(`初始化失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
