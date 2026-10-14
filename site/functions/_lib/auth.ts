/**
 * 管理后台鉴权
 * ============================================================
 * 核心难题：Workers Free 只有 10 ms CPU/请求，而标准强度的密码哈希
 * （PBKDF2-SHA256 600k 迭代）实测约 75 ms —— 在服务端做必然超限。
 *
 * 解法：**把慢哈希放到客户端做，服务端只做一次廉价的 HMAC。**
 *
 *   ① 客户端（浏览器）用 WebCrypto 算 PBKDF2(password, salt, 600000)
 *      → 得到 verifier。这 75 ms 花在访客自己的机器上，用户无感。
 *   ② 客户端把 verifier 通过 HTTPS 发给服务端。
 *   ③ 服务端存 HMAC-SHA256(verifier, pepper) —— 亚毫秒级，10 ms 绰绰有余。
 *   ④ 登录时客户端重新推导 verifier，服务端重算 HMAC 并做**定长比较**。
 *
 * 安全性说明（为什么这样不弱）：
 *   · 慢哈希强度没有打折：迭代次数仍是 600k，暴力破解成本不变。
 *   · verifier 本身成了「口令等价物」，但它只在 TLS 内传输，不落库。
 *   · **数据库泄露也拿不到 verifier**：库里只有 HMAC 值，无法反推。
 *     攻击者想爆破必须自己跑 600k 次 PBKDF2 猜口令，且没有 pepper 就无法验证猜测。
 *   · pepper 来自环境变量 Secret，与数据库分开保管 —— 这就是它的意义。
 *
 * 会话：随机 32 字节 token，库里只存 SHA-256 哈希；HttpOnly + SameSite=Lax。
 */

import type { Env } from './context'

/** 会话 Cookie 名 */
export const SESSION_COOKIE = 'mb_admin'
/** 会话有效期：7 天 */
const SESSION_TTL_SECONDS = 7 * 24 * 3600
/** 客户端应当使用的 PBKDF2 迭代次数（下发给前端，保证两端一致） */
export const PBKDF2_ITERATIONS = 600_000

export interface AdminUser {
  id: number
  username: string
  nickname: string
  avatar: string
  role: string
}

/* ============================================================
   基础密码学工具
   ============================================================ */

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return toHex(digest)
}

/** HMAC-SHA256，用于把客户端 verifier 与 pepper 绑定 */
export async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toHex(sig)
}

