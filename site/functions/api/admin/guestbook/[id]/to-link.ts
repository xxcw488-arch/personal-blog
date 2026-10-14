/**
 * POST /api/admin/guestbook/:id/to-link — 把「友链申请」留言转成待审友链
 * ------------------------------------------------------------
 * 这是参考站流程的自然延伸：申请者在留言板按四步格式留言，
 * 站长在后台一键转成 friend_links 里的一条 pending 记录，再审核通过。
 *
 * 解析失败也不报错：留言往往写得不规范，那就把整条内容当作「介绍」，
 * 让站长在后台补全链接 —— 比直接拒绝友好得多。
 */

import type { Handler } from '../../../../_lib/context'
import { badRequest, fail, json, notFound, preflight } from '../../../../_lib/http'
import { getSessionUser } from '../../../../_lib/auth'
import { prep, toFriendLink, type FriendLinkRow } from '../../../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestPost: Handler = async ({ env, request, params }) => {
  const admin = await getSessionUser(env, request)
  if (!admin) return fail('未登录或登录已过期', 401)

  const id = Number(params.id)
  if (!Number.isFinite(id)) return badRequest('id 不合法')

  try {
    const entry = await prep(
      env.DB,
      'SELECT id, nickname, content FROM guestbook WHERE id = ? LIMIT 1',
      [id],
    ).first<{ id: number; nickname: string; content: string }>()

    if (!entry) return notFound('留言不存在')

    const parsed = parseApplyFormat(entry.content)

    const row = await prep(
      env.DB,
      `INSERT INTO friend_links (name, url, avatar, description, group_name, status, sort_order)
       VALUES (?, ?, ?, ?, '朋友', 'pending', 0)
       RETURNING id, name, url, avatar, description, group_name, status`,
      [
        parsed.name || entry.nickname || '未命名站点',
        parsed.url,
        parsed.avatar,
        parsed.description || entry.content.slice(0, 200),
      ],
    ).first<FriendLinkRow>()

    if (!row) return fail('创建友链失败', 500)

    return json(
      {
        link: toFriendLink(row),
        // 把解析情况回传，后台可以提示「链接没解析出来，请手动补」
        parsed: {
          name: Boolean(parsed.name),
          url: Boolean(parsed.url),
          description: Boolean(parsed.description),
          avatar: Boolean(parsed.avatar),
        },
        sourceGuestbookId: entry.id,
      },
      { status: 201 },
    )
  } catch (e) {
    return fail(`转换失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

/* ============================================================
   解析四步格式
   ============================================================ */

interface ParsedApply {
  name: string
  url: string
  description: string
  avatar: string
}

/**
 * 解析形如：
 *   名称：示例小站
 *   链接：https://example.com
 *   介绍：一个示例站点
 *   头像：https://example.com/logo.png
 *
 * 兼容全角「：」与半角「:」，字段名前后允许空格。
 */
export function parseApplyFormat(content: string): ParsedApply {
  const out: ParsedApply = { name: '', url: '', description: '', avatar: '' }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const m = /^(名称|链接|介绍|头像)\s*[:：]\s*(.*)$/.exec(line)
    if (!m) continue
    const [, label, value] = m
    const v = (value ?? '').trim()
    if (!v) continue

    switch (label) {
      case '名称':
        out.name = v
        break
      case '链接':
        out.url = normalizeUrl(v)
        break
      case '介绍':
        out.description = v
        break
      case '头像':
        out.avatar = v
        break
    }
  }

  // 没写「链接：」时，退一步从正文里抓第一个 URL
  if (!out.url) {
    const m = /https?:\/\/[^\s，,）)]+/.exec(content)
    if (m) out.url = m[0]
  }

  return out
}

/** 补全协议：申请人常写成 example.com */
function normalizeUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  if (/^\/\//.test(value)) return `https:${value}`
  return `https://${value}`
}
