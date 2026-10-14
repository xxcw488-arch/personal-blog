/**
 * 分类 / 标签 的端到端断言（含文章标签的多对多写入）
 * ------------------------------------------------------------
 * 由 admin.ts 在管理员会话建立之后、登出之前调用，
 * 复用同一个会话与测试数据库。
 *
 * 重点验证「多对多」这条链路：文章主体在 posts 表，标签关系在 post_tags 表，
 * 读要回填、写要同步 —— 这类地方最容易出现「看起来保存了、其实没写进去」。
 */

import { makeContext, callJson } from './harness'
import type { Database } from 'sql.js'

import {
  onRequestGet as listCategories,
  onRequestPost as createCategory,
} from '../functions/api/admin/categories'
import {
  onRequestPut as updateCategory,
  onRequestDelete as deleteCategory,
} from '../functions/api/admin/categories/[id]'
import { onRequestGet as listTags, onRequestPost as createTag } from '../functions/api/admin/tags'
import { onRequestDelete as deleteTag } from '../functions/api/admin/tags/[id]'
import {
  onRequestPost as createPost,
  onRequestGet as listPosts,
} from '../functions/api/admin/posts'
import { onRequestPut as updatePost, onRequestGet as readPost } from '../functions/api/admin/posts/[id]'
import { onRequestGet as publicGetPost } from '../functions/api/wp/posts/[slug]'
import { onRequestGet as publicListPosts } from '../functions/api/wp/posts'

const BASE = 'https://blog.test'

type Ok = (name: string, cond: boolean, extra?: string) => void