/**
 * 定长字符串比较，避免通过响应时间差推断正确前缀。
 * 先比较长度（长度本身不是秘密），再逐字节异或累加。
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** 生成随机十六进制串（用于 token / salt） */
export function randomHex(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ============================================================
   pepper
   ============================================================ */

/**
 * 取 pepper。
 * 优先用环境变量 Secret `ADMIN_PEPPER`；未配置时退化为一个固定常量，
 * 此时「数据库泄露也无法重放」这一层保护会减弱 —— 生产环境应当配置它。
 */
export function getPepper(env: Env): string {
  const configured = (env.ADMIN_PEPPER ?? '').trim()
  if (configured) return configured
  return `fallback-pepper::${env.SITE_URL ?? 'local'}`
}

/** 计算要存进 users.password_hash 的值 */
export async function makeVerifierHash(env: Env, verifier: string): Promise<string> {
  return hmacHex(verifier, getPepper(env))
}

/**
 * 口令记录的打包格式：`v1$<salt>$<hmac>`
 * ------------------------------------------------------------
 * 为什么把 salt 塞进 password_hash 而不是加一列：
 *   schema 已经定型（且已用真实 SQLite 验证过），为了一个字段做迁移不划算。
 *   这种自描述格式也更稳——salt 与哈希永远成对出现，不会错配。
 */
export function packHash(salt: string, hash: string): string {
  return `v1$${salt}$${hash}`
}

/** 解析口令记录；格式不对返回 null（视为无法登录，而不是静默放行） */
export function unpackHash(stored: string | null | undefined): { salt: string; hash: string } | null {
  if (!stored) return null
  const parts = stored.split('$')
  if (parts.length !== 3) return null
  const [version, salt, hash] = parts
  if (version !== 'v1' || !salt || !hash) return null
  return { salt, hash }
}

/* ============================================================
   会话
   ============================================================ */

/** 从 Cookie 头里取指定 cookie */
export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('Cookie')
  if (!raw) return null
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

/** 本地 http 调试时不能带 Secure，否则浏览器直接丢弃 cookie */
function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

export function buildSessionCookie(token: string, request: Request, maxAge = SESSION_TTL_SECONDS): string {
  return buildCookie(SESSION_COOKIE, token, request, maxAge)
}

/** 通用 cookie 构造（后台会话与评论用户会话共用同一套属性） */
export function buildCookie(name: string, token: string, request: Request, maxAge: number): string {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (isHttps(request)) parts.push('Secure')
  return parts.join('; ')
}

/** 清掉某个 cookie（Max-Age=0） */
export function clearCookie(name: string, request: Request): string {
  return buildCookie(name, '', request, 0)
}

export function buildLogoutCookie(request: Request): string {
  return buildSessionCookie('', request, 0)
}

/** 建立会话：生成 token、只把哈希写库、返回明文 token 交给 cookie */
export async function createSession(
  env: Env,
  userId: number,
  request: Request,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()

  const ip =
    request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? ''
  const ipHash = ip ? await sha256Hex(ip) : ''
  const ua = (request.headers.get('User-Agent') ?? '').slice(0, 200)

  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, user_agent, ip_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(tokenHash, userId, ua, ipHash, expiresAt)
    .run()

  return { token, expiresAt }
}

/**
 * 读取当前登录的管理员。
 * 同时顺手清理过期会话（概率性，避免每次请求都写库）。
 */
export async function getSessionUser(env: Env, request: Request): Promise<AdminUser | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null

  const tokenHash = await sha256Hex(token)

  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.nickname, u.avatar, u.role, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
      LIMIT 1`,
  )
    .bind(tokenHash)
    .first<{
      id: number
      username: string
      nickname: string
      avatar: string
      role: string
      expires_at: string
    }>()

  if (!row) return null

  // 过期即视为未登录
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    return null
  }

  if (row.role !== 'admin') return null

  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    role: row.role,
  }
}

/** 删除当前会话（登出） */
export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return
  const tokenHash = await sha256Hex(token)
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
}

/** 清理该用户的全部会话（改密码后使用） */
export async function destroyAllSessions(env: Env, userId: number): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}

/* ============================================================
   公开用户会话（评论用）
   ============================================================
   为什么和后台用**两个不同的 cookie**：
     · 登出评论区不应该把管理后台也登出，反之亦然；
     · 后台 cookie 一旦被前端 JS 误用，权限面会变大。
   两边共用 sessions 表，只是 cookie 名与「角色要求」不同。
   ============================================================ */

/** 评论用户的会话 Cookie 名 */
export const USER_COOKIE = 'mb_user'

/** 公开用户信息（不含任何敏感字段） */
export interface PublicUser {
  id: number
  username: string
  nickname: string
  avatar: string
  role: string
  /** local | github | email */
  provider: string
  /** 第三方稳定 ID（GitHub 的数字 id） */
  providerUid: string
  /** 展示用的第三方用户名（GitHub login）；非第三方登录时等于 username */
  login: string
}

/**
 * GitHub 用户的 username 统一加 `gh_` 前缀。
 * ------------------------------------------------------------
 * 原因：users.username 是 UNIQUE，而站长的管理员账号名可能与某个 GitHub
 * 用户名撞车（比如都叫 admin）。加一个不可能被站长用到的前缀，
 * 既避免冲突，又能从 username 反推出 GitHub login。
 */
export const GITHUB_USER_PREFIX = 'gh_'

/** 从 users.username 反推 GitHub login */
export function githubLoginOf(username: string): string {
  return username.startsWith(GITHUB_USER_PREFIX)
    ? username.slice(GITHUB_USER_PREFIX.length)
    : username
}

export function buildUserCookie(token: string, request: Request, maxAge = SESSION_TTL_SECONDS): string {
  return buildCookie(USER_COOKIE, token, request, maxAge)
}

/**
 * 读取当前登录的公开用户（GitHub 用户或管理员都算）。
 * ------------------------------------------------------------
 * 与 getSessionUser 的区别：**不要求 role === 'admin'**，
 * 但要求账号状态是 active（被封禁的账号不能发评论）。
 */
export async function getCurrentUser(env: Env, request: Request): Promise<PublicUser | null> {
  const token = readCookie(request, USER_COOKIE)
  if (!token) return null

  const tokenHash = await sha256Hex(token)

  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.nickname, u.avatar, u.role, u.status,
            u.provider, u.provider_uid, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
      LIMIT 1`,
  )
    .bind(tokenHash)
    .first<{
      id: number
      username: string
      nickname: string
      avatar: string
      role: string
      status: string
      provider: string
      provider_uid: string
      expires_at: string
    }>()

  if (!row) return null

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    return null
  }

  if (row.status !== 'active') return null

  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname || row.username,
    avatar: row.avatar,
    role: row.role,
    provider: row.provider,
    providerUid: row.provider_uid,
    login: row.provider === 'github' ? githubLoginOf(row.username) : row.username,
  }
}

/** 删除当前评论用户会话（登出） */
export async function destroyUserSession(env: Env, request: Request): Promise<void> {
  const token = readCookie(request, USER_COOKIE)
  if (!token) return
  const tokenHash = await sha256Hex(token)
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
}
