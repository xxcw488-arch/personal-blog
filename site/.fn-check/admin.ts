/**
 * 管理后台的端到端断言
 * 由 run.ts 调用，共用同一个测试数据库与断言计数器。
 */

import { makeContext, makeR2, callJson, queryOne } from './harness'
import type { Database } from 'sql.js'

import { onRequestGet as adminStatus } from '../functions/api/admin/status'
import { onRequestPost as adminSetup } from '../functions/api/admin/setup'
import { onRequestGet as adminSalt } from '../functions/api/admin/salt'
import { onRequestPost as adminLogin } from '../functions/api/admin/login'
import { runTaxonomyTests } from './taxonomy'
import { onRequestPost as adminLogout } from '../functions/api/admin/logout'
import { onRequestGet as adminMe } from '../functions/api/admin/me'
import {
  onRequestGet as adminListPosts,
  onRequestPost as adminCreatePost,
} from '../functions/api/admin/posts'
import {
  onRequestGet as adminReadPost,
  onRequestPut as adminUpdatePost,
  onRequestDelete as adminDeletePost,
} from '../functions/api/admin/posts/[id]'
import {
  onRequestGet as adminGetSettings,
  onRequestPut as adminPutSettings,
} from '../functions/api/admin/settings'
import { onRequestPost as adminUpload } from '../functions/api/admin/upload'
import { onRequestPost as guestbookToLink } from '../functions/api/admin/guestbook/[id]/to-link'
import { onRequestGet as publicListPosts } from '../functions/api/wp/posts'
import { onRequestGet as publicListLinks } from '../functions/api/wp/links'

const BASE = 'https://blog.test'
const PASSWORD = 'correct horse battery staple'
const USERNAME = 'admin'
/** 16 字节 hex，与服务端校验规则一致 */
const SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

type Ok = (name: string, cond: boolean, extra?: string) => void

/* ============================================================
   客户端 KDF（与浏览器里要做的完全一致）
   ============================================================ */

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** PBKDF2(password, salt, iterations) → verifier，这一步在真实环境由浏览器完成 */
async function deriveVerifier(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToHex(bits)
}

/** 从响应的 Set-Cookie 里取出 `name=value` 部分，供后续请求带上 */
function cookieOf(headers: Headers): string {
  return (headers.get('Set-Cookie') ?? '').split(';')[0] ?? ''
}

/* ============================================================
   主流程
   ============================================================ */

