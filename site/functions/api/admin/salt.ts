/**
 * GET /api/admin/salt — 取登录用的 salt
 * ------------------------------------------------------------
 * 为什么需要这个接口：慢哈希在客户端做（见 _lib/auth.ts），
 * 而客户端必须先拿到 salt 才能开始推导 verifier。
 *
 * salt 本身不是秘密（它的作用是防彩虹表），所以公开返回是正常的。
 * 但它确实会暴露「这个用户名存在」—— 本站只有一个管理员，
 * 且 status 接口本来就会告知是否已初始化，所以不构成额外泄露。
 */

import type { Handler } from '../../_lib/context'
import { fail, json, notFound, preflight } from '../../_lib/http'
import { PBKDF2_ITERATIONS, unpackHash } from '../../_lib/auth'
import { prep } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, request }) => {
  const username = (new URL(request.url).searchParams.get('username') ?? '').trim()

  try {
    const row = await prep(
      env.DB,
      `SELECT username, password_hash
         FROM users
        WHERE role = 'admin' AND status = 'active'
          ${username ? 'AND username = ?' : ''}
        ORDER BY id ASC
        LIMIT 1`,
      username ? [username] : [],
    ).first<{ username: string; password_hash: string }>()

    if (!row) return notFound('后台尚未初始化')

    const parsed = unpackHash(row.password_hash)
    if (!parsed) return fail('管理员口令记录已损坏，请重新初始化', 500)

    return json({
      username: row.username,
      salt: parsed.salt,
      pbkdf2Iterations: PBKDF2_ITERATIONS,
      hashFormat: 'v1',
    })
  } catch (e) {
    return fail(`读取 salt 失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
