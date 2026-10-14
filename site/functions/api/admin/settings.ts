/**
 * /api/admin/settings — 站点设置
 * ------------------------------------------------------------
 * GET : 读出全部设置，还原成前端 SiteSettings 结构
 * PUT : 局部更新（只写请求里出现的键）
 *
 * site_settings 是键值表，所以这里需要一层「结构 ↔ 键值」的转换。
 * 写入用**白名单**：只有下面 ALLOWED_KEYS 里的键能被写，
 * 否则后台就成了任意键值注入点。
 */

import type { Handler } from '../../_lib/context'
import { badRequest, fail, json, preflight, readJson } from '../../_lib/http'
import { getSessionUser } from '../../_lib/auth'
import { prep, toSiteSettings } from '../../_lib/db'

/** 允许写入的键（与 toSiteSettings 的读取字段一一对应） */
const ALLOWED_KEYS = new Set([
  'siteName',
  'tagline',
  'kicker',
  'author',
  'authorAvatar',
  'authorBio',
  'copyright',
  'icp',
  'accentColor',
  'chatEnabled',
  'social',
])

/** 单值最大长度，防止把设置表当存储用 */
const MAX_VALUE_LENGTH = 2000

/** social 的子键白名单 */
const SOCIAL_KEYS = ['github', 'email', 'wechat', 'qq', 'rss'] as const
/** 单个社交字段的最大长度（5 × 300 仍远小于 MAX_VALUE_LENGTH） */
const MAX_SOCIAL_VALUE = 300

/**
 * 收敛 social 对象。
 * ------------------------------------------------------------
 * 以前是整包 JSON.stringify —— 于是「已下线的旧键」（如 twitter）会永久驻留，
 * 任意新键也能塞进去，后台表单还会把它们 spread 回灌。
 * 这里只挑白名单子键、去空白、限长。
 * 协议（javascript: / data:）不在这里拦：渲染侧统一走 utils 的 safe*Url，
 * 因为裸用户名（如 github: "du2333"）是合法输入，只是不该变成 href。
 */
function sanitizeSocial(raw: unknown): Record<string, string> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  for (const k of SOCIAL_KEYS) {
    const v = src[k]
    if (typeof v !== 'string') continue
    const s = v.trim().slice(0, MAX_SOCIAL_VALUE)
    if (s) out[k] = s
  }
  return out
}

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env, request }) => {
  const admin = await getSessionUser(env, request)
  if (!admin) return fail('未登录或登录已过期', 401)

  try {
    const res = await prep(env.DB, 'SELECT key, value FROM site_settings').all<{
      key: string
      value: string
    }>()
    return json(toSiteSettings(res.results ?? []))
  } catch (e) {
    return fail(`读取站点设置失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

export const onRequestPut: Handler = async ({ env, request }) => {
  const admin = await getSessionUser(env, request)
  if (!admin) return fail('未登录或登录已过期', 401)

  const body = await readJson<Record<string, unknown>>(request)
  if (!body) return badRequest('请求体不是合法的 JSON')

  /* ---------- 白名单 + 序列化 ---------- */
  const writes: { key: string; value: string }[] = []

  for (const [key, raw] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue

    let value: string
    if (key === 'chatEnabled') {
      value = raw ? '1' : '0'
    } else if (key === 'social') {
      // social 是对象：只收白名单子键（见 sanitizeSocial），不整包落库
      value = JSON.stringify(sanitizeSocial(raw))
    } else {
      value = raw === null || raw === undefined ? '' : String(raw)
    }

    if (value.length > MAX_VALUE_LENGTH) {
      return badRequest(`设置项 ${key} 超过 ${MAX_VALUE_LENGTH} 字`)
    }
    writes.push({ key, value })
  }

  if (writes.length === 0) return badRequest('没有可写入的设置项')

  try {
    // 用 batch 一次性提交，减少往返（免费版单次调用查询数有限）
    await env.DB.batch(
      writes.map((w) =>
        env.DB.prepare(
          `INSERT INTO site_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ).bind(w.key, w.value),
      ),
    )

    const res = await prep(env.DB, 'SELECT key, value FROM site_settings').all<{
      key: string
      value: string
    }>()
    return json(toSiteSettings(res.results ?? []))
  } catch (e) {
    return fail(`保存站点设置失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
