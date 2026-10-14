/**
 * API 客户端
 * ------------------------------------------------------------
 * 阶段 1：所有请求走 mock 适配层（见 ./mock.ts），组件调用方式与真实接口完全一致。
 * 阶段 3：把 USE_MOCK 置为 false，即切换到真实的 Pages Functions。
 */

import type {
  Album,
  AuthState,
  Comment,
  CommentInput,
  FriendLink,
  GuestbookEntry,
  GuestbookInput,
  Moment,
  Music,
  Paginated,
  Post,
  PostQuery,
  Project,
  SiteSettings,
  Stats,
  Tag,
  Category,
} from '@/types'
import { defaultSettings } from '@/data/settings'
import * as mock from './mock'

/**
 * 是否使用本地 mock 数据
 * ------------------------------------------------------------
 * **默认 false —— 走真实接口**（本地由 `npm run dev:local` 提供，
 * 线上由 Pages Functions 提供）。
 *
 * 什么时候需要打开：
 *   · 没有后端、只想看前端版式（离线演示）
 *   · 后端接口挂了，想确认是不是前端的锅
 *
 * 打开方式：在 site/.env.local 里写 VITE_USE_MOCK=true
 * （见 .env.example）。改完要重启 dev server。
 *
 * 注意：mock 数据是 src/api/mock.ts 里的**硬编码内容**，
 * 和数据库里的东西完全无关 —— 所以「后台发了文章但首页没有」
 * 最常见的原因就是这个开关被打开了。
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/** 接口根路径（与 Functions 目录结构对应） */
const API_BASE = '/api/wp'

/** 统一的请求错误 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 单个请求的超时上限：任何接口都不该把整页拖住（首页会并发多个读接口） */
const TIMEOUT_MS = 8000

/** 旧浏览器没有 AbortSignal.timeout 就退化成「不超时」，不为此报错 */
function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(TIMEOUT_MS)
    : undefined
}

/**
 * 底层请求封装。
 * 注意：这里必须防御"接口被 SPA 回落成 HTML"的经典坑——
 * 内容类型不是 JSON 时给出可读错误，而不是抛出 JSON 解析异常。
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      headers: { Accept: 'application/json' },
      // 放在 init 之前：调用方显式传了 signal 就以调用方为准
      signal: timeoutSignal(),
      ...init,
    })
  } catch (e) {
    // 超时/断网都落到这里。统一成 ApiError，上层才能拿到人话（而不是 DOMException 的英文）
    const name = e instanceof DOMException ? e.name : ''
    throw new ApiError(
      name === 'TimeoutError' || name === 'AbortError'
        ? '请求超时，请稍后重试'
        : '网络请求失败，请检查网络后重试',
      0,
    )
  }

  if (!res.ok) {
    // 尝试读出后端返回的错误信息
    let detail = ''
    const ctype = res.headers.get('content-type') ?? ''
    try {
      if (ctype.includes('application/json')) {
        const body = (await res.json()) as { error?: string }
        detail = body.error ? String(body.error) : ''
      } else {
        detail = (await res.text()).slice(0, 120)
      }
    } catch {
      /* 忽略读取失败 */
    }
    throw new ApiError(detail || `请求失败：${res.status} ${res.statusText}`, res.status)
  }

  const ctype = res.headers.get('content-type') ?? ''
  if (!ctype.includes('application/json')) {
    // 典型症状：Pages 把 /api/* 回落到了 index.html
    throw new ApiError(
      '接口返回的不是 JSON（可能被 SPA 回落成了 HTML），请检查 _routes.json 配置',
      res.status,
    )
  }

  return (await res.json()) as T
}

/* ============================================================
   公开读接口
   ============================================================ */

/** 文章列表（分页 + 筛选） */
export function getPosts(query: PostQuery = {}): Promise<Paginated<Post>> {
  if (USE_MOCK) return mock.getPosts(query)
  const qs = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  return request<Paginated<Post>>(`${API_BASE}/posts?${qs}`)
}

/** 文章详情（按 slug） */
export function getPost(slug: string): Promise<Post> {
  if (USE_MOCK) return mock.getPost(slug)
  return request<Post>(`${API_BASE}/posts/${encodeURIComponent(slug)}`)
}

/**
 * 发布日历：有发布的日期 + 当天篇数
 * ------------------------------------------------------------
 * 只回日期和篇数（几百字节），不拉正文 —— 首页日历不该为了几个点
 * 去下载整个文章列表。
 */
export function getPostDates(): Promise<{ date: string; count: number }[]> {
  if (USE_MOCK) return mock.getPostDates()
  return request<{ date: string; count: number }[]>(`${API_BASE}/post-dates`)
}

/** 相邻文章（详情页底部"上一篇 / 下一篇"） */
export function getAdjacentPosts(
  slug: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  if (USE_MOCK) return mock.getAdjacentPosts(slug)
  return request(`${API_BASE}/posts/${encodeURIComponent(slug)}/adjacent`)
}

