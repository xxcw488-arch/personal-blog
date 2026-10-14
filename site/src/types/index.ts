/**
 * 全站数据模型
 * 与第 3 阶段的 D1 表结构、Functions 返回结构一一对应。
 * 阶段 1 用 mock 数据填充，字段完全一致，接口接通后无需改动组件。
 */

/** 发布状态 */
export type PostStatus = 'draft' | 'published'

export interface Category {
  id: number
  name: string
  slug: string
  description?: string
  /** 该分类下的文章数（列表接口聚合返回） */
  count?: number
}

export interface Tag {
  id: number
  name: string
  slug: string
  count?: number
}

export interface Post {
  id: number
  slug: string
  title: string
  /** 导语 / 摘要，列表与 SEO 用 */
  excerpt: string
  /** 正文：markdown 或 html，由 contentFormat 决定如何渲染 */
  content: string
  contentFormat: 'markdown' | 'html'
  /** 封面图 URL，可空（空则列表用纯文字排版） */
  cover: string
  /** 封面图说明（图注） */
  coverCaption?: string
  category?: Category | null
  tags: Tag[]
  status: PostStatus
  views: number
  /** 预估阅读分钟数 */
  readingTime: number
  isTop: boolean
  allowComment: boolean
  publishedAt: string
  updatedAt: string
}

export interface AlbumImage {
  id: number
  url: string
  caption: string
  width: number
  height: number
}

export interface Album {
  id: number
  slug: string
  title: string
  description: string
  cover: string
  location: string
  takenAt: string
  isFeatured: boolean
  images?: AlbumImage[]
  imageCount?: number
}

export interface Moment {
  id: number
  content: string
  images: string[]
  location: string
  mood: string
  likes: number
  createdAt: string
}

export interface Music {
  id: number
  title: string
  artist: string
  album: string
  /** 音频直链（jsDelivr CDN） */
  audio: string
  cover: string
  /** LRC 歌词原文 */
  lyrics: string
  duration: number
}

export interface Project {
  id: number
  name: string
  description: string
  cover: string
  repoUrl: string
  demoUrl: string
  techStack: string[]
  language: string
  stars: number
  status: 'active' | 'archived' | 'wip'
  isFeatured: boolean
}

/** 友链审核状态 */
export type FriendLinkStatus = 'pending' | 'approved' | 'rejected'

export interface FriendLink {
  id: number
  name: string
  url: string
  avatar: string
  description: string
  groupName: string
  /** 审核状态；公开列表只返回 approved，阶段 4 后台用它做审核 */
  status?: FriendLinkStatus
}

/**
 * 友链申请入参。
 * 参考站的做法是「在留言板按固定格式留言」来申请，没有独立表单，
 * 所以这里只作为后台手动录入 / 阶段 4 从留言一键转友链时的数据结构。
 */
export interface FriendLinkInput {
  name: string
  url: string
  description: string
  avatar?: string
}

/** 留言板条目 */
export interface GuestbookEntry {
  id: number
  nickname: string
  /** 邮箱不公开展示，仅用于站长联系申请人 */
  email: string
  content: string
  /** 站长回复，空字符串表示未回复 */
  reply: string
  createdAt: string
  /** 内容里含链接时自动标记，方便阶段 4 后台筛出友链申请 */
  isFriendLinkApply?: boolean
}

/** 留言板发布入参 */
export interface GuestbookInput {
  nickname: string
  email?: string
  content: string
}

export interface Comment {
  id: number
  targetType: 'post' | 'moment' | 'guestbook'
  targetId: number
  parentId: number
  userLogin: string
  userName: string
  userAvatar: string
  content: string
  createdAt: string
  replies?: Comment[]
}

/** 当前登录用户（评论身份，来自 GitHub OAuth） */
export interface CurrentUser {
  id: number
  /** GitHub 用户名（用于拼个人主页链接） */
  login: string
  /** 展示名（GitHub name，没填就是 login） */
  name: string
  avatar: string
  /** github | local | email */
  provider: string
  role: string
}

/** GET /api/auth/me 的返回 */
export interface AuthState {
  user: CurrentUser | null
  /** 站长是否已经配置 GitHub OAuth —— 没配就不显示登录按钮 */
  githubEnabled: boolean
}

/** 发表评论入参 */
export interface CommentInput {
  targetType: 'post' | 'moment'
  targetId: number
  /** 回复某条评论时填它的 id；0 或缺省表示发顶层评论 */
  parentId?: number
  content: string
}

/** 站点设置：后台「站点设置」可改，前端启动时拉取 */
export interface SiteSettings {
  /** 报头站名 */
  siteName: string
  /** 报头副标题 / 一句话简介 */
  tagline: string
  /** 报头上方的小字导语（kicker） */
  kicker: string
  /** 作者昵称 */
  author: string
  authorAvatar: string
  authorBio: string
  /** 页脚版权主体 */
  copyright: string
  /** ICP 备案号（可空） */
  icp: string
  /** 主题强调色，覆盖 --c-accent */
  accentColor: string
  /**
   * 社交链接
   * ------------------------------------------------------------
   * 分两类，首页站长卡片按这个规则决定点击行为：
   *   · 网址（http/https）→ 直接跳转
   *   · 号码 / 用户名（不是网址）→ 弹「复制」框（微信、QQ 用得上）
   */
  social: {
    github?: string
    email?: string
    /** 微信号：填号弹复制框，填网址则跳转 */
    wechat?: string
    /** QQ 号：同上 */
    qq?: string
    rss?: string
  }
  /** AI 聊天是否开启（阶段 5） */
  chatEnabled: boolean
}

/** 列表分页返回 */
export interface Paginated<T> {
  items: T[]
  page: number
  perPage: number
  total: number
  totalPages: number
}

/** 访客统计 */
export interface Stats {
  online: number
  todayPv: number
  todayUv: number
  totalPv: number
  totalUv: number
}

/** 文章列表查询参数 */
export interface PostQuery {
  page?: number
  perPage?: number
  category?: string
  tag?: string
  q?: string
  /** 列表排序：最新 / 最热 */
  sort?: 'latest' | 'popular'
}
