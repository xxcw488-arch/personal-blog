/**
 * 管理后台 API 客户端
 * ------------------------------------------------------------
 * 与公开接口分开：后台接口都要带会话 Cookie，且错误结构统一是 { error }。
 * Cookie 是同源的，fetch 默认就会带上，不用手动处理。
 */

/** 后台接口根路径 */
const ADMIN_BASE = '/api/admin'

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AdminApiError'
  }
}

/** 当前登录的管理员 */
export interface AdminUser {
  id: number
  username: string
  nickname: string
  avatar: string
  role: string
}

export interface AdminStatus {
  initialized: boolean
  pbkdf2Iterations: number
  hashFormat: string
}

export interface AdminSalt {
  username: string
  salt: string
  pbkdf2Iterations: number
  hashFormat: string
}

/** 列表接口统一返回结构 */
export interface AdminList<T = Record<string, unknown>> {
  items: T[]
  limit: number
  offset: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    ...init,
  })

  // 204 之类没有 body
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `请求失败：${res.status} ${res.statusText}`
    throw new AdminApiError(msg, res.status)
  }

  return body as T
}

/* ============================================================
   鉴权
   ============================================================ */

export const adminAuth = {
  /** 是否已初始化 + 服务端使用的 KDF 参数 */
  status: () => request<AdminStatus>('/status'),

  /** 取登录用的 salt */
  salt: (username?: string) =>
    request<AdminSalt>(`/salt${username ? `?username=${encodeURIComponent(username)}` : ''}`),

  /** 首次初始化（仅在无管理员时可用） */
  setup: (payload: { username: string; nickname?: string; salt: string; verifier: string }) =>
    request<{ user: AdminUser }>('/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 登录 */
  login: (payload: { username: string; verifier: string }) =>
    request<{ user: AdminUser }>('/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () => request<{ ok: boolean }>('/logout', { method: 'POST' }),

  me: () => request<{ user: AdminUser }>('/me'),
}

/* ============================================================
   内容 CRUD
   ============================================================ */

export const adminCrud = {
  list: <T = Record<string, unknown>>(resource: string, params?: Record<string, string | number>) => {
    const qs = new URLSearchParams()
    Object.entries(params ?? {}).forEach(([k, v]) => qs.set(k, String(v)))
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<AdminList<T>>(`/${resource}${suffix}`)
  },

  read: <T = Record<string, unknown>>(resource: string, id: number) =>
    request<T>(`/${resource}/${id}`),

  create: <T = Record<string, unknown>>(resource: string, body: Record<string, unknown>) =>
    request<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(body) }),

  update: <T = Record<string, unknown>>(resource: string, id: number, body: Record<string, unknown>) =>
    request<T>(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  remove: (resource: string, id: number) =>
    request<{ ok: boolean; id: number }>(`/${resource}/${id}`, { method: 'DELETE' }),
}

/* ============================================================
   站点设置
   ============================================================ */

export interface AdminSettings {
  siteName: string
  tagline: string
  kicker: string
  author: string
  authorAvatar: string
  authorBio: string
  copyright: string
  icp: string
  accentColor: string
  chatEnabled: boolean
  social: { github?: string; email?: string; wechat?: string; qq?: string; rss?: string }
}

export const adminSettings = {
  get: () => request<AdminSettings>('/settings'),
  update: (patch: Partial<AdminSettings>) =>
    request<AdminSettings>('/settings', { method: 'PUT', body: JSON.stringify(patch) }),
}

/* ============================================================
   上传
   ============================================================ */

export interface UploadResult {
  key: string
  url: string
  size: number
  contentType: string
}

export const adminUpload = {
  /** 上传单个文件到 R2；dir 可选 photos / audio / covers / avatars */
  file: (file: File, dir?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (dir) fd.append('dir', dir)
    return request<UploadResult>('/upload', { method: 'POST', body: fd })
  },
}

/* ============================================================
   留言板 → 友链
   ============================================================ */

export interface ToLinkResult {
  link: { id: number; name: string; url: string; description: string; status: string }
  parsed: { name: boolean; url: boolean; description: boolean; avatar: boolean }
  sourceGuestbookId: number
}

export const adminGuestbook = {
  /** 把「友链申请」留言一键转成待审友链 */
  toLink: (guestbookId: number) =>
    request<ToLinkResult>(`/guestbook/${guestbookId}/to-link`, { method: 'POST' }),
}
