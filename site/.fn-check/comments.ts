/**
 * 阶段 5（评论 + 访客统计）的端到端断言
 * ------------------------------------------------------------
 * 由 run.ts 调用，共用同一个测试数据库与断言计数器。
 *
 * GitHub OAuth 那部分没法真的去访问 github.com，所以把 globalThis.fetch
 * 换成桩：只断言**我们自己的逻辑**（state 校验、upsert、建会话、下发 cookie），
 * 而不是 GitHub 的 API 行为。
 */

import { makeContext, callJson, queryOne } from './harness'
import type { Database } from 'sql.js'

import { onRequestGet as listComments, onRequestPost as postComment } from '../functions/api/comments'
import { onRequestGet as listPosts } from '../functions/api/wp/posts'
import { onRequestGet as getPost } from '../functions/api/wp/posts/[slug]'
import { onRequestGet as startGithub } from '../functions/api/auth/github'
import { onRequestGet as githubCallback } from '../functions/api/auth/github/callback'
import { onRequestGet as authMe } from '../functions/api/auth/me'
import { onRequestPost as authLogout } from '../functions/api/auth/logout'
import { onRequestGet as getStats, onRequestPost as recordStats } from '../functions/api/stats'
import { dayKey } from '../functions/_lib/stats'

const BASE = 'https://blog.test'
const TARGET = { targetType: 'post', targetId: 1 }

type Ok = (name: string, cond: boolean, extra?: string) => void

/** 测试用的 OAuth 配置（与真实 Secret 无关） */
const OAUTH_ENV = {
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
}

const GH_PROFILE = {
  id: 1234567,
  login: 'octocat',
  name: '莫妮卡',
  avatar_url: 'https://avatars.example/u/1234567',
  email: null,
}

/* ============================================================
   辅助
   ============================================================ */

/** 从（可能被合并成一个字符串的）Set-Cookie 头里取出指定 cookie 的 `name=value` */
function setCookieValue(headers: Headers, name: string): string {
  const all = headers.get('Set-Cookie') ?? ''
  for (const part of all.split(',')) {
    const kv = (part.trim().split(';')[0] ?? '').trim()
    if (kv.startsWith(`${name}=`)) return kv
  }
  return ''
}

/** 把 globalThis.fetch 换成 GitHub 桩；返回还原函数 */
function stubGithub(profile: Record<string, unknown> = GH_PROFILE): () => void {
  const real = globalThis.fetch
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input)
    if (url.includes('login/oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'gho_fake_token' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('api.github.com/user')) {
      return new Response(JSON.stringify(profile), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error(`测试桩收到未预期的 fetch：${url}`)
  }) as typeof globalThis.fetch
  return () => {
    globalThis.fetch = real
  }
}

const call = (handler: never, opts: Parameters<typeof makeContext>[1], db: Database) =>
  callJson(handler as never, makeContext(db, opts))

/** 走完一次完整的 GitHub 登录，返回 mb_user cookie */
async function login(db: Database, profile = GH_PROFILE): Promise<string> {
  const restore = stubGithub(profile)
  try {
    const start = await call(startGithub as never, { url: `${BASE}/api/auth/github`, env: OAUTH_ENV }, db)
    const stateCookie = setCookieValue(start.headers, 'mb_oauth_state')
    const state = decodeURIComponent(stateCookie.split('=')[1] ?? '')

    const cb = await call(
      githubCallback as never,
      {
        url: `${BASE}/api/auth/github/callback?code=fake_code&state=${state}`,
        headers: { Cookie: stateCookie },
        env: OAUTH_ENV,
      },
      db,
    )
    return setCookieValue(cb.headers, 'mb_user')
  } finally {
    restore()
  }
}

/* ============================================================
   评论
   ============================================================ */

