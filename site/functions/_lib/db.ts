/**
 * Pages Functions 公共工具：数据库与行映射
 * ------------------------------------------------------------
 * 设计要点：
 *   1. **禁止 N+1**。免费版单次调用只有 50 条查询额度（付费版 1000），
 *      所以列表接口一律「一次 JOIN 取主体 + 一次 IN 取关联」，
 *      绝不在循环里查库。
 *   2. 行 → API 结构的映射集中在这里，接口文件只关心参数与响应。
 *   3. 表里的下划线命名（reading_time）转成前端用的驼峰（readingTime）。
 */

import type {
  Album,
  Category,
  Comment,
  FriendLink,
  GuestbookEntry,
  Moment,
  Music,
  Post,
  Project,
  Tag,
} from '../../src/types'

/* ============================================================
   行类型（与 db/schema.sql 对应）
   ============================================================ */

export interface PostRow {
  id: number
  slug: string
  title: string
  excerpt: string
  content: string
  content_format: string
  cover: string
  status: string
  views: number
  reading_time: number
  is_top: number
  /**
   * 是否允许评论（1/0）。
   * 只有文章列表与详情两条查询会 SELECT 它，其它（相邻/相关/搜索）
   * 不查这一列 —— 所以映射时用 `!== 0` 兜底成 true，
   * 免得那几处接口莫名其妙地报「不允许评论」。
   */
  allow_comment?: number
  published_at: string
  updated_at: string
  cat_id: number | null
  cat_name: string | null
  cat_slug: string | null
}

export interface TagRow {
  post_id: number
  id: number
  name: string
  slug: string
}

export interface CategoryRow {
  id: number
  name: string
  slug: string
  description: string
  count?: number
}

export interface AlbumRow {
  id: number
  slug: string
  title: string
  description: string
  cover: string
  location: string
  taken_at: string
  is_featured: number
  image_count?: number
}

export interface AlbumImageRow {
  id: number
  url: string
  caption: string
  width: number
  height: number
}

export interface MomentRow {
  id: number
  content: string
  images: string
  location: string
  mood: string
  likes: number
  created_at: string
}

export interface MusicRow {
  id: number
  title: string
  artist: string
  album: string
  audio: string
  cover: string
  lyrics: string
  duration: number
}

export interface ProjectRow {
  id: number
  name: string
  description: string
  cover: string
  repo_url: string
  demo_url: string
  tech_stack: string
  language: string
  stars: number
  status: string
  is_featured: number
}

export interface FriendLinkRow {
  id: number
  name: string
  url: string
  avatar: string
  description: string
  group_name: string
  status: string
}

export interface GuestbookRow {
  id: number
  nickname: string
  email: string
  content: string
  reply: string
  status: string
  created_at: string
}

export interface CommentRow {
  id: number
  target_type: string
  target_id: number
  parent_id: number
  provider: string
  provider_uid: string
  user_login: string
  user_name: string
  user_avatar: string
  content: string
  status: string
  created_at: string
}

/* ============================================================
   工具
   ============================================================ */

/** 安全解析 JSON 数组字段（数据库里存的是字符串） */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 准备一条语句：有参数才 bind。
 * D1 对「bind 了参数但 SQL 里没有占位符」会直接报错，
 * 所以不能无脑 bind(...[])，必须按需调用。
 */
export function prep(
  db: D1Database,
  sql: string,
  binds: (string | number | null)[] = [],
): D1PreparedStatement {
  const stmt = db.prepare(sql)
  return binds.length > 0 ? stmt.bind(...binds) : stmt
}

/**
 * 把一组 id 拼成 SQL 的 IN 占位符，并返回对应参数。
 * 用于「一次查询取回整页关联数据」，避免在循环里查库（N+1）。
 */
export function inClause(ids: number[]): { placeholders: string; binds: number[] } {
  return {
    placeholders: ids.map(() => '?').join(', '),
    binds: ids,
  }
}

/* ============================================================
   行 → API 结构
   ============================================================ */

/** 列表用的精简文章结构（不含正文，省流量） */
export function toPostListItem(row: PostRow, tags: Tag[] = []): Omit<Post, 'content'> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentFormat: row.content_format === 'html' ? 'html' : 'markdown',
    cover: row.cover,
    category: toCategoryRef(row),
    tags,
    status: (row.status as Post['status']) ?? 'published',
    views: row.views,
    readingTime: row.reading_time,
    isTop: row.is_top === 1,
    // 后台「允许评论」开关真正生效的地方：以前这里写死 true，
    // 导致开关存进了库却对公开站没有任何影响（阶段 5 修）
    allowComment: row.allow_comment !== 0,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  }
}

/** 详情用的完整结构（含正文） */
export function toPost(row: PostRow, tags: Tag[] = []): Post {
  return {
    ...toPostListItem(row, tags),
    content: row.content,
  }
}