export async function runTaxonomyTests(
  db: Database,
  ok: Ok,
  sessionCookie: string,
): Promise<void> {
  /** 带管理员会话的调用 */
  const call = (handler: never, opts: Parameters<typeof makeContext>[1]) =>
    callJson(
      handler as never,
      makeContext(db, { ...opts, headers: { Cookie: sessionCookie, ...(opts.headers ?? {}) } }),
    )

  /* ---------- 鉴权 ---------- */
  console.log('\n=== 后台：分类/标签需要登录 ===')
  {
    const anon = await callJson(
      listCategories as never,
      makeContext(db, { url: `${BASE}/api/admin/categories` }),
    )
    ok('未登录读分类 → 401', anon.status === 401, `got ${anon.status}`)

    const anonWrite = await callJson(
      createTag as never,
      makeContext(db, {
        url: `${BASE}/api/admin/tags`,
        method: 'POST',
        body: { name: 'x', slug: 'x' },
      }),
    )
    ok('未登录建标签 → 401', anonWrite.status === 401, `got ${anonWrite.status}`)
  }

  /* ---------- 分类 CRUD ---------- */
  console.log('\n=== 后台：分类 CRUD ===')
  let categoryId = 0
  {
    const created = await call(
      createCategory as never,
      {
        url: `${BASE}/api/admin/categories`,
        method: 'POST',
        body: { name: '读书笔记', slug: 'reading-notes', description: '看过的书', sortOrder: 9 },
      },
    )
    const body = created.body as { id: number; name: string; slug: string; sortOrder: number }
    ok('创建分类 → 201', created.status === 201, `got ${created.status}`)
    ok('名称正确', body.name === '读书笔记', body.name)
    ok('slug 正确', body.slug === 'reading-notes')
    ok('sortOrder 已转成数字', body.sortOrder === 9, String(body.sortOrder))
    categoryId = body.id

    const list = await call(listCategories as never, { url: `${BASE}/api/admin/categories` })
    const items = (list.body as { items: { id: number; name: string }[] }).items
    ok('列表包含新建的分类', items.some((c) => c.id === categoryId))
    ok('seed 的 4 个分类还在', items.length >= 5, `got ${items.length}`)

    const renamed = await call(
      updateCategory as never,
      {
        url: `${BASE}/api/admin/categories/${categoryId}`,
        method: 'PUT',
        params: { id: String(categoryId) },
        body: { name: '读书' },
      },
    )
    ok('改名 → 200', renamed.status === 200, `got ${renamed.status}`)
    ok('名称已更新', (renamed.body as { name: string }).name === '读书')
    ok('未提交的字段保持不变', (renamed.body as { slug: string }).slug === 'reading-notes')

    const missing = await call(
      updateCategory as never,
      {
        url: `${BASE}/api/admin/categories/999999`,
        method: 'PUT',
        params: { id: '999999' },
        body: { name: '不存在' },
      },
    )
    ok('改不存在的分类 → 404', missing.status === 404, `got ${missing.status}`)
  }

  /* ---------- 标签 CRUD ---------- */
  console.log('\n=== 后台：标签 CRUD ===')
  let tagA = 0
  let tagB = 0
  {
    const a = await call(
      createTag as never,
      { url: `${BASE}/api/admin/tags`, method: 'POST', body: { name: '随笔集', slug: 'essay-set' } },
    )
    tagA = (a.body as { id: number }).id
    ok('创建标签 A → 201', a.status === 201, `got ${a.status}`)

    const b = await call(
      createTag as never,
      { url: `${BASE}/api/admin/tags`, method: 'POST', body: { name: '旧时光', slug: 'old-days' } },
    )
    tagB = (b.body as { id: number }).id
    ok('创建标签 B → 201', b.status === 201, `got ${b.status}`)

    const dup = await call(
      createTag as never,
      { url: `${BASE}/api/admin/tags`, method: 'POST', body: { name: '随笔集', slug: 'essay-set' } },
    )
    ok('slug 重复被拒绝（不是静默成功）', dup.status >= 400, `got ${dup.status}`)

    const noName = await call(
      createTag as never,
      { url: `${BASE}/api/admin/tags`, method: 'POST', body: { slug: 'no-name' } },
    )
    ok('缺少必填 name → 400', noName.status === 400, `got ${noName.status}`)

    const list = await call(listTags as never, { url: `${BASE}/api/admin/tags` })
    const items = (list.body as { items: { id: number }[] }).items
    ok('列表包含两个新标签', items.some((t) => t.id === tagA) && items.some((t) => t.id === tagB))
  }

  /* ---------- 文章 ↔ 标签（多对多） ---------- */
  console.log('\n=== 后台：文章打标签（多对多写入）===')
  let postId = 0
  const slug = 'taxonomy-round-trip'
  {
    const created = await call(
      createPost as never,
      {
        url: `${BASE}/api/admin/posts`,
        method: 'POST',
        body: {
          title: '带标签的文章',
          slug,
          excerpt: '验证多对多',
          content: '正文',
          status: 'published',
          categoryId,
          tags: [tagA, tagB],
        },
      },
    )
    const body = created.body as { id: number; tags: number[]; categoryId: number }
    ok('创建带标签的文章 → 201', created.status === 201, `got ${created.status}`)
    ok('返回值里带上了标签 id 数组', Array.isArray(body.tags), JSON.stringify(body.tags))
    ok('两个标签都写进去了', body.tags.length === 2, JSON.stringify(body.tags))
    ok('分类 id 正确落库', body.categoryId === categoryId, String(body.categoryId))
    postId = body.id

    // 读单条：必须回填 tags（否则编辑页勾选状态是空的）
    const read = await call(readPost as never, {
      url: `${BASE}/api/admin/posts/${postId}`,
      params: { id: String(postId) },
    })
    const rb = read.body as { tags: number[] }
    ok('详情接口回填了标签', Array.isArray(rb.tags) && rb.tags.length === 2, JSON.stringify(rb.tags))

    // 列表：也要回填（编辑抽屉可能直接用列表行）
    const list = await call(listPosts as never, { url: `${BASE}/api/admin/posts?limit=200` })
    const row = (list.body as { items: { id: number; tags: number[] }[] }).items.find(
      (p) => p.id === postId,
    )
    ok('列表接口也回填了标签', row?.tags?.length === 2, JSON.stringify(row?.tags))

    // 只提交 tags、不带任何主体字段 —— 走「空字段更新」这条分支
    const onlyTags = await call(
      updatePost as never,
      {
        url: `${BASE}/api/admin/posts/${postId}`,
        method: 'PUT',
        params: { id: String(postId) },
        body: { tags: [tagB] },
      },
    )
    ok('只改标签（无其它字段）→ 200', onlyTags.status === 200, `got ${onlyTags.status}`)
    ok('标签被替换成 1 个', (onlyTags.body as { tags: number[] }).tags.length === 1)
    ok('留下的是 tagB', (onlyTags.body as { tags: number[] }).tags[0] === tagB)
    ok('标题没被清空（主体字段未受影响）', (onlyTags.body as { title: string }).title === '带标签的文章')

    const links = db.exec('SELECT COUNT(*) FROM post_tags WHERE post_id = ' + postId)
    ok('中间表只剩 1 行', links[0]?.values[0]?.[0] === 1, JSON.stringify(links[0]?.values))

    // 清空标签
    const cleared = await call(
      updatePost as never,
      {
        url: `${BASE}/api/admin/posts/${postId}`,
        method: 'PUT',
        params: { id: String(postId) },
        body: { tags: [] },
      },
    )
    ok('清空标签 → 200', cleared.status === 200, `got ${cleared.status}`)
    ok('标签变成空数组', (cleared.body as { tags: number[] }).tags.length === 0)
    const afterClear = db.exec('SELECT COUNT(*) FROM post_tags WHERE post_id = ' + postId)
    ok('中间表已清空', afterClear[0]?.values[0]?.[0] === 0, JSON.stringify(afterClear[0]?.values))

    // 重新打上，供后面验证公开接口与级联删除
    await call(
      updatePost as never,
      {
        url: `${BASE}/api/admin/posts/${postId}`,
        method: 'PUT',
        params: { id: String(postId) },
        body: { tags: [tagA, tagB] },
      },
    )
    const restored = db.exec('SELECT COUNT(*) FROM post_tags WHERE post_id = ' + postId)
    ok('重新打标签成功', restored[0]?.values[0]?.[0] === 2, JSON.stringify(restored[0]?.values))
  }

  /* ---------- 与公开接口联动 ---------- */
  console.log('\n=== 公开接口：标签跟着走 ===')
  {
    const detail = await callJson(
      publicGetPost as never,
      makeContext(db, { url: `${BASE}/api/wp/posts/${slug}`, params: { slug } }),
    )
    const b = detail.body as { tags: { id: number; name: string }[]; category: { id: number } | null }
    ok('公开详情返回标签对象', Array.isArray(b.tags) && b.tags.length === 2, JSON.stringify(b.tags))
    ok('标签名正确', b.tags.some((t) => t.name === '随笔集'))
    ok('分类已关联', b.category?.id === categoryId, JSON.stringify(b.category))

    const list = await callJson(publicListPosts as never, makeContext(db, { url: `${BASE}/api/wp/posts?tag=essay-set` }))
    ok('按标签 slug 能筛出这篇文章', (list.body as { total: number }).total >= 1)

    const catList = await callJson(
      publicListPosts as never,
      makeContext(db, { url: `${BASE}/api/wp/posts?category=reading-notes` }),
    )
    ok('按分类 slug 能筛出这篇文章', (catList.body as { total: number }).total >= 1)
  }

  /* ---------- 级联删除 ---------- */
  console.log('\n=== 删除标签会级联清掉关联 ===')
  {
    const del = await call(deleteTag as never, {
      url: `${BASE}/api/admin/tags/${tagA}`,
      method: 'DELETE',
      params: { id: String(tagA) },
    })
    ok('删除标签 → 200', del.status === 200, `got ${del.status}`)

    const left = db.exec(`SELECT COUNT(*) FROM post_tags WHERE tag_id = ${tagA}`)
    ok('post_tags 里指向它的行被级联删除', left[0]?.values[0]?.[0] === 0, JSON.stringify(left[0]?.values))

    const read = await call(readPost as never, {
      url: `${BASE}/api/admin/posts/${postId}`,
      params: { id: String(postId) },
    })
    const tags = (read.body as { tags: number[] }).tags
    ok('文章只剩 1 个标签', tags.length === 1 && tags[0] === tagB, JSON.stringify(tags))
    ok('没有留下悬空引用', !tags.includes(tagA))
  }

  /* ---------- 分类置空 ---------- */
  console.log('\n=== 分类可以置空（不能写成 0）===')
  {
    const cleared = await call(
      updatePost as never,
      {
        url: `${BASE}/api/admin/posts/${postId}`,
        method: 'PUT',
        params: { id: String(postId) },
        body: { categoryId: null },
      },
    )
    ok('置空分类 → 200', cleared.status === 200, `got ${cleared.status}`)
    const stored = db.exec(`SELECT category_id FROM posts WHERE id = ${postId}`)
    ok('库里存的是 NULL 而不是 0', stored[0]?.values[0]?.[0] === null, JSON.stringify(stored[0]?.values))
    ok('返回值里 categoryId 为 null', (cleared.body as { categoryId: unknown }).categoryId === null)

    const detail = await callJson(
      publicGetPost as never,
      makeContext(db, { url: `${BASE}/api/wp/posts/${slug}`, params: { slug } }),
    )
    ok('公开接口显示为无分类', (detail.body as { category: unknown }).category === null)
  }

  /* ---------- 清理 ---------- */
  console.log('\n=== 清理 ===')
  {
    db.run(`DELETE FROM posts WHERE id = ${postId}`)
    db.run(`DELETE FROM tags WHERE id = ${tagB}`)
    db.run(`DELETE FROM categories WHERE id = ${categoryId}`)
    const tags = db.exec('SELECT COUNT(*) FROM tags WHERE slug IN (\'essay-set\', \'old-days\')')
    ok('测试数据已清理', tags[0]?.values[0]?.[0] === 0, JSON.stringify(tags[0]?.values))
  }
}
