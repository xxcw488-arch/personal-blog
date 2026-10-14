/**
 * mock 适配层
 * ------------------------------------------------------------
 * 让组件在阶段 1 就能用真实接口的调用方式跑起来。
 * 每个方法都加了一点延迟，以便顺带验证骨架屏 / 加载态是否正常。
 */

import type {
  Album,
  AuthState,
  Category,
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
} from '@/types'
import {
  rawCategories,
  rawPosts,
  rawTags,
  type RawPost,
} from '@/data/posts'
import { defaultSettings } from '@/data/settings'
import { coverImage, albumCoverImage, avatarImage } from '@/utils/cover'

/** 模拟网络延迟（毫秒） */
const LATENCY = 220

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/* ---------- 把原始数据组装成完整模型 ---------- */

function toPost(raw: RawPost): Post {
  const category = rawCategories.find((c) => c.slug === raw.categorySlug) ?? null
  const tags = raw.tagSlugs
    .map((slug) => rawTags.find((t) => t.slug === slug))
    .filter((t): t is (typeof rawTags)[number] => Boolean(t))

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    excerpt: raw.excerpt,
    content: raw.content,
    contentFormat: raw.contentFormat,
    cover: raw.cover,
    coverCaption: raw.coverCaption,
    category,
    tags,
    status: 'published',
    views: raw.views,
    readingTime: raw.readingTime,
    isTop: raw.isTop,
    allowComment: true,
    publishedAt: raw.publishedAt,
    updatedAt: raw.updatedAt,
  }
}

const allPosts: Post[] = rawPosts
  .map(toPost)
  .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))

/* ============================================================
   读接口实现
   ============================================================ */

