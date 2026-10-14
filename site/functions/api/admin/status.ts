/**
 * GET /api/admin/status — 后台是否已初始化
 * 前端登录页据此决定显示「首次初始化」还是「登录」表单。
 */

import type { Handler } from '../../_lib/context'
import { json, fail, preflight } from '../../_lib/http'
import { PBKDF2_ITERATIONS } from '../../_lib/auth'
import { prep } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const row = await prep(
      env.DB,
      "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'",
    ).first<{ n: number }>()

    return json({
      initialized: (row?.n ?? 0) > 0,
      // 下发给前端，保证客户端与服务端的 KDF 参数一致
      pbkdf2Iterations: PBKDF2_ITERATIONS,
      hashFormat: 'v1',
    })
  } catch (e) {
    return fail(`读取后台状态失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