/** 相关文章（同标签推荐） */
export function getRelatedPosts(slug: string, limit = 3): Promise<Post[]> {
  if (USE_MOCK) return mock.getRelatedPosts(slug, limit)
  return request<Post[]>(`${API_BASE}/posts/${encodeURIComponent(slug)}/related?limit=${limit}`)
}

export function getCategories(): Promise<Category[]> {
  if (USE_MOCK) return mock.getCategories()
  return request<Category[]>(`${API_BASE}/categories`)
}

export function getTags(): Promise<Tag[]> {
  if (USE_MOCK) return mock.getTags()
  return request<Tag[]>(`${API_BASE}/tags`)
}

export function getAlbums(): Promise<Album[]> {
  if (USE_MOCK) return mock.getAlbums()
  return request<Album[]>(`${API_BASE}/albums`)
}

export function getAlbum(slug: string): Promise<Album> {
  if (USE_MOCK) return mock.getAlbum(slug)
  return request<Album>(`${API_BASE}/albums/${encodeURIComponent(slug)}`)
}

export function getMoments(): Promise<Moment[]> {
  if (USE_MOCK) return mock.getMoments()
  return request<Moment[]>(`${API_BASE}/moments`)
}

export function getMusic(): Promise<Music[]> {
  if (USE_MOCK) return mock.getMusic()
  return request<Music[]>(`${API_BASE}/music`)
}

export function getProjects(): Promise<Project[]> {
  if (USE_MOCK) return mock.getProjects()
  return request<Project[]>(`${API_BASE}/projects`)
}

export function getFriendLinks(): Promise<FriendLink[]> {
  if (USE_MOCK) return mock.getFriendLinks()
  return request<FriendLink[]>(`${API_BASE}/links`)
}

/* ============================================================
   留言板（阶段 2b）
   ============================================================ */

/** 全部留言，最新在前 */
export function getGuestbook(): Promise<GuestbookEntry[]> {
  if (USE_MOCK) return mock.getGuestbook()
  return request<GuestbookEntry[]>('/api/guestbook')
}

/**
 * 发布一条留言。
 * 注意：阶段 5 接入 GitHub 登录后，昵称由服务端从会话里取，
 * 这里的 nickname 只是「未登录时的临时身份」，届时可不再传。
 */
export function postGuestbook(input: GuestbookInput): Promise<GuestbookEntry> {
  if (USE_MOCK) return mock.postGuestbook(input)
  return request<GuestbookEntry>('/api/guestbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** 站点设置。失败时回落到构建期默认值，保证页面永远能渲染。 */
export async function getSettings(): Promise<SiteSettings> {
  try {
    if (USE_MOCK) return await mock.getSettings()
    const s = await request<Partial<SiteSettings>>(`${API_BASE}/settings`)
    // 与默认值合并，避免后台漏配字段导致前端缺项
    return {
      ...defaultSettings,
      ...s,
      social: { ...defaultSettings.social, ...(s.social ?? {}) },
    }
  } catch {
    return defaultSettings
  }
}

/** 站内搜索 */
export function search(q: string): Promise<Post[]> {
  if (USE_MOCK) return mock.search(q)
  return request<Post[]>(`${API_BASE}/search?q=${encodeURIComponent(q)}`)
}

/** 某篇文章的评论（只含已通过审核的，回复挂在 replies 里） */
export function getComments(targetType: string, targetId: number): Promise<Comment[]> {
  if (USE_MOCK) return mock.getComments(targetType, targetId)
  return request<Comment[]>(`/api/comments?targetType=${targetType}&targetId=${targetId}`)
}

/** 发表评论 / 回复（需要已登录，否则后端返回 401） */
export function postComment(input: CommentInput): Promise<Comment> {
  if (USE_MOCK) return mock.postComment(input)
  return request<Comment>('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/* ============================================================
   身份（阶段 5：GitHub OAuth）
   ============================================================ */

/** 当前登录状态 + 站长有没有配置 GitHub 登录 */
export function getCurrentUser(): Promise<AuthState> {
  if (USE_MOCK) return mock.getCurrentUser()
  return request<AuthState>('/api/auth/me')
}

/** 退出登录（只影响评论身份，不影响管理后台） */
export function logoutUser(): Promise<{ ok: boolean }> {
  if (USE_MOCK) return mock.logoutUser()
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

/**
 * 拼 GitHub 登录入口。
 * redirect 只允许站内路径（后端还会再清洗一次，挡开放重定向）。
 */
export function githubLoginUrl(redirect: string): string {
  return `/api/auth/github?redirect=${encodeURIComponent(redirect)}`
}

/** 访客统计（阶段 1 返回 mock 值，让首页侧栏有内容） */
export function getStats(): Promise<Stats> {
  if (USE_MOCK) return mock.getStats()
  return request<Stats>('/api/stats')
}

/**
 * 上报一次访问，并拿到最新统计快照。
 * 失败要静默（统计挂了不该影响页面），所以调用方负责 catch。
 */
export function recordVisit(path: string): Promise<Stats> {
  if (USE_MOCK) return mock.getStats()
  return request<Stats>(`/api/stats?path=${encodeURIComponent(path)}`, { method: 'POST' })
}