/** 发布日历：日期 + 当天篇数（与 /api/wp/post-dates 同形） */
export function getPostDates(): Promise<{ date: string; count: number }[]> {
  const counts = new Map<string, number>()
  for (const p of allPosts) {
    const date = p.publishedAt.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  const list = [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return delay(list, 60)
}

export function getPosts(query: PostQuery = {}): Promise<Paginated<Post>> {
  const { page = 1, perPage = 8, category, tag, q, sort = 'latest' } = query

  let list = [...allPosts]

  if (category) list = list.filter((p) => p.category?.slug === category)
  if (tag) list = list.filter((p) => p.tags.some((t) => t.slug === tag))
  if (q) {
    const kw = q.toLowerCase()
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(kw) ||
        p.excerpt.toLowerCase().includes(kw) ||
        p.content.toLowerCase().includes(kw),
    )
  }

  // 置顶优先，其次按排序方式
  list.sort((a, b) => {
    if (a.isTop !== b.isTop) return a.isTop ? -1 : 1
    if (sort === 'popular') return b.views - a.views
    return +new Date(b.publishedAt) - +new Date(a.publishedAt)
  })

  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const items = list.slice((safePage - 1) * perPage, safePage * perPage)

  return delay({ items, page: safePage, perPage, total, totalPages })
}

export function getPost(slug: string): Promise<Post> {
  const found = allPosts.find((p) => p.slug === slug)
  if (!found) return Promise.reject(new Error('文章不存在'))
  return delay(found)
}

export function getAdjacentPosts(
  slug: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  const i = allPosts.findIndex((p) => p.slug === slug)
  if (i < 0) return delay({ prev: null, next: null })
  // 列表按时间倒序：索引更小 = 更新
  return delay({
    prev: allPosts[i - 1] ?? null,
    next: allPosts[i + 1] ?? null,
  })
}

export function getRelatedPosts(slug: string, limit = 3): Promise<Post[]> {
  const cur = allPosts.find((p) => p.slug === slug)
  if (!cur) return delay([])
  const curTags = new Set(cur.tags.map((t) => t.slug))
  const scored = allPosts
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      post: p,
      score:
        p.tags.filter((t) => curTags.has(t.slug)).length * 2 +
        (p.category?.slug === cur.category?.slug ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.post)
  return delay(scored)
}

export function getCategories(): Promise<Category[]> {
  const withCount = rawCategories.map((c) => ({
    ...c,
    count: allPosts.filter((p) => p.category?.slug === c.slug).length,
  }))
  return delay(withCount)
}

export function getTags(): Promise<Tag[]> {
  const withCount = rawTags
    .map((t) => ({
      ...t,
      count: allPosts.filter((p) => p.tags.some((pt) => pt.slug === t.slug)).length,
    }))
    .filter((t) => (t.count ?? 0) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  return delay(withCount)
}

export function search(q: string): Promise<Post[]> {
  const kw = q.trim().toLowerCase()
  if (!kw) return delay([])
  const hits = allPosts.filter(
    (p) =>
      p.title.toLowerCase().includes(kw) ||
      p.excerpt.toLowerCase().includes(kw) ||
      p.content.toLowerCase().includes(kw),
  )
  return delay(hits)
}

/* ============================================================
   阶段 2 才做页面的模块：这里先给出可用的占位数据，
   让侧栏、首页横滑区在阶段 1 就有真实内容可看。
   ============================================================ */

const pic = (seed: string, w = 1200, h = 900) => coverImage(seed, w, h)
const albumPic = (seed: string) => albumCoverImage(seed)
const avatar = (seed: string, ch: string) => avatarImage(seed, ch)

const albums: Album[] = [
  {
    id: 1,
    slug: 'old-town',
    title: '老城区的一下午',
    description: '没有目的地，只是沿着巷子往里走。',
    cover: albumPic('old-town'),
    location: '老城区',
    takenAt: '2026-03-05',
    isFeatured: true,
    imageCount: 6,
  },
  {
    id: 2,
    slug: 'coastline',
    title: '海岸线',
    description: '风很大，浪一直没停。',
    cover: albumPic('coastline'),
    location: '东海岸',
    takenAt: '2026-02-14',
    isFeatured: true,
    imageCount: 5,
  },
  {
    id: 3,
    slug: 'night-market',
    title: '夜市',
    description: '灯亮起来之后，整条街都活了。',
    cover: albumPic('night-market'),
    location: '城南',
    takenAt: '2026-01-20',
    isFeatured: false,
    imageCount: 8,
  },
]

const moments: Moment[] = [
  {
    id: 1,
    content:
      '改了一晚上的 bug，最后发现是自己写错了变量名。这种时候既想笑又想砸键盘。',
    images: [],
    location: '',
    mood: '无奈',
    likes: 12,
    createdAt: '2026-03-18T23:40:00Z',
  },
  {
    id: 2,
    content: '楼下的糖水摊今天出摊了，芋圆还是那个味道。',
    images: [pic('dessert', 900, 900)],
    location: '城南',
    mood: '满足',
    likes: 28,
    createdAt: '2026-03-16T19:20:00Z',
  },
  {
    id: 3,
    content: '连续下了三天雨，终于放晴。窗台上的绿萝好像又长高了一点。',
    images: [pic('window-plant', 900, 900)],
    location: '',
    mood: '平静',
    likes: 19,
    createdAt: '2026-03-13T08:05:00Z',
  },
]

const music: Music[] = [
  {
    id: 1,
    title: '示例曲目 · 一',
    artist: '示例音乐人',
    album: '演示专辑',
    // 占位音频：阶段 2 换成你自己的 jsDelivr 直链
    audio: 'https://cdn.jsdelivr.net/gh/anars/blank-audio@master/2-seconds-of-silence.mp3',
    cover: pic('album-1', 600, 600),
    lyrics: '[00:00.00]这是示例歌词\n[00:02.00]阶段 2 会替换成真实曲目\n[00:04.00]并把音频放到 CDN 上',
    duration: 4,
  },
  {
    id: 2,
    title: '示例曲目 · 二',
    artist: '示例音乐人',
    album: '演示专辑',
    audio: 'https://cdn.jsdelivr.net/gh/anars/blank-audio@master/5-seconds-of-silence.mp3',
    cover: pic('album-2', 600, 600),
    lyrics: '[00:00.00]示例歌词第二首\n[00:03.00]支持 LRC 时间轴',
    duration: 5,
  },
]

const projects: Project[] = [
  {
    id: 1,
    name: '个人博客',
    description:
      '你现在看到的这个站点：Vue 3 + Cloudflare Pages Functions + D1，杂志排版，自带管理后台。',
    cover: pic('project-blog', 1200, 800),
    repoUrl: '',
    demoUrl: '',
    techStack: ['Vue 3', 'TypeScript', 'Vite', 'Cloudflare D1'],
    language: 'TypeScript',
    stars: 0,
    status: 'active',
    isFeatured: true,
  },
  {
    id: 2,
    name: '排版工具箱',
    description: '一组用于中文网页排版的小工具：行宽计算、标点挤压、字阶生成。',
    cover: pic('project-typo', 1200, 800),
    repoUrl: '',
    demoUrl: '',
    techStack: ['TypeScript', 'CSS'],
    language: 'TypeScript',
    stars: 0,
    status: 'wip',
    isFeatured: true,
  },
]

const links: FriendLink[] = [
  {
    id: 1,
    name: '示例友链',
    url: 'https://example.com',
    avatar: avatar('friend-1', '友'),
    description: '这里放朋友的站点，阶段 2 做成友链页。',
    groupName: '朋友',
  },
]

const stats: Stats = {
  online: 3,
  todayPv: 128,
  todayUv: 76,
  totalPv: 24680,
  totalUv: 8123,
}

export function getAlbums(): Promise<Album[]> {
  return delay(albums)
}
export function getAlbum(slug: string): Promise<Album> {
  const a = albums.find((x) => x.slug === slug)
  if (!a) return Promise.reject(new Error('相册不存在'))
  return delay(a)
}
export function getMoments(): Promise<Moment[]> {
  return delay(moments)
}
export function getMusic(): Promise<Music[]> {
  return delay(music)
}
export function getProjects(): Promise<Project[]> {
  return delay(projects)
}
export function getFriendLinks(): Promise<FriendLink[]> {
  return delay(links)
}
export function getStats(): Promise<Stats> {
  return delay(stats, 60)
}
/* ============================================================
   评论与身份（阶段 5）
   ------------------------------------------------------------
   注意：mock 模式**没有登录态**（GitHub OAuth 必须走真实后端），
   所以这里 githubEnabled 固定为 false、发评论直接报错。
   保留两条示例评论，是为了离线时也能看评论区版式。
   ============================================================ */

const comments: Comment[] = [  {
    id: 1,
    targetType: 'post',
    targetId: 1,
    parentId: 0,
    userLogin: 'octocat',
    userName: '示例读者',
    userAvatar: avatarImage('commenter-1', '读'),
    content: '这是离线 mock 模式下的示例评论，用来预览版式。真实评论要跑 npm run dev:local。',
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 2,
    targetType: 'post',
    targetId: 1,
    parentId: 1,
    userLogin: 'lulu',
    userName: '噜噜',
    userAvatar: avatarImage('commenter-2', '噜'),
    content: '回复也会缩进显示。',
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
]

export function getComments(targetType: string, targetId: number): Promise<Comment[]> {
  const mine = comments.filter((c) => c.targetType === targetType && c.targetId === targetId)
  const roots = mine
    .filter((c) => c.parentId === 0)
    .map((c) => ({ ...c, replies: mine.filter((r) => r.parentId === c.id).map((r) => ({ ...r })) }))
  return delay(roots, 60)
}

export function postComment(_input: CommentInput): Promise<Comment> {
  return Promise.reject(
    new Error('离线 mock 模式不支持发表评论（登录要真实后端），请用 npm run dev:local'),
  )
}

export function getCurrentUser(): Promise<AuthState> {
  return delay({ user: null, githubEnabled: false }, 30)
}

export function logoutUser(): Promise<{ ok: boolean }> {
  return delay({ ok: true })
}

export function getSettings(): Promise<SiteSettings> {
  return delay(defaultSettings, 40)
}

/* ============================================================
   留言板（阶段 2b）
   ------------------------------------------------------------
   用模块级可变数组，所以同一次会话里发布的留言会真实保留、
   刷新后回到初始数据。阶段 3 换成 D1 后，这里的语义完全一致。
   ============================================================ */

/** 内容长度上限，与前端计数器保持一致 */
export const GUESTBOOK_MAX_LENGTH = 500

let guestbookSeq = 1

const guestbook: GuestbookEntry[] = [
  {
    id: guestbookSeq,
    nickname: '第一位访客',
    email: '',
    content:
      '这里是示例留言。在下面的输入框里写点什么发布试试——会立刻出现在列表最上面（仅当前会话保留）。',
    reply: '欢迎，随便坐。',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
]

export function getGuestbook(): Promise<GuestbookEntry[]> {
  // 返回副本，避免调用方直接改到内部数组
  return delay(guestbook.map((e) => ({ ...e })))
}

export function postGuestbook(input: GuestbookInput): Promise<GuestbookEntry> {
  const nickname = input.nickname.trim() || '匿名'
  const content = input.content.trim()

  // 校验放在 mock 里，是为了让真实接口和本地开发的行为一致
  if (!content) return Promise.reject(new Error('留言内容不能为空'))
  if (content.length > GUESTBOOK_MAX_LENGTH) {
    return Promise.reject(new Error(`留言最多 ${GUESTBOOK_MAX_LENGTH} 字`))
  }

  const entry: GuestbookEntry = {
    id: ++guestbookSeq,
    nickname,
    email: input.email?.trim() ?? '',
    content,
    reply: '',
    createdAt: new Date().toISOString(),
    // 含链接的内容大概率是友链申请，阶段 4 后台可据此筛选
    isFriendLinkApply: /https?:\/\//i.test(content),
  }

  guestbook.unshift(entry)
  return delay({ ...entry }, 420)
}
