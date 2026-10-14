/**
 * POST /api/admin/upload — 上传媒体到 R2
 * ------------------------------------------------------------
 * 请求：multipart/form-data
 *   file  —— 必填，图片或音频
 *   dir   —— 可选，目标目录（photos / audio / covers / avatars），默认 photos
 *
 * 返回：{ key, url, size, contentType }
 *
 * 为什么必须在这里卡住大小与类型：
 *   ① R2 只有 10 GB 免费额度，不加限制很容易被一次误传撑爆
 *   ② 允许上传任意类型等于给站点开了一个公开文件托管
 *      （虽然媒体域与主站不同源，仍不该允许 .html/.svg 之类）
 */

import type { Handler } from '../../_lib/context'
import { badRequest, fail, json, preflight } from '../../_lib/http'
import { getSessionUser } from '../../_lib/auth'
import { consumeRateLimit, clientIpHash } from '../../_lib/ratelimit'

/** 单文件上限 5 MB（R2 免费额度保护线；照片建议压到 300 KB 以内） */
const MAX_FILE_BYTES = 5 * 1024 * 1024

/** 允许的目录（同时也是白名单，防止路径穿越） */
const ALLOWED_DIRS = new Set(['photos', 'audio', 'covers', 'avatars'])

/** 允许的 MIME 前缀 */
const ALLOWED_MIME_PREFIX = ['image/', 'audio/']

/** MIME → 扩展名兜底映射（优先用文件名里的扩展名） */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
}

/** 每小时最多上传多少个文件 */
const UPLOAD_LIMIT_PER_HOUR = 200

export const onRequestOptions: Handler = () => preflight()

export const onRequestPost: Handler = async ({ env, request }) => {
  const admin = await getSessionUser(env, request)
  if (!admin) return fail('未登录或登录已过期', 401)

  /* ---------- 限流：防止脚本化的批量灌文件 ---------- */
  const ipHash = await clientIpHash(request)
  const limit = await consumeRateLimit(env, 'admin-upload', ipHash, UPLOAD_LIMIT_PER_HOUR, 3_600_000)
  if (!limit.allowed) {
    return fail(`上传过于频繁，请 ${limit.retryAfterMinutes} 分钟后再试`, 429)
  }

  /* ---------- 解析表单 ---------- */
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest('请求体不是合法的 multipart/form-data')
  }

  const file = form.get('file')
  if (!(file instanceof File)) return badRequest('缺少 file 字段')
  if (file.size === 0) return badRequest('文件为空')
  if (file.size > MAX_FILE_BYTES) {
    return badRequest(`文件超过 ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB 上限`)
  }

  const contentType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_PREFIX.some((p) => contentType.startsWith(p))) {
    return badRequest(`不支持的文件类型：${contentType}（只允许图片与音频）`)
  }

  const dirRaw = String(form.get('dir') ?? 'photos').trim()
  const dir = ALLOWED_DIRS.has(dirRaw) ? dirRaw : 'photos'

  /* ---------- 生成对象键 ---------- */
  const ext = pickExtension(file.name, contentType)
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const key = `${dir}/${yyyy}/${mm}/${rand}.${ext}`

  /* ---------- 写入 R2 ---------- */
  try {
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType,
        // 媒体是内容寻址的（键里带随机串），可以长期缓存
        cacheControl: 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    return fail(`上传到 R2 失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }

  // MEDIA_URL 配了就照用，没配就退回相对 key。
  // 这里刻意不做「像不像占位符」的猜测：猜测会让「配错了域名」这种问题
  // 静默变成另一个错误，不如原样输出让人一眼看出来。
  const base = (env.MEDIA_URL ?? '').trim().replace(/\/+$/, '')
  const url = base ? `${base}/${key}` : `/${key}`

  return json(
    {
      key,
      url,
      size: file.size,
      contentType,
      uploadedBy: admin.username,
    },
    { status: 201 },
  )
}

/* ============================================================
   辅助
   ============================================================ */

/** 优先沿用原文件名的扩展名（做白名单校验），否则按 MIME 推断 */
function pickExtension(filename: string, contentType: string): string {
  const fromName = /\.([a-zA-Z0-9]{1,5})$/.exec(filename)?.[1]?.toLowerCase()
  if (fromName && /^(jpg|jpeg|png|webp|gif|avif|mp3|m4a|aac|ogg|wav|flac)$/.test(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  return EXT_BY_MIME[contentType] ?? 'bin'
}
