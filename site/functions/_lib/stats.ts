/**
 * 访客统计
 * ============================================================
 * 目标：在 D1 免费额度内统计 PV / UV / 在线人数。
 *
 * 额度约束（决定了这里的每个取舍）：
 *   · D1 免费版 **行写入 10 万/天** —— 所以 UV 必须按天去重，
 *     同一访客同一天只写一次 visitor_seen，而不是每次访问都写。
 *   · D1 免费版 **单次调用 50 条查询** —— 所以一次记录只发
 *     1 条读 + 1 个 batch（batch 里的语句共用一次调用）。
 *   · Pages Functions 免费版 **10 万请求/天** —— 所以记录接口
 *     一次调用就把最新统计一起返回，前端不必再多打一次。
 *
 * 隐私：只存 IP 的 SHA-256 哈希，不存明文 IP，也不存 User-Agent。
 */

import type { Env } from './context'
import { prep } from './db'

/** 在线判定窗口：5 分钟内有心跳就算在线 */
export const ONLINE_WINDOW_SECONDS = 300

/** 站点按东八区切「天」——否则 UTC 0 点时中国用户会看到统计归零 */
const DAY_OFFSET_MS = 8 * 3600_000

export interface StatsSnapshot {
  online: number
  todayPv: number
  todayUv: number
  totalPv: number
  totalUv: number
}

/** 当前「天」的键（东八区，YYYY-MM-DD） */
export function dayKey(nowMs: number = Date.now()): string {
  return new Date(nowMs + DAY_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * 是否是爬虫 / 监控流量。
 * 不计入统计，否则 RSS 阅读器和搜索引擎会把 PV 刷成噪声。
 * 注意：**空 User-Agent 仍然计入**（本地开发、部分命令行客户端会不带 UA）。
 */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|headlesschrome|curl|wget|python-requests|go-http-client|monitor|preview/i

export function isBot(request: Request): boolean {
  const ua = request.headers.get('User-Agent') ?? ''
  if (!ua) return false
  return BOT_PATTERN.test(ua)
}

/* ============================================================
   读
   ============================================================ */

/**
 * 读当前统计快照。
 * 两条查询：一条把「总量 + 今日」一次算出来，一条数在线人数。
 */
export async function readStats(env: Env, nowMs: number = Date.now()): Promise<StatsSnapshot> {
  const day = dayKey(nowMs)

  const totals = await prep(
    env.DB,
    `SELECT
       COALESCE(SUM(pv), 0)                                  AS totalPv,
       COALESCE(SUM(uv), 0)                                  AS totalUv,
       COALESCE(SUM(CASE WHEN day = ? THEN pv ELSE 0 END), 0) AS todayPv,
       COALESCE(SUM(CASE WHEN day = ? THEN uv ELSE 0 END), 0) AS todayUv
     FROM visitor_daily`,
    [day, day],
  ).first<{ totalPv: number; totalUv: number; todayPv: number; todayUv: number }>()

  const since = Math.floor(nowMs / 1000) - ONLINE_WINDOW_SECONDS
  const online = await prep(
    env.DB,
    'SELECT COUNT(*) AS online FROM visitor_online WHERE last_seen >= ?',
    [since],
  ).first<{ online: number }>()

  return {
    online: Number(online?.online ?? 0),
    todayPv: Number(totals?.todayPv ?? 0),
    todayUv: Number(totals?.todayUv ?? 0),
    totalPv: Number(totals?.totalPv ?? 0),
    totalUv: Number(totals?.totalUv ?? 0),
  }
}

/* ============================================================
   写
   ============================================================ */

/**
 * 记录一次访问。
 * ------------------------------------------------------------
 * @param ipHash 客户端 IP 的 SHA-256 哈希（由调用方用 clientIpHash 算好）
 * @param path   访问路径，只用于记录「当天首次落在哪一页」，不做逐条日志
 *
 * 写库策略：先读一次「今天这个访客来过没有」，再一个 batch 写三张表。
 *   · visitor_daily  —— pv 必加；uv 只在首次访问时加
 *   · visitor_seen   —— 首次访问才真正插入（ON CONFLICT DO NOTHING）
 *   · visitor_online —— 每次访问都刷新心跳
 * 用 batch 而不是三次 await，是为了把三次网络往返压成一次。
 */
export async function recordVisit(
  env: Env,
  ipHash: string,
  path: string,
  nowMs: number = Date.now(),
): Promise<void> {
  const day = dayKey(nowMs)

  const seen = await prep(
    env.DB,
    'SELECT 1 AS hit FROM visitor_seen WHERE day = ? AND ip_hash = ?',
    [day, ipHash],
  ).first<{ hit: number }>()

  const isNewUv = seen ? 0 : 1
  const nowSec = Math.floor(nowMs / 1000)

  const stmts = [
    prep(
      env.DB,
      `INSERT INTO visitor_daily (day, pv, uv) VALUES (?, 1, ?)
       ON CONFLICT(day) DO UPDATE SET pv = pv + 1, uv = uv + ?`,
      [day, isNewUv, isNewUv],
    ),
    prep(
      env.DB,
      `INSERT INTO visitor_seen (day, ip_hash, path) VALUES (?, ?, ?)
       ON CONFLICT(day, ip_hash) DO NOTHING`,
      [day, ipHash, path],
    ),
    prep(
      env.DB,
      `INSERT INTO visitor_online (ip_hash, last_seen) VALUES (?, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET last_seen = ?`,
      [ipHash, nowSec, nowSec],
    ),
  ]

  await env.DB.batch(stmts)

  // 顺手清理过期心跳：**概率性执行**，避免每次访问都多一次写。
  // 不清理也不会算错（读的时候按 last_seen 过滤），只是表会慢慢变大。
  if (Math.random() < 0.02) {
    await prep(env.DB, 'DELETE FROM visitor_online WHERE last_seen < ?', [nowSec - 3600]).run()
  }
}