function toCategoryRef(row: PostRow): Category | null {
  if (row.cat_id === null || !row.cat_slug) return null
  return {
    id: row.cat_id,
    name: row.cat_name ?? '',
    slug: row.cat_slug,
  }
}

/** 把「一篇文章一行标签」的结果聚合成 post_id → Tag[] */
export function groupTagsByPost(rows: TagRow[]): Map<number, Tag[]> {
  const map = new Map<number, Tag[]>()
  for (const r of rows) {
    const list = map.get(r.post_id)
    const tag: Tag = { id: r.id, name: r.name, slug: r.slug }
    if (list) list.push(tag)
    else map.set(r.post_id, [tag])
  }
  return map
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    count: row.count,
  }
}

export function toAlbum(row: AlbumRow, images?: AlbumImageRow[]): Album {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    cover: row.cover,
    location: row.location,
    takenAt: row.taken_at,
    isFeatured: row.is_featured === 1,
    imageCount: row.image_count,
    images: images?.map((i) => ({
      id: i.id,
      url: i.url,
      caption: i.caption,
      width: i.width,
      height: i.height,
    })),
  }
}

export function toMoment(row: MomentRow): Moment {
  return {
    id: row.id,
    content: row.content,
    images: parseJsonArray(row.images),
    location: row.location,
    mood: row.mood,
    likes: row.likes,
    createdAt: row.created_at,
  }
}

export function toMusic(row: MusicRow): Music {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    audio: row.audio,
    cover: row.cover,
    lyrics: row.lyrics,
    duration: row.duration,
  }
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    cover: row.cover,
    repoUrl: row.repo_url,
    demoUrl: row.demo_url,
    techStack: parseJsonArray(row.tech_stack),
    language: row.language,
    stars: row.stars,
    status: (row.status as Project['status']) ?? 'active',
    isFeatured: row.is_featured === 1,
  }
}

export function toFriendLink(row: FriendLinkRow): FriendLink {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    avatar: row.avatar,
    description: row.description,
    groupName: row.group_name,
    status: (row.status as FriendLink['status']) ?? 'approved',
  }
}

export function toGuestbookEntry(row: GuestbookRow): GuestbookEntry {
  return {
    id: row.id,
    nickname: row.nickname,
    email: row.email,
    content: row.content,
    reply: row.reply,
    createdAt: row.created_at,
    // 内容含链接即视为友链申请，与前端 mock 的行为保持一致
    isFriendLinkApply: /https?:\/\//i.test(row.content),
  }
}

/* ============================================================
   评论
   ============================================================ */

export function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    targetType: (row.target_type as Comment['targetType']) ?? 'post',
    targetId: row.target_id,
    parentId: row.parent_id,
    userLogin: row.user_login,
    userName: row.user_name,
    userAvatar: row.user_avatar,
    content: row.content,
    createdAt: row.created_at,
  }
}

/**
 * 把扁平的评论列表组装成「顶层 + 一层回复」的树。
 * ------------------------------------------------------------
 * 为什么在 JS 里组装而不是递归查库：免费版单次调用只有 50 条查询额度，
 * 一条 SQL 取回该目标的全部评论再分组，查询数与评论条数无关。
 * 只做一层嵌套（回复的回复挂到同一个顶层评论下），避免无限递归。
 */
export function buildCommentTree(rows: CommentRow[]): Comment[] {
  const all = rows.map(toComment)
  const byId = new Map(all.map((c) => [c.id, c]))
  const roots: Comment[] = []

  for (const c of all) {
    const parent = c.parentId > 0 ? byId.get(c.parentId) : undefined
    if (parent) {
      // 父评论若本身是回复，则挂到它所属的顶层评论下
      const top = parent.parentId > 0 ? (byId.get(parent.parentId) ?? parent) : parent
      if (top.id === c.id) continue // 自引用脏数据，丢弃
      ;(top.replies ??= []).push(c)
    } else {
      roots.push(c)
    }
  }

  return roots
}

/* ============================================================
   站点设置
   ============================================================ */
/** 把 site_settings 的键值对还原成前端的 SiteSettings 结构 */
export function toSiteSettings(rows: { key: string; value: string }[]): Record<string, unknown> {
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const social = parseSocial(map.get('social'))

  return {
    siteName: map.get('siteName') ?? '',
    tagline: map.get('tagline') ?? '',
    kicker: map.get('kicker') ?? '',
    author: map.get('author') ?? '',
    authorAvatar: map.get('authorAvatar') ?? '',
    authorBio: map.get('authorBio') ?? '',
    copyright: map.get('copyright') ?? '',
    icp: map.get('icp') ?? '',
    accentColor: map.get('accentColor') ?? '',
    chatEnabled: map.get('chatEnabled') === '1',
    social,
  }
}

function parseSocial(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}
