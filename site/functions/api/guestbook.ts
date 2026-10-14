/**
 * /api/guestbook — 留言板
 * ------------------------------------------------------------
 * GET  : 留言列表（最新在前）
 * POST : 发布留言
 *
 * 两道防线（前端校验可以被绕过，服务端必须自己再校验一次）：
 *   ① 长度与空值校验
 *   ② 按 IP 哈希的写入限流（默认每小时 5 条）
 *
 * 隐私：只存 IP 的 SHA-256 哈希，不存明文 IP。
 */

import type { GuestbookEntry, GuestbookInput } from '../../src/types'
import type { Env, Handler } from '../_lib/context'
import { badRequest, fail, json, preflight, readJson } from '../_lib/http'
import { prep, toGuestbookEntry, type GuestbookRow } from '../_lib/db'
import { getCurrentUser } from '../_lib/auth'

/** 与前端计数器保持一致 */
const MAX_LENGTH = 500
const MAX_NICKNAME = 24
/** 同一 IP 每小时最多发几条 */
const RATE_LIMIT_PER_HOUR = 5

export const onRequestOptions: Handler = () => preflight()

/* ============================================================
   GET：留言列表
   ============================================================ */

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT id, nickname, email, content, reply, status, created_at
         FROM guestbook
        WHERE status = 'approved'
        ORDER BY created_at DESC
        LIMIT 200`,
    ).all<GuestbookRow>()

    return json((res.results ?? []).map(toGuestbookEntry))
  } catch (e) {
    return fail(`读取留言失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

/* ============================================================
   POST：发布留言
   ============================================================ */

export const onRequestPost: Handler = async ({ env, request }) => {
  const body = await readJson<GuestbookInput>(request)
  if (!body) return badRequest('请求体不是合法的 JSON')

  // 已登录（GitHub）就用会话身份，昵称输入框只是未登录时的临时身份
  const user = await getCurrentUser(env, request)
  const nickname = user ? user.nickname : String(body.nickname ?? '').trim() || '匿名'
  const email = String(body.email ?? '').trim()
  const content = String(body.content ?? '').trim()

  /* ---------- ① 校验 ---------- */
  if (!content) return badRequest('留言内容不能为空')
  if (content.length > MAX_LENGTH) return badRequest(`留言最多 ${MAX_LENGTH} 字`)
  if (nickname.length > MAX_NICKNAME) return badRequest(`昵称最多 ${MAX_NICKNAME} 字`)

  /* ---------- ② 限流 ---------- */
  const ipHash = await hashIp(request, env)
  const limited = await checkRateLimit(env, ipHash)
  if (limited !== null) {
    return fail(`发言太频繁了，请 ${limited} 分钟后再试`, 429)
  }

  try {
    const created = await prep(
      env.DB,
      `INSERT INTO guestbook (nickname, email, content, status, ip_hash)
       VALUES (?, ?, ?, 'approved', ?)
       RETURNING id, nickname, email, content, reply, status, created_at`,
      [nickname, email, content, ipHash],
    ).first<GuestbookRow>()

    if (!created) return fail('留言写入失败', 500)

    const entry: GuestbookEntry = toGuestbookEntry(created)
    return json(entry, { status: 201 })
  } catch (e) {
    return fail(`发布留言失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

/* ============================================================
   辅助
   ============================================================ */

/**
 * 计算 IP 的哈希。
 * 注意：这里没有加盐（盐应该是只有服务端知道的 Secret）。
 * 因此它是「不可逆的假名」而非真正的匿名——等阶段 5 配置 Secret 后应换成加盐版本。
 */
async function hashIp(request: Request, _env: Env): Promise<string> {
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For') ??
    'unknown'
  const data = new TextEncoder().encode(ip)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 检查是否超限。
 * @returns 未超限返回 null；超限返回还需等待的分钟数
 */
async function checkRateLimit(env: Env, ipHash: string): Promise<number | null> {
  const now = Date.now()
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000
  const bucket = `guestbook:${hourStart}`
  const expiresAt = new Date(hourStart + 3_600_000).toISOString()

  try {
    const row = await prep(
      env.DB,
      `INSERT INTO rate_limits (bucket, key, count, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket, key) DO UPDATE SET count = count + 1
       RETURNING count`,
      [bucket, ipHash, expiresAt],
    ).first<{ count: number }>()

    const count = row?.count ?? 1
    if (count > RATE_LIMIT_PER_HOUR) {
      const minutesLeft = Math.max(1, Math.ceil((hourStart + 3_600_000 - now) / 60_000))
      return minutesLeft
    }
    return null
  } catch {
    // 限流表出问题时不应阻断正常留言（宁可放过，也不要因为限流组件故障全站不能留言）
    return null
  }
}