export async function runCommentTests(db: Database, ok: Ok): Promise<void> {
  /**
   * 限流断言要往「另一篇真实存在的文章」发，才能避免污染上面那条目标的评论列表。
   * 注意必须是真的存在的 id：接口现在会先校验目标（不存在直接 404），
   * 用一个虚构 id 会测不到限流。
   */
  const sidePostId = Number(
    queryOne(
      db,
      "SELECT id FROM posts WHERE status = 'published' AND deleted_at IS NULL AND id <> 1 ORDER BY id DESC LIMIT 1",
    )?.id ?? 0,
  )
  const SIDE_TARGET = { targetType: 'post' as const, targetId: sidePostId }

  /* ---------- 未登录：读得到，写不了 ---------- */
  console.log('\n=== GET /api/comments（还没有评论）===')
  {
    const r = await call(
      listComments as never,
      { url: `${BASE}/api/comments?targetType=post&targetId=1` },
      db,
    )
    ok('状态码 200', r.status === 200, `got ${r.status}`)
    ok('返回空数组', Array.isArray(r.body) && (r.body as unknown[]).length === 0)
    ok(
      '响应禁止缓存（刚发的评论必须立刻可见）',
      (r.headers.get('Cache-Control') ?? '').includes('no-store'),
      r.headers.get('Cache-Control') ?? '',
    )
  }

  console.log('\n=== GET /api/comments（参数校验）===')
  {
    const badType = await call(
      listComments as never,
      { url: `${BASE}/api/comments?targetType=bogus&targetId=1` },
      db,
    )
    ok('非法 targetType → 400', badType.status === 400, `got ${badType.status}`)

    const badId = await call(
      listComments as never,
      { url: `${BASE}/api/comments?targetType=post&targetId=0` },
      db,
    )
    ok('非法 targetId → 400', badId.status === 400, `got ${badId.status}`)

    const noId = await call(
      listComments as never,
      { url: `${BASE}/api/comments?targetType=post` },
      db,
    )
    ok('缺少 targetId → 400', noId.status === 400, `got ${noId.status}`)
  }

  console.log('\n=== POST /api/comments（未登录必须被挡住）===')
  {
    const r = await call(
      postComment as never,
      { url: `${BASE}/api/comments`, method: 'POST', body: { ...TARGET, content: '匿名灌水' } },
      db,
    )
    ok('未登录 → 401', r.status === 401, `got ${r.status}`)
    ok('错误信息提示要登录', String((r.body as { error?: string })?.error ?? '').includes('登录'))
  }

  /* ---------- OAuth ---------- */
  console.log('\n=== GET /api/auth/github（跳转 GitHub）===')
  {
    const r = await call(
      startGithub as never,
      { url: `${BASE}/api/auth/github?redirect=/article/hello`, env: OAUTH_ENV },
      db,
    )
    const loc = r.headers.get('Location') ?? ''
    ok('状态码 302', r.status === 302, `got ${r.status}`)
    ok('跳到 github.com/login/oauth/authorize', loc.startsWith('https://github.com/login/oauth/authorize'), loc)
    ok('带上 client_id', loc.includes('client_id=test-client-id'))
    ok('回调地址由请求 origin 推导', loc.includes(encodeURIComponent(`${BASE}/api/auth/github/callback`)))
    ok('只申请 read:user 权限', loc.includes('scope=read%3Auser') || loc.includes('scope=read:user'))
    ok('下发了 state cookie', setCookieValue(r.headers, 'mb_oauth_state').length > 0)
    ok('state cookie 是 HttpOnly', (r.headers.get('Set-Cookie') ?? '').includes('HttpOnly'))

    // 开放重定向防护
    const evil = await call(
      startGithub as never,
      { url: `${BASE}/api/auth/github?redirect=https://evil.example/steal`, env: OAUTH_ENV },
      db,
    )
    const nextCookie = setCookieValue(evil.headers, 'mb_oauth_next')
    ok('站外 redirect 被清洗成 /', nextCookie === 'mb_oauth_next=%2F', nextCookie)

    const proto = await call(
      startGithub as never,
      { url: `${BASE}/api/auth/github?redirect=//evil.example`, env: OAUTH_ENV },
      db,
    )
    ok('协议相对地址也被清洗', setCookieValue(proto.headers, 'mb_oauth_next') === 'mb_oauth_next=%2F')
  }

  console.log('\n=== 未配置 GitHub OAuth 时的降级 ===')
  {
    const r = await call(startGithub as never, { url: `${BASE}/api/auth/github` }, db)
    ok('未配置 → 503', r.status === 503, `got ${r.status}`)

    const me = await call(authMe as never, { url: `${BASE}/api/auth/me` }, db)
    const b = me.body as { user: unknown; githubEnabled: boolean }
    ok('me 返回 githubEnabled=false（前端据此隐藏登录按钮）', b.githubEnabled === false)
    ok('未登录时 user 为 null', b.user === null)
  }

  console.log('\n=== GET /api/auth/github/callback（state 校验）===')
  {
    const restore = stubGithub()
    try {
      const noState = await call(
        githubCallback as never,
        { url: `${BASE}/api/auth/github/callback?code=x`, env: OAUTH_ENV },
        db,
      )
      ok('缺 state → 400', noState.status === 400, `got ${noState.status}`)

      const wrongState = await call(
        githubCallback as never,
        {
          url: `${BASE}/api/auth/github/callback?code=x&state=deadbeef`,
          headers: { Cookie: 'mb_oauth_state=0123456789abcdef' },
          env: OAUTH_ENV,
        },
        db,
      )
      ok('state 不匹配 → 400（防登录 CSRF）', wrongState.status === 400, `got ${wrongState.status}`)
      ok(
        '提示是 state 校验失败',
        String((wrongState.body as { error?: string })?.error ?? '').includes('state'),
      )

      const denied = await call(
        githubCallback as never,
        { url: `${BASE}/api/auth/github/callback?error=access_denied`, env: OAUTH_ENV },
        db,
      )
      ok('用户取消授权 → 302 跳回而不是报错', denied.status === 302, `got ${denied.status}`)
      ok(
        '跳回时带 login=denied 标记',
        (denied.headers.get('Location') ?? '').includes('login=denied'),
        denied.headers.get('Location') ?? '',
      )
    } finally {
      restore()
    }
  }

  /* ---------- 登录并发表 ---------- */
  const userCookie = await login(db)
  console.log('\n=== 完整 GitHub 登录流程 ===')
  {
    ok('回调下发了 mb_user cookie', userCookie.startsWith('mb_user=') && userCookie.length > 12, userCookie)

    const row = queryOne(
      db,
      "SELECT id, username, nickname, avatar, provider, provider_uid, role, status FROM users WHERE provider = 'github'",
    )
    ok('用户已落库', row !== null)
    ok('username 加了 gh_ 前缀（避免与管理员撞名）', row?.username === 'gh_octocat', String(row?.username))
    ok('存的是 GitHub 数字 id（邮箱可改、id 不变）', row?.provider_uid === '1234567')
    ok('昵称取 name 而不是 login', row?.nickname === '莫妮卡', String(row?.nickname))
    ok('头像是 GitHub 头像地址', String(row?.avatar ?? '').includes('avatars.example'))
    ok('角色是普通用户而不是管理员', row?.role === 'user', String(row?.role))
    ok('状态 active', row?.status === 'active')

    const me = await call(authMe as never, { url: `${BASE}/api/auth/me`, headers: { Cookie: userCookie }, env: OAUTH_ENV }, db)
    const b = me.body as { user: { login: string; name: string } | null; githubEnabled: boolean }
    ok('me 返回已登录用户', b.user?.login === 'octocat', JSON.stringify(b.user))
    ok('githubEnabled=true', b.githubEnabled === true)
    ok('身份响应禁止缓存（否则会串号）', (me.headers.get('Cache-Control') ?? '').includes('no-store'))
  }

  console.log('\n=== POST /api/comments（登录后发表）===')
  let firstCommentId = 0
  {
    const r = await call(
      postComment as never,
      {
        url: `${BASE}/api/comments`,
        method: 'POST',
        headers: { Cookie: userCookie },
        body: { ...TARGET, content: '第一层评论：写得不错' },
      },
      db,
    )
    const b = r.body as { id: number; content: string; userName: string; userAvatar: string; userLogin: string; parentId: number }
    ok('状态码 201', r.status === 201, `got ${r.status}`)
    ok('内容原样返回', b.content === '第一层评论：写得不错')
    ok('带上用户名（来自 GitHub 资料）', b.userName === '莫妮卡', b.userName)
    ok('带上 GitHub login', b.userLogin === 'octocat', b.userLogin)
    ok('带上头像', b.userAvatar.includes('avatars.example'))
    ok('parentId 默认 0', b.parentId === 0)
    firstCommentId = b.id

    const stored = queryOne(db, `SELECT status, provider, ip_hash, target_type, target_id FROM comments WHERE id = ${firstCommentId}`)
    ok('落库状态是 approved', stored?.status === 'approved', String(stored?.status))
    ok('记录了身份来源 github', stored?.provider === 'github')
    ok('只存 IP 哈希，不存明文 IP', String(stored?.ip_hash ?? '').length === 64, String(stored?.ip_hash))
    ok('明文 IP 没有进库', !String(stored?.ip_hash ?? '').includes('203.0.113.7'))
    ok('target 关联正确', stored?.target_type === 'post' && stored?.target_id === 1)
  }

  console.log('\n=== POST /api/comments（回复）===')
  {
    const r = await call(
      postComment as never,
      {
        url: `${BASE}/api/comments`,
        method: 'POST',
        headers: { Cookie: userCookie },
        body: { ...TARGET, parentId: firstCommentId, content: '第二层：回复我自己' },
      },
      db,
    )
    ok('回复返回 201', r.status === 201, `got ${r.status}`)
    ok('parentId 已记录', (r.body as { parentId: number }).parentId === firstCommentId)

    const list = await call(
      listComments as never,
      { url: `${BASE}/api/comments?targetType=post&targetId=1` },
      db,
    )
    const arr = list.body as { id: number; replies?: { content: string }[] }[]
    ok('顶层只有 1 条', arr.length === 1, `got ${arr.length}`)
    ok('回复挂在顶层评论的 replies 里', (arr[0]?.replies ?? []).length === 1, JSON.stringify(arr[0]?.replies))
    ok('回复内容正确', arr[0]?.replies?.[0]?.content === '第二层：回复我自己')
  }

  console.log('\n=== POST /api/comments（内容与参数校验）===')
  {
    const empty = await call(
      postComment as never,
      { url: `${BASE}/api/comments`, method: 'POST', headers: { Cookie: userCookie }, body: { ...TARGET, content: '   ' } },
      db,
    )
    ok('空内容 → 400', empty.status === 400, `got ${empty.status}`)

    const tooLong = await call(
      postComment as never,
      { url: `${BASE}/api/comments`, method: 'POST', headers: { Cookie: userCookie }, body: { ...TARGET, content: 'x'.repeat(1001) } },
      db,
    )
    ok('超过 1000 字 → 400', tooLong.status === 400, `got ${tooLong.status}`)

    const badParent = await call(
      postComment as never,
      { url: `${BASE}/api/comments`, method: 'POST', headers: { Cookie: userCookie }, body: { ...TARGET, parentId: 999999, content: '回复不存在的评论' } },
      db,
    )
    ok('回复不存在的评论 → 400', badParent.status === 400, `got ${badParent.status}`)

    const crossTarget = await call(
      postComment as never,
      {
        url: `${BASE}/api/comments`,
        method: 'POST',
        headers: { Cookie: userCookie },
        body: { ...SIDE_TARGET, parentId: firstCommentId, content: '跨目标回复' },
      },
      db,
    )
    ok('回复别篇文章的评论 → 400', crossTarget.status === 400, `got ${crossTarget.status}`)

    const badJsonCtx = makeContext(db, {
      url: `${BASE}/api/comments`,
      method: 'POST',
      headers: { Cookie: userCookie },
    })
    const badJson = await callJson(postComment as never, {
      ...badJsonCtx,
      // 故意塞一个不是 JSON 的 body（makeContext 只会 JSON.stringify，所以这里手搓请求）
      request: new Request(`${BASE}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userCookie },
        body: 'not-json',
      }),
    } as never)
    ok('非法 JSON → 400', badJson.status === 400, `got ${badJson.status}`)
  }

  console.log('\n=== GET /api/comments（不公开未审核内容）===')
  {
    db.run(
      `INSERT INTO comments (target_type, target_id, parent_id, provider, provider_uid, user_login, user_name, user_avatar, content, status)
       VALUES ('post', 1, 0, 'github', '9', 'spammer', '广告号', '', '买粉丝找我', 'pending')`,
    )
    const list = await call(
      listComments as never,
      { url: `${BASE}/api/comments?targetType=post&targetId=1` },
      db,
    )
    const arr = list.body as { content: string }[]
    ok('pending 评论不出现在公开列表', !arr.some((c) => c.content.includes('买粉丝')))
    ok('公开列表仍是 1 条顶层', arr.length === 1, `got ${arr.length}`)
  }

  console.log('\n=== POST /api/comments（限流 10 条/小时）===')
  {
    // 前面的断言里已经发过几条（其中一部分因为参数不合法被挡下 ——
    // 限流在参数校验之后、回复校验之前，所以非法请求同样计数，
    // 这是刻意的：防刷屏时「尝试次数」比「成功次数」更该被限制）。
    // 因此这里不断言精确的第几条，而是断言：成功次数不超过上限，且最终会被挡住。
    let successes = 0
    let blocked: { status: number; error: string } | null = null

    for (let i = 0; i < 15 && !blocked; i++) {
      const r = await call(
        postComment as never,
        {
          url: `${BASE}/api/comments`,
          method: 'POST',
          headers: { Cookie: userCookie },
          body: { ...SIDE_TARGET, content: `灌水第 ${i + 1} 条` },
        },
        db,
      )
      if (r.status === 201) successes++
      else blocked = { status: r.status, error: String((r.body as { error?: string })?.error ?? '') }
    }

    ok('确实发出去了若干条', successes > 0, `got ${successes}`)
    ok('成功次数不超过 10 条上限', successes <= 10, `got ${successes}`)
    ok('超限后返回 429', blocked?.status === 429, `got ${blocked?.status}`)
    ok('限流提示里有等待时间', /分钟/.test(blocked?.error ?? ''), blocked?.error ?? '')

    // 被限流后继续发，仍然被挡住（不是只挡一次）
    const again = await call(
      postComment as never,
      {
        url: `${BASE}/api/comments`,
        method: 'POST',
        headers: { Cookie: userCookie },
        body: { ...SIDE_TARGET, content: '限流期间再试一次' },
      },
      db,
    )
    ok('限流窗口内继续发仍被挡住', again.status === 429, `got ${again.status}`)
  }

  console.log('\n=== 回归：后台「允许评论」开关要真的生效 ===')
  {
    // 曾经 toPostListItem 把 allowComment 写死成 true，
    // 于是后台把开关关掉、库里也存了 0，公开接口却还是说「允许评论」。
    const detail = await call(
      getPost as never,
      { url: `${BASE}/api/wp/posts/why-i-built-a-magazine-style-blog`, params: { slug: 'why-i-built-a-magazine-style-blog' } },
      db,
    )
    ok('详情接口带 allowComment 字段', typeof (detail.body as { allowComment?: unknown }).allowComment === 'boolean')
    ok('默认允许评论', (detail.body as { allowComment: boolean }).allowComment === true)

    // 关掉它
    db.run("UPDATE posts SET allow_comment = 0 WHERE slug = 'why-i-built-a-magazine-style-blog'")

    const closed = await call(
      getPost as never,
      { url: `${BASE}/api/wp/posts/why-i-built-a-magazine-style-blog`, params: { slug: 'why-i-built-a-magazine-style-blog' } },
      db,
    )
    ok('关掉后详情接口返回 false', (closed.body as { allowComment: boolean }).allowComment === false)

    const list = await call(listPosts as never, { url: `${BASE}/api/wp/posts` }, db)
    const inList = (list.body as { items: { slug: string; allowComment: boolean }[] }).items.find(
      (p) => p.slug === 'why-i-built-a-magazine-style-blog',
    )
    ok('列表接口也带上真实值', inList?.allowComment === false, JSON.stringify(inList?.allowComment))

    // 后端必须自己拦：前端隐藏输入框挡不住直接打接口的人
    const blocked = await call(
      postComment as never,
      {
        url: `${BASE}/api/comments`,
        method: 'POST',
        headers: { Cookie: userCookie },
        body: { targetType: 'post', targetId: 1, content: '关掉评论后还想发' },
      },
      db,
    )
    ok('关闭评论后发表 → 403', blocked.status === 403, `got ${blocked.status}`)

    // 复原，避免影响后面的断言
    db.run("UPDATE posts SET allow_comment = 1 WHERE slug = 'why-i-built-a-magazine-style-blog'")
  }

  console.log('\n=== POST /api/comments（目标必须真实存在）===')
  {
    const ghost = await call(
      postComment as never,
      {
        url: `${BASE}/api/comments`,
        method: 'POST',
        headers: { Cookie: userCookie },
        body: { targetType: 'post', targetId: 999999, content: '给不存在的文章评论' },
      },
      db,
    )
    ok('文章不存在 → 404', ghost.status === 404, `got ${ghost.status}`)

    const ghostMoment = await call(
      postComment as never,
      {
        url: `${BASE}/api/comments`,
        method: 'POST',
        headers: { Cookie: userCookie },
        body: { targetType: 'moment', targetId: 999999, content: '给不存在的碎碎念评论' },
      },
      db,
    )
    ok('碎碎念不存在 → 404', ghostMoment.status === 404, `got ${ghostMoment.status}`)
  }

  console.log('\n=== POST /api/auth/logout ===')
  {
    const out = await call(authLogout as never, { url: `${BASE}/api/auth/logout`, method: 'POST', headers: { Cookie: userCookie }, env: OAUTH_ENV }, db)
    ok('登出返回 200', out.status === 200, `got ${out.status}`)
    ok('清 Cookie 的 Max-Age=0', (out.headers.get('Set-Cookie') ?? '').includes('Max-Age=0'))

    const me = await call(authMe as never, { url: `${BASE}/api/auth/me`, headers: { Cookie: userCookie }, env: OAUTH_ENV }, db)
    ok('登出后 me 返回 null（会话立即失效）', (me.body as { user: unknown }).user === null)

    const after = await call(
      postComment as never,
      { url: `${BASE}/api/comments`, method: 'POST', headers: { Cookie: userCookie }, body: { ...TARGET, content: '登出后还想发' } },
      db,
    )
    ok('登出后不能再发评论 → 401', after.status === 401, `got ${after.status}`)
  }

  console.log('\n=== 留言板复用登录身份 ===')
  {
    const userCookie2 = await login(db, { ...GH_PROFILE, id: 7654321, login: 'lulu', name: '噜噜' })
    const { onRequestPost: postGuestbook } = await import('../functions/api/guestbook')
    const r = await call(
      postGuestbook as never,
      {
        url: `${BASE}/api/guestbook`,
        method: 'POST',
        // 换一个 IP：留言板是「按 IP 每小时 5 条」限流，前面的留言板断言已经用掉了额度
        headers: { Cookie: userCookie2, 'CF-Connecting-IP': '198.51.100.77' },
        body: { nickname: '随便填的昵称', content: '登录后留言应该用 GitHub 昵称' },
      },
      db,
    )
    ok('登录后留言成功', r.status === 201, `got ${r.status}`)
    ok('昵称来自会话而不是输入框', (r.body as { nickname: string }).nickname === '噜噜', JSON.stringify(r.body))
  }
}

/* ============================================================
   访客统计
   ============================================================ */

export async function runStatsTests(db: Database, ok: Ok): Promise<void> {
  console.log('\n=== GET /api/stats（初始为 0）===')
  {
    const r = await call(getStats as never, { url: `${BASE}/api/stats` }, db)
    const b = r.body as Record<string, number>
    ok('状态码 200', r.status === 200, `got ${r.status}`)
    ok('五个字段齐全', ['online', 'todayPv', 'todayUv', 'totalPv', 'totalUv'].every((k) => typeof b[k] === 'number'), JSON.stringify(b))
    ok('初始 pv 为 0', b.totalPv === 0, `got ${b.totalPv}`)
    ok('统计禁止缓存（否则在线人数没意义）', (r.headers.get('Cache-Control') ?? '').includes('no-store'))
  }

  console.log('\n=== POST /api/stats（记录一次访问）===')
  {
    const r = await call(
      recordStats as never,
      { url: `${BASE}/api/stats?path=/`, method: 'POST', headers: { 'CF-Connecting-IP': '198.51.100.1' } },
      db,
    )
    const b = r.body as Record<string, number>
    ok('状态码 200', r.status === 200, `got ${r.status}`)
    ok('一次调用就返回最新快照', b.todayPv === 1, JSON.stringify(b))
    ok('todayUv = 1', b.todayUv === 1)
    ok('online = 1', b.online === 1)
    ok('totalPv = 1', b.totalPv === 1)

    // 同一个 IP 再来一次：PV 加、UV 不加
    const r2 = await call(
      recordStats as never,
      { url: `${BASE}/api/stats?path=/article/hello`, method: 'POST', headers: { 'CF-Connecting-IP': '198.51.100.1' } },
      db,
    )
    const b2 = r2.body as Record<string, number>
    ok('同一访客再访问：PV 累加', b2.todayPv === 2, JSON.stringify(b2))
    ok('同一访客再访问：UV 不重复计', b2.todayUv === 1, `got ${b2.todayUv}`)

    // 换一个 IP：UV 也加
    const r3 = await call(
      recordStats as never,
      { url: `${BASE}/api/stats?path=/`, method: 'POST', headers: { 'CF-Connecting-IP': '198.51.100.2' } },
      db,
    )
    const b3 = r3.body as Record<string, number>
    ok('新访客：PV = 3', b3.todayPv === 3, `got ${b3.todayPv}`)
    ok('新访客：UV = 2', b3.todayUv === 2, `got ${b3.todayUv}`)
    ok('在线人数 = 2', b3.online === 2, `got ${b3.online}`)

    const daily = queryOne(db, `SELECT pv, uv FROM visitor_daily WHERE day = '${dayKey()}'`)
    ok('visitor_daily 落库正确', daily?.pv === 3 && daily?.uv === 2, JSON.stringify(daily))

    const seenCount = queryOne(db, 'SELECT COUNT(*) AS c FROM visitor_seen')
    ok('visitor_seen 只写了两行（按天去重）', seenCount?.c === 2, JSON.stringify(seenCount))

    const firstPath = queryOne(db, "SELECT path FROM visitor_seen WHERE ip_hash = (SELECT ip_hash FROM visitor_seen LIMIT 1)")
    ok('记录了当天首次落在哪一页', typeof firstPath?.path === 'string' && String(firstPath.path).startsWith('/'))
  }

  console.log('\n=== 爬虫不计入统计 ===')
  {
    const before = (await call(getStats as never, { url: `${BASE}/api/stats` }, db)).body as Record<string, number>
    const r = await call(
      recordStats as never,
      {
        url: `${BASE}/api/stats?path=/feed.xml`,
        method: 'POST',
        headers: { 'CF-Connecting-IP': '198.51.100.9', 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
      },
      db,
    )
    const after = r.body as Record<string, number>
    ok('爬虫请求不增加 PV', after.todayPv === before.todayPv, `${before.todayPv} → ${after.todayPv}`)
    ok('爬虫请求不增加 UV', after.todayUv === before.todayUv)
    ok('爬虫也不计入在线', after.online === before.online, `${before.online} → ${after.online}`)

    const human = await call(
      recordStats as never,
      {
        url: `${BASE}/api/stats?path=/`,
        method: 'POST',
        headers: { 'CF-Connecting-IP': '198.51.100.10', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      },
      db,
    )
    ok('正常浏览器 UA 计入', (human.body as Record<string, number>).todayPv === before.todayPv + 1)
  }

  console.log('\n=== 在线判定与历史累计 ===')
  {
    // 10 分钟前的心跳应该算离线（窗口是 5 分钟）
    const stale = Math.floor(Date.now() / 1000) - 600
    db.run(`INSERT INTO visitor_online (ip_hash, last_seen) VALUES ('stale-hash', ${stale})`)
    const r = await call(getStats as never, { url: `${BASE}/api/stats` }, db)
    const b = r.body as Record<string, number>
    ok('过期心跳不算在线', b.online === 3, `got ${b.online}`)

    // 昨天有 5 PV / 3 UV：应该进 totalPv 但不进 todayPv
    const yesterday = dayKey(Date.now() - 24 * 3600 * 1000)
    db.run(`INSERT INTO visitor_daily (day, pv, uv) VALUES ('${yesterday}', 5, 3)`)
    const r2 = await call(getStats as never, { url: `${BASE}/api/stats` }, db)
    const b2 = r2.body as Record<string, number>
    ok('历史 PV 计入 totalPv', b2.totalPv === 9, `got ${b2.totalPv}`)
    ok('历史 UV 计入 totalUv', b2.totalUv === 6, `got ${b2.totalUv}`)
    ok('昨天的数据不算今日 PV', b2.todayPv === 4, `got ${b2.todayPv}`)
    ok('昨天的数据不算今日 UV', b2.todayUv === 3, `got ${b2.todayUv}`)
  }

  console.log('\n=== 按东八区切天 ===')
  {
    // UTC 2026-01-01 17:00 = 北京时间 2026-01-02 01:00
    const t = Date.UTC(2026, 0, 1, 17, 0, 0)
    ok('UTC 17:00 已算作次日（东八区）', dayKey(t) === '2026-01-02', dayKey(t))
    ok(
      'UTC 15:59 仍算当日',
      dayKey(Date.UTC(2026, 0, 1, 15, 59, 0)) === '2026-01-01',
      dayKey(Date.UTC(2026, 0, 1, 15, 59, 0)),
    )
  }
}
