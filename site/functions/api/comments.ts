/**
 * /api/comments — 文章 / 碎碎念的评论
 * ------------------------------------------------------------
 * GET  : 某个目标的评论（只返回 approved，组装成「顶层 + 一层回复」）
 * POST : 发表评论 / 回复（**必须先用 GitHub 登录**）
 *
 * 为什么发评论要求登录：
 *   · 评论是公开内容，匿名发会让垃圾广告成本降到零；
 *   · GitHub 账号是现成的身份，我们不用自己存密码（也就不用做找回密码）；
 *   · 这也是参考站的做法。
 *
 * 缓存策略：**no-store，不做边缘缓存**。
 * 评论是「刚发完就要看见」的内容，一旦被边缘缓存住，作者会以为发失败了
 * （项目里踩过一次同类坑：后台开关能存不能读，公开接口却永远说「允许」，
 * 表现就是「我明明发了怎么没生效」——所以这类开关一定要有断言覆盖。）
 */

import type { Comment } from '../../src/types'
import type { Handler } from '../_lib/context'
import { badRequest, fail, json, notFound, preflight, readJson } from '../_lib/http'
import { buildCommentTree, prep, toComment, type CommentRow } from '../_lib/db'
import { getCurrentUser } from '../_lib/auth'
import { clientIpHash, consumeRateLimit } from '../_lib/ratelimit'

/** 与前端计数器保持一致 */
const MAX_LENGTH = 1000
/** 同一账号每小时最多发几条 */
const RATE_LIMIT_PER_HOUR = 10
/** 允许评论的目标类型 */
const TARGET_TYPES = ['post', 'moment']
/** 单个目标一次最多取回多少条（防止爆款文章把响应撑爆） */
const MAX_ROWS = 500

const SELECT_COLUMNS = `id, target_type, target_id, parent_id, provider, provider_uid,
                        user_login, user_name, user_avatar, content, status, created_at`

export const onRequestOptions: Handler = () => preflight()

/* ============================================================
   GET：评论列表
   ============================================================ */

export const onRequestGet: Handler = async ({ env, request }) => {
  const url = new URL(request.url)
  const targetType = (url.searchParams.get('targetType') ?? 'post').trim()
  const targetId = Number(url.searchParams.get('targetId') ?? 0)

  if (!TARGET_TYPES.includes(targetType)) {
    return badRequest(`targetType 只支持 ${TARGET_TYPES.join(' / ')}`)
  }
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return badRequest('targetId 必须是正整数')
  }

  try {
    // 一次查询取回该目标的全部已通过评论，再在内存里组装成树 —— 查询数与评论条数无关
    const res = await prep(
      env.DB,
      `SELECT ${SELECT_COLUMNS}
         FROM comments
        WHERE target_type = ? AND target_id = ? AND status = 'approved'
        ORDER BY created_at ASC
        LIMIT ${MAX_ROWS}`,
      [targetType, targetId],
    ).all<CommentRow>()

    return json(buildCommentTree(res.results ?? []), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return fail(`读取评论失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

/* ============================================================
   POST：发表评论
   ============================================================ */

interface CommentInput {
  targetType?: string
  targetId?: number
  parentId?: number
  content?: string
}

export const onRequestPost: Handler = async ({ env, request }) => {
  /* ---------- ① 必须登录 ---------- */
  const user = await getCurrentUser(env, request)
  if (!user) return fail('请先用 GitHub 登录后再发表评论', 401)

  const body = await readJson<CommentInput>(request)
  if (!body) return badRequest('请求体不是合法的 JSON')

  const targetType = String(body.targetType ?? 'post').trim()
  const targetId = Number(body.targetId ?? 0)
  const parentId = Number(body.parentId ?? 0)
  const content = String(body.content ?? '').trim()

  /* ---------- ② 校验 ---------- */
  if (!TARGET_TYPES.includes(targetType)) {
    return badRequest(`targetType 只支持 ${TARGET_TYPES.join(' / ')}`)
  }
  if (!Number.isInteger(targetId) || targetId <= 0) return badRequest('targetId 必须是正整数')
  if (!content) return badRequest('评论内容不能为空')
  if (content.length > MAX_LENGTH) return badRequest(`评论最多 ${MAX_LENGTH} 字`)
  if (parentId !== 0 && (!Number.isInteger(parentId) || parentId < 0)) {
    return badRequest('parentId 不合法')
  }

  /* ---------- ③ 目标必须存在；文章还可能被站长关掉了评论 ---------- */
  if (targetType === 'post') {
    const post = await prep(
      env.DB,
      `SELECT allow_comment FROM posts
        WHERE id = ? AND status = 'published' AND deleted_at IS NULL
        LIMIT 1`,
      [targetId],
    ).first<{ allow_comment: number }>()
    if (!post) return notFound('要评论的文章不存在')
    if (post.allow_comment === 0) return fail('这篇文章的评论已关闭', 403)
  } else {
    const moment = await prep(env.DB, 'SELECT 1 AS ok FROM moments WHERE id = ? LIMIT 1', [
      targetId,
    ]).first<{ ok: number }>()
    if (!moment) return notFound('要评论的碎碎念不存在')
  }

  /* ---------- ④ 限流（按账号，不按 IP —— 同一个 WiFi 下的人不该互相拖累） ---------- */
  const limited = await consumeRateLimit(env, 'comment', `u${user.id}`, RATE_LIMIT_PER_HOUR, 3_600_000)
  if (!limited.allowed) {
    return fail(`评论太频繁了，请 ${limited.retryAfterMinutes} 分钟后再试`, 429)
  }

  /* ---------- ⑤ 回复目标必须存在且属于同一个目标 ---------- */
  if (parentId > 0) {
    const parent = await prep(
      env.DB,
      `SELECT id FROM comments
        WHERE id = ? AND target_type = ? AND target_id = ? AND status = 'approved'`,
      [parentId, targetType, targetId],
    ).first<{ id: number }>()
    if (!parent) return badRequest('要回复的评论不存在')
  }

  /* ---------- ⑥ 写库 ---------- */
  try {
    const ipHash = await clientIpHash(request)
    const created = await prep(
      env.DB,
      `INSERT INTO comments (target_type, target_id, parent_id, provider, provider_uid,
                             user_login, user_name, user_avatar, content, status, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
       RETURNING ${SELECT_COLUMNS}`,
      [
        targetType,
        targetId,
        parentId,
        user.provider,
        user.providerUid,
        user.login,
        user.nickname,
        user.avatar,
        content,
        ipHash,
      ],
    ).first<CommentRow>()

    if (!created) return fail('评论写入失败', 500)

    const comment: Comment = toComment(created)
    return json(comment, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return fail(`发表评论失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
