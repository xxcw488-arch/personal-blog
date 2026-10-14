/**
 * 限流（基于 rate_limits 表）
 * ------------------------------------------------------------
 * 固定窗口计数：把时间按 windowMs 切成桶，桶名 + key 作为主键，
 * 用 ON CONFLICT 自增，一条 SQL 完成「读取并累加」。
 *
 * 设计取舍：
 *   · 固定窗口在边界处可能放过最多 2 倍流量，但对「防爆破 / 防刷屏」
 *     这种场景完全够用，且只需一条查询（免费版额度宝贵）。
 *   · **组件自身故障时不阻断业务**：限流表出问题就放行，
 *     宁可少一层防护，也不要因为限流挂掉整个功能。
 */

import type { Env } from './context'
import { prep } from './db'

export interface RateLimitResult {
  allowed: boolean
  /** 超限时还需等待的分钟数（至少 1） */
  retryAfterMinutes: number
}

/**
 * 累加一次并判断是否超限。
 * @param bucket    业务标识，如 'guestbook' / 'admin-login'
 * @param key       区分维度，通常是 IP 哈希
 * @param limit     窗口内允许的次数
 * @param windowMs  窗口长度（毫秒）
 */
export async function consumeRateLimit(
  env: Env,
  bucket: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const bucketKey = `${bucket}:${windowStart}`
  const expiresAt = new Date(windowStart + windowMs).toISOString()

  try {
    const row = await prep(
      env.DB,
      `INSERT INTO rate_limits (bucket, key, count, expires_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket, key) DO UPDATE SET count = count + 1
       RETURNING count`,
      [bucketKey, key, expiresAt],
    ).first<{ count: number }>()

    const count = row?.count ?? 1
    if (count > limit) {
      return {
        allowed: false,
        retryAfterMinutes: Math.max(1, Math.ceil((windowStart + windowMs - now) / 60_000)),
      }
    }
    return { allowed: true, retryAfterMinutes: 0 }
  } catch {
    // 限流组件故障 → 放行，不阻断业务
    return { allowed: true, retryAfterMinutes: 0 }
  }
}

/** 取客户端 IP 的 SHA-256 哈希（只存哈希，不存明文 IP） */
export async function clientIpHash(request: Request): Promise<string> {
  const ip =
    request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