export async function runAdminTests(db: Database, ok: Ok): Promise<void> {
  const r2 = makeR2()
  const call = (handler: never, opts: Parameters<typeof makeContext>[1]) =>
    callJson(handler as never, makeContext(db, opts, r2))

  /* ---------- 初始化前 ---------- */
  console.log('\n=== 后台：初始化前 ===')
  {
    const r = await call(adminStatus as never, { url: `${BASE}/api/admin/status` })
    const b = r.body as { initialized: boolean; pbkdf2Iterations: number }
    ok('状态码 200', r.status === 200)
    ok('initialized = false', b.initialized === false)
    ok('下发了 PBKDF2 迭代次数 600000', b.pbkdf2Iterations === 600_000, `got ${b.pbkdf2Iterations}`)

    const salt = await call(adminSalt as never, { url: `${BASE}/api/admin/salt` })
    ok('未初始化时 salt 返回 404', salt.status === 404, `got ${salt.status}`)

    const me = await call(adminMe as never, { url: `${BASE}/api/admin/me` })
    ok('未登录时 me 返回 401', me.status === 401, `got ${me.status}`)
  }

  /* ---------- 参数校验 ---------- */
  console.log('\n=== 后台：初始化参数校验 ===')
  {
    const shortUser = await call(adminSetup as never, {
      url: `${BASE}/api/admin/setup`,
      method: 'POST',
      body: { username: 'ab', salt: SALT, verifier: 'f'.repeat(64) },
    })
    ok('用户名过短 400', shortUser.status === 400, `got ${shortUser.status}`)

    const badSalt = await call(adminSetup as never, {
      url: `${BASE}/api/admin/setup`,
      method: 'POST',
      body: { username: USERNAME, salt: 'not-hex', verifier: 'f'.repeat(64) },
    })
    ok('salt 格式不合法 400', badSalt.status === 400, `got ${badSalt.status}`)

    const badVerifier = await call(adminSetup as never, {
      url: `${BASE}/api/admin/setup`,
      method: 'POST',
      body: { username: USERNAME, salt: SALT, verifier: 'too-short' },
    })
    ok('verifier 格式不合法 400', badVerifier.status === 400, `got ${badVerifier.status}`)
  }

  /* ---------- 首次初始化 ---------- */
  const verifier = await deriveVerifier(PASSWORD, SALT, 600_000)
  console.log('\n=== 后台：首次初始化 ===')
  let sessionCookie = ''
  {
    ok('客户端已推导出 64 位 verifier', verifier.length === 64, `got ${verifier.length}`)

    const r = await call(adminSetup as never, {
      url: `${BASE}/api/admin/setup`,
      method: 'POST',
      body: { username: USERNAME, nickname: '站长', salt: SALT, verifier },
    })
    const b = r.body as { user: { username: string; role: string } }
    ok('返回 201', r.status === 201, `got ${r.status}`)
    ok('用户名正确', b.user?.username === USERNAME)
    ok('角色是 admin', b.user?.role === 'admin')

    sessionCookie = cookieOf(r.headers)
    ok('下发了会话 Cookie', sessionCookie.startsWith('mb_admin='), sessionCookie.slice(0, 20))
    ok('Cookie 带 HttpOnly', (r.headers.get('Set-Cookie') ?? '').includes('HttpOnly'))
    ok('Cookie 带 SameSite=Lax', (r.headers.get('Set-Cookie') ?? '').includes('SameSite=Lax'))

    // 数据库里存的应该是 v1$salt$hmac，且不等于 verifier 本身
    const row = queryOne(db, "SELECT password_hash FROM users WHERE username = 'admin'")
    const stored = String(row?.password_hash ?? '')
    ok('库里是 v1$salt$hash 格式', /^v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(stored), stored.slice(0, 24))
    ok('库里存的不是 verifier 明文', !stored.includes(verifier))
  }

  console.log('\n=== 后台：重复初始化应被拒绝 ===')
  {
    const again = await call(adminSetup as never, {
      url: `${BASE}/api/admin/setup`,
      method: 'POST',
      body: { username: 'hacker', salt: SALT, verifier: 'f'.repeat(64) },
    })
    ok('已初始化后返回 403', again.status === 403, `got ${again.status}`)
    const count = queryOne(db, "SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")
    ok('没有多出管理员账号', count?.n === 1, `got ${String(count?.n)}`)
  }

  /* ---------- 登录 ---------- */
  console.log('\n=== 后台：登录 ===')
  {
    const saltRes = await call(adminSalt as never, { url: `${BASE}/api/admin/salt` })
    const sb = saltRes.body as { salt: string; pbkdf2Iterations: number }
    ok('salt 接口返回 200', saltRes.status === 200)
    ok('返回的 salt 与初始化时一致', sb.salt === SALT, `got ${sb.salt}`)

    const wrong = await deriveVerifier('wrong password', SALT, 600_000)
    const bad = await call(adminLogin as never, {
      url: `${BASE}/api/admin/login`,
      method: 'POST',
      body: { username: USERNAME, verifier: wrong },
    })
    ok('口令错误返回 401', bad.status === 401, `got ${bad.status}`)

    const noUser = await call(adminLogin as never, {
      url: `${BASE}/api/admin/login`,
      method: 'POST',
      body: { username: 'nobody', verifier },
    })
    ok('用户名不存在也返回 401（不泄露）', noUser.status === 401, `got ${noUser.status}`)

    const good = await call(adminLogin as never, {
      url: `${BASE}/api/admin/login`,
      method: 'POST',
      body: { username: USERNAME, verifier },
    })
    ok('口令正确返回 200', good.status === 200, `got ${good.status}`)
    sessionCookie = cookieOf(good.headers)
    ok('重新下发了会话 Cookie', sessionCookie.startsWith('mb_admin='))

    // 库里只应有 token 的哈希，没有明文 token
    const plain = decodeURIComponent(sessionCookie.split('=')[1] ?? '')
    const srow = queryOne(db, 'SELECT COUNT(*) AS n FROM sessions')
    const byHash = queryOne(
      db,
      `SELECT COUNT(*) AS n FROM sessions WHERE token_hash = '${plain}'`,
    )
    ok('会话已写入数据库', Number(srow?.n ?? 0) >= 1)
    ok('库里没有明文 token（只存哈希）', Number(byHash?.n ?? 0) === 0)

    const me = await call(adminMe as never, {
      url: `${BASE}/api/admin/me`,
      headers: { Cookie: sessionCookie },
    })
    const mb = me.body as { user: { username: string } }
    ok('me 返回 200', me.status === 200)
    ok('me 返回正确用户', mb.user?.username === USERNAME)
  }

  /* ---------- 未授权访问 ---------- */
  console.log('\n=== 后台：未登录访问应被拒绝 ===')
  {
    const list = await call(adminListPosts as never, { url: `${BASE}/api/admin/posts` })
    ok('列表 401', list.status === 401, `got ${list.status}`)

    const create = await call(adminCreatePost as never, {
      url: `${BASE}/api/admin/posts`,
      method: 'POST',
      body: { title: 'x', slug: 'x' },
    })
    ok('创建 401', create.status === 401, `got ${create.status}`)

    const del = await call(adminDeletePost as never, {
      url: `${BASE}/api/admin/posts/1`,
      method: 'DELETE',
      params: { id: '1' },
    })
    ok('删除 401', del.status === 401, `got ${del.status}`)

    const settings = await call(adminGetSettings as never, { url: `${BASE}/api/admin/settings` })
    ok('设置 401', settings.status === 401, `got ${settings.status}`)

    const forged = await call(adminListPosts as never, {
      url: `${BASE}/api/admin/posts`,
      headers: { Cookie: 'mb_admin=deadbeef' },
    })
    ok('伪造 Cookie 也是 401', forged.status === 401, `got ${forged.status}`)
  }

  /* ---------- 文章 CRUD ---------- */
  console.log('\n=== 后台：文章 CRUD ===')
  const auth = { Cookie: sessionCookie }
  let createdId = 0
  {
    const created = await call(adminCreatePost as never, {
      url: `${BASE}/api/admin/posts`,
      method: 'POST',
      headers: auth,
      body: {
        slug: 'admin-crud-test',
        title: '后台创建的文章',
        excerpt: '摘要',
        content: '正文内容',
        status: 'published',
        isTop: true,
        readingTime: 3,
      },
    })
    const cb = created.body as { id: number; title: string; isTop: boolean }
    ok('创建返回 201', created.status === 201, `got ${created.status}`)
    ok('标题正确', cb.title === '后台创建的文章')
    ok('布尔字段已转换（isTop = true）', cb.isTop === true)
    createdId = cb.id
    ok('返回了新记录的 id', createdId > 0)

    const list = await call(adminListPosts as never, {
      url: `${BASE}/api/admin/posts?limit=100`,
      headers: auth,
    })
    const lb = list.body as { items: { slug: string }[] }
    ok('列表包含新建的文章', lb.items.some((p) => p.slug === 'admin-crud-test'))

    const read = await call(adminReadPost as never, {
      url: `${BASE}/api/admin/posts/${createdId}`,
      headers: auth,
      params: { id: String(createdId) },
    })
    ok('单条读取 200', read.status === 200)

    const before = queryOne(db, `SELECT updated_at FROM posts WHERE id = ${createdId}`)
    await new Promise((r) => setTimeout(r, 1100)) // 让 datetime('now') 有时间差

    const updated = await call(adminUpdatePost as never, {
      url: `${BASE}/api/admin/posts/${createdId}`,
      method: 'PUT',
      headers: auth,
      params: { id: String(createdId) },
      body: { title: '改过的标题' },
    })
    const ub = updated.body as { title: string }
    ok('更新返回 200', updated.status === 200, `got ${updated.status}`)
    ok('标题已改变', ub.title === '改过的标题')

    const after = queryOne(db, `SELECT updated_at FROM posts WHERE id = ${createdId}`)
    ok('updated_at 被自动刷新', String(after?.updated_at) !== String(before?.updated_at),
      `${String(before?.updated_at)} → ${String(after?.updated_at)}`)

    // 软删除
    const del = await call(adminDeletePost as never, {
      url: `${BASE}/api/admin/posts/${createdId}`,
      method: 'DELETE',
      headers: auth,
      params: { id: String(createdId) },
    })
    ok('删除返回 200', del.status === 200, `got ${del.status}`)

    const stillThere = queryOne(
      db,
      `SELECT deleted_at FROM posts WHERE id = ${createdId}`,
    )
    ok('是软删除（行还在，deleted_at 有值）', Boolean(stillThere?.deleted_at))

    // 软删除后，后台列表也不该再返回它
    const afterDel = await call(adminListPosts as never, {
      url: `${BASE}/api/admin/posts?limit=100`,
      headers: auth,
    })
    const adb = afterDel.body as { items: { id: number }[] }
    ok(
      '后台列表不再返回已软删除的文章',
      !adb.items.some((p) => p.id === createdId),
    )

    const pub = await call(publicListPosts as never, {
      url: `${BASE}/api/wp/posts?perPage=50`,
    })
    const pb = pub.body as { items: { slug: string }[] }
    ok('公开列表看不到已删除的文章', !pb.items.some((p) => p.slug === 'admin-crud-test'))
  }

  /* ---------- 字段白名单 ---------- */
  console.log('\n=== 后台：字段白名单（防越权改列）===')
  {
    const r = await call(adminCreatePost as never, {
      url: `${BASE}/api/admin/posts`,
      method: 'POST',
      headers: auth,
      body: {
        slug: 'whitelist-test',
        title: '白名单测试',
        // 以下都不在白名单里，必须被忽略
        id: 99999,
        deletedAt: '2020-01-01 00:00:00',
        views: 12345,
      },
    })
    const b = r.body as { id: number }
    ok('创建成功', r.status === 201, `got ${r.status}`)
    ok('没有采用请求里的 id', b.id !== 99999)

    const row = queryOne(db, `SELECT deleted_at, views FROM posts WHERE slug = 'whitelist-test'`)
    ok('deletedAt 未被写入', row?.deleted_at === null, `got ${String(row?.deleted_at)}`)
    ok('views 未被写入（白名单外字段忽略）', Number(row?.views ?? -1) === 0, `got ${String(row?.views)}`)
  }

  /* ---------- 回归：新建时不传 publishedAt 也能上首页 ---------- */
  console.log('\n=== 回归：新建文章必须能被首页看到 ===')
  {
    // 这是真实踩过的坑：表单没填「发布时间」时会提交空字符串，
    // 而 '' 比任何日期都小，导致新文章被排到最后 ——「后台发了文章，首页看不到」。
    const created = await call(adminCreatePost as never, {
      url: `${BASE}/api/admin/posts`,
      method: 'POST',
      headers: auth,
      body: {
        slug: 'regression-no-publishedat',
        title: '没填发布时间的文章',
        status: 'published',
        publishedAt: '', // 关键：显式传空字符串
      },
    })
    const cb = created.body as { publishedAt: string }
    ok('创建成功', created.status === 201, `got ${created.status}`)
    ok(
      'publishedAt 落库成了真实时间（空串被忽略，DB 默认值生效）',
      typeof cb.publishedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cb.publishedAt),
      JSON.stringify(cb.publishedAt),
    )

    // 首页取前 5 条，它必须出现在里面
    const pub = await call(publicListPosts as never, {
      url: `${BASE}/api/wp/posts?perPage=5`,
    })
    const pb = pub.body as { items: { slug: string }[] }
    ok(
      '出现在公开列表第一页（首页能看到）',
      pb.items.some((p) => p.slug === 'regression-no-publishedat'),
      pb.items.map((p) => p.slug).join(', '),
    )
  }

  /* ---------- 站点设置 ---------- */
  console.log('\n=== 后台：站点设置 ===')
  {
    const get1 = await call(adminGetSettings as never, {
      url: `${BASE}/api/admin/settings`,
      headers: auth,
    })
    const gb = get1.body as { siteName: string; chatEnabled: boolean }
    ok('读取设置 200', get1.status === 200)
    ok('读到 seed 里的站点名', gb.siteName === '纸上', `got ${gb.siteName}`)

    const put = await call(adminPutSettings as never, {
      url: `${BASE}/api/admin/settings`,
      method: 'PUT',
      headers: auth,
      body: { siteName: '新的站名', chatEnabled: false, 不存在的键: 'x' },
    })
    const pb = put.body as { siteName: string; chatEnabled: boolean }
    ok('更新设置 200', put.status === 200, `got ${put.status}`)
    ok('站名已更新', pb.siteName === '新的站名')
    ok('布尔已转换（chatEnabled = false）', pb.chatEnabled === false)

    const row = queryOne(db, "SELECT value FROM site_settings WHERE key = '不存在的键'")
    ok('白名单外的键没有写入数据库', row === null)

    // 局部更新不应该清空其它字段
    const keep = queryOne(db, "SELECT value FROM site_settings WHERE key = 'tagline'")
    ok('未提交的字段保持不变', String(keep?.value ?? '').length > 0)
  }

  /* ---------- R2 上传 ---------- */
  console.log('\n=== 后台：R2 上传 ===')
  {
    const noAuth = await call(adminUpload as never, {
      url: `${BASE}/api/admin/upload`,
      method: 'POST',
    })
    ok('未登录上传 401', noAuth.status === 401, `got ${noAuth.status}`)

    // 构造一个真正的 multipart 请求
    const makeUploadCtx = (file: File, dir?: string) => {
      const fd = new FormData()
      fd.append('file', file)
      if (dir) fd.append('dir', dir)
      const ctx = makeContext(db, { url: `${BASE}/api/admin/upload`, method: 'POST', headers: auth }, r2)
      ctx.request = new Request(`${BASE}/api/admin/upload`, {
        method: 'POST',
        headers: { Cookie: sessionCookie, 'CF-Connecting-IP': '203.0.113.7' },
        body: fd,
      })
      return ctx
    }

    const img = new File([new Uint8Array(2048)], 'photo.jpg', { type: 'image/jpeg' })
    const up = await callJson(adminUpload as never, makeUploadCtx(img, 'photos') as never)
    const ub = up.body as { key: string; url: string; size: number }
    ok('上传成功 201', up.status === 201, `got ${up.status}`)
    ok('key 以 photos/ 开头', ub.key.startsWith('photos/'), ub.key)
    ok('key 带年月分层', /^photos\/\d{4}\/\d{2}\//.test(ub.key), ub.key)
    ok('保留了 .jpg 扩展名', ub.key.endsWith('.jpg'), ub.key)
    ok('返回了公开 URL', ub.url.startsWith('https://static.'), ub.url)
    ok('R2 收到了一次 put', r2.puts.length === 1, `got ${r2.puts.length}`)
    ok('put 带了 contentType', r2.puts[0]?.contentType === 'image/jpeg')
    ok('put 带了长缓存头', (r2.puts[0]?.cacheControl ?? '').includes('immutable'))

    const badType = new File([new Uint8Array(10)], 'evil.html', { type: 'text/html' })
    const bad = await callJson(adminUpload as never, makeUploadCtx(badType) as never)
    ok('非图片/音频类型被拒绝 400', bad.status === 400, `got ${bad.status}`)

    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    const tooBig = await callJson(adminUpload as never, makeUploadCtx(big) as never)
    ok('超过 5 MB 被拒绝 400', tooBig.status === 400, `got ${tooBig.status}`)

    // 路径穿越尝试：dir 不在白名单里应回落到 photos
    const audio = new File([new Uint8Array(512)], 'song.mp3', { type: 'audio/mpeg' })
    const traversal = await callJson(
      adminUpload as never,
      makeUploadCtx(audio, '../../etc') as never,
    )
    const tb = traversal.body as { key: string }
    ok('非法 dir 回落到 photos（防路径穿越）', tb.key.startsWith('photos/'), tb.key)
    ok('音频扩展名保留', tb.key.endsWith('.mp3'), tb.key)
  }

  /* ---------- 友链申请转友链 ---------- */
  console.log('\n=== 后台：把友链申请留言转成待审友链 ===')
  {
    // 昵称必须唯一：上面的公开接口测试也建过一条 nickname='申请者' 的留言，
    // 用同一个昵称会让 queryOne 取到那一条（内容格式不同），导致断言假失败。
    const APPLICANT = '友链申请者'
    db.run(
      `INSERT INTO guestbook (nickname, content, status, created_at)
       VALUES ('${APPLICANT}', '名称：示例小站\n链接：example.com\n介绍：一个示例站点\n头像：https://example.com/a.png', 'approved', datetime('now'))`,
    )
    const gb = queryOne(db, `SELECT id FROM guestbook WHERE nickname = '${APPLICANT}'`)
    const gid = Number(gb?.id ?? 0)

    const r = await call(guestbookToLink as never, {
      url: `${BASE}/api/admin/guestbook/${gid}/to-link`,
      method: 'POST',
      headers: auth,
      params: { id: String(gid) },
    })
    const b = r.body as {
      link: { name: string; url: string; description: string; avatar: string; status: string }
      parsed: Record<string, boolean>
    }
    ok('转换返回 201', r.status === 201, `got ${r.status}`)
    ok('解析出名称', b.link?.name === '示例小站', `got ${b.link?.name}`)
    ok('链接自动补了 https://', b.link?.url === 'https://example.com', `got ${b.link?.url}`)
    ok('解析出介绍', b.link?.description === '一个示例站点')
    ok('解析出头像', b.link?.avatar === 'https://example.com/a.png')
    ok('状态是 pending（待审核）', b.link?.status === 'pending')
    ok('四项都解析成功', Object.values(b.parsed ?? {}).every(Boolean))

    // 公开友链列表不应包含待审的
    const pub = await call(publicListLinks as never, { url: `${BASE}/api/wp/links` })
    const pbl = pub.body as { name: string }[]
    ok('待审友链不出现在公开列表', !pbl.some((l) => l.name === '示例小站'))

    const missing = await call(guestbookToLink as never, {
      url: `${BASE}/api/admin/guestbook/999999/to-link`,
      method: 'POST',
      headers: auth,
      params: { id: '999999' },
    })
    ok('留言不存在返回 404', missing.status === 404, `got ${missing.status}`)
  }

  /* ---------- 分类 / 标签 / 文章标签（放在登出之前，复用当前会话） ---------- */
  await runTaxonomyTests(db, ok, sessionCookie)

  /* ---------- 登出 ---------- */
  console.log('\n=== 后台：登出 ===')
  {
    const out = await call(adminLogout as never, {
      url: `${BASE}/api/admin/logout`,
      method: 'POST',
      headers: auth,
    })
    ok('登出返回 200', out.status === 200, `got ${out.status}`)
    ok('清 Cookie 的 Max-Age=0', (out.headers.get('Set-Cookie') ?? '').includes('Max-Age=0'))

    const me = await call(adminMe as never, {
      url: `${BASE}/api/admin/me`,
      headers: auth,
    })
    ok('登出后 me 返回 401（会话立即失效）', me.status === 401, `got ${me.status}`)

    const list = await call(adminListPosts as never, {
      url: `${BASE}/api/admin/posts`,
      headers: auth,
    })
    ok('登出后管理接口 401', list.status === 401, `got ${list.status}`)
  }
}
