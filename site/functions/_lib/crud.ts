/**
 * 通用 CRUD 工厂
 * ============================================================
 * 后台要对 8 类内容做几乎一样的增删改查。与其复制 16 个文件，
 * 不如把「字段白名单 + 类型转换 + 参数绑定 + 分页」抽成一处，
 * 每类资源只声明自己的字段表。
 *
 * 设计要点：
 *   1. **字段白名单**：只有配置里声明的字段能被写入，
 *      请求体里多出来的键一律忽略 —— 否则攻击者可以改任意列。
 *   2. **类型转换**：boolean ↔ 0/1、JSON 数组 ↔ TEXT，避免手写转换出错。
 *   3. **禁止 N+1**：列表一次查询取回，不做逐行补充。
 *   4. **软删除**：配了 softDeleteColumn 的资源，DELETE 只打时间戳。
 */

import type { Env } from './context'
import { getSessionUser, type AdminUser } from './auth'
import { badRequest, fail, json, notFound, preflight } from './http'

/* ============================================================
   配置类型
   ============================================================ */

export type FieldType = 'string' | 'number' | 'boolean' | 'json'

export interface FieldDef {
  /** 数据库列名（下划线命名） */
  column: string
  type?: FieldType
  /** 是否允许在创建/更新时写入（默认 true；id/created_at 之类应设为 false） */
  writable?: boolean
  /** 创建时必填 */
  required?: boolean
  /** 字符串最大长度 */
  maxLength?: number
  /** 允许的枚举值 */
  enum?: string[]
  /**
   * 值为空字符串时**跳过该字段**，让数据库的 DEFAULT 生效。
   *
   * 为什么需要它：表单没填的字段会以空字符串提交，而空字符串会被如实写进库 ——
   * 对 `published_at` 这种「参与排序」的列是灾难：`''` 比任何日期都小，
   * 新文章会被排到最后，于是「后台发了文章，首页看不到」。
   */
  ignoreEmpty?: boolean
}

/**
 * 多对多关联（例如「文章 ↔ 标签」）。
 * ------------------------------------------------------------
 * 这类字段**不是主体表的一列**，而是存在中间表里（post_tags），
 * 所以没法用字段白名单表达 —— 需要读的时候回填、写的时候同步中间表。
 */
export interface RelationDef {
  /** 中间表名（如 post_tags） */
  table: string
  /** 中间表里指向本资源的列（如 post_id） */
  ownerColumn: string
  /** 中间表里指向另一侧的列（如 tag_id） */
  targetColumn: string
}

export interface CrudConfig {
  /** 表名 */
  table: string
  /** 字段表：key 是 API 字段名（驼峰），value 是列定义 */
  fields: Record<string, FieldDef>
  /** 列表排序（直接拼进 SQL，必须是代码里写死的常量，不能来自请求） */
  orderBy: string
  /** 列表默认条数 / 上限 */
  defaultLimit?: number
  maxLimit?: number
  /** 软删除列名；配置后 DELETE 只写时间戳 */
  softDeleteColumn?: string
  /**
   * 更新时自动打时间戳的列（通常是 updated_at）。
   * 交给前端传容易漏，放在这里保证每次修改都刷新。
   */
  touchColumn?: string
  /** 列表额外过滤条件（代码内常量） */
  listWhere?: string
  /** 是否允许创建 */
  allowCreate?: boolean
  /** 是否允许更新 */
  allowUpdate?: boolean
  /** 是否允许删除 */
  allowDelete?: boolean
  /**
   * 多对多关联：key 是 API 字段名（如 tags），值是中间表定义。
   * 读接口会把它回填成 id 数组，写接口会「先删后插」同步中间表。
   */
  relations?: Record<string, RelationDef>
  /**
   * 删除本资源**之前**要执行的清理语句，用 `?` 接收本资源的 id。
   *
   * 为什么不能只靠外键的 ON DELETE CASCADE：
   * SQLite 的外键约束默认是**关闭**的（要 `PRAGMA foreign_keys = ON` 才生效），
   * 一旦运行环境没开，删除就会留下悬空引用（文章指向一个已不存在的标签/分类）。
   * 这里显式清理，不依赖运行环境。
   */
  beforeDelete?: string[]
}

/* ============================================================
   鉴权包装
   ============================================================ */

type Ctx = {
  env: Env
  request: Request
  params: Record<string, string | string[]>
}

/**
 * 把 handler 包一层管理员校验。
 * 未登录直接返回 401，业务代码里就不用重复判断了。
 */
function withAdmin<C extends Ctx>(
  handler: (ctx: C, admin: AdminUser) => Promise<Response>,
): (ctx: C) => Promise<Response> {
  return async (ctx: C) => {
    const admin = await getSessionUser(ctx.env, ctx.request)
    if (!admin) return fail('未登录或登录已过期', 401)
    return handler(ctx, admin)
  }
}

/* ============================================================
   字段读写
   ============================================================ */

/** 把请求体里的值按字段定义转成可以直接 bind 的值 */
function encodeValue(def: FieldDef, value: unknown): string | number | null {
  const type = def.type ?? 'string'
  if (value === null || value === undefined) return null

  switch (type) {
    case 'boolean':
      return value ? 1 : 0
    case 'number': {
      const n = Number(value)
      return Number.isFinite(n) ? n : 0
    }
    case 'json':
      return JSON.stringify(Array.isArray(value) ? value : [])
    default:
      return String(value)
  }
}

/** 把数据库里读出来的值转回 API 结构 */
function decodeValue(def: FieldDef, value: unknown): unknown {
  const type = def.type ?? 'string'
  switch (type) {
    case 'boolean':
      return value === 1 || value === true
    case 'number':
      // 可空数字列（如 posts.category_id）读出来是 null，必须原样返回 null ——
      // 早先这里写成 Number(value ?? 0)，把「无分类」变成了 0
      if (value === null || value === undefined) return null
      return typeof value === 'number' ? value : Number(value)
    case 'json': {
      if (typeof value !== 'string') return []
      try {
        const parsed: unknown = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    default:
      return value ?? ''
  }
}

/** 数据库行 → API 对象（只输出配置里声明过的字段） */
export function rowToApi(config: CrudConfig, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { id: row.id }
  for (const [apiName, def] of Object.entries(config.fields)) {
    if (apiName === 'id') continue
    out[apiName] = decodeValue(def, row[def.column])
  }
  // 关联字段先占位成空数组，保证前端拿到的形状稳定（后面由 attachRelations 填真实值）
  for (const apiName of Object.keys(config.relations ?? {})) out[apiName] = []
  return out
}

/**
 * 校验并提取可写字段。
 * @returns 成功时返回 { columns, values }；失败时返回错误信息
 */
function extractWritable(
  config: CrudConfig,
  body: Record<string, unknown>,
  forCreate: boolean,
  allowEmpty = false,
): { columns: string[]; values: (string | number | null)[] } | { error: string } {
  const columns: string[] = []
  const values: (string | number | null)[] = []

  for (const [apiName, def] of Object.entries(config.fields)) {
    if (def.writable === false) continue
    const hasKey = Object.prototype.hasOwnProperty.call(body, apiName)

    if (!hasKey) {
      // 创建时检查必填
      if (forCreate && def.required) return { error: `缺少必填字段：${apiName}` }
      continue
    }

    const raw = body[apiName]

    // 声明了 ignoreEmpty 的字段：空字符串视为「没填」，跳过以保留数据库默认值
    if (def.ignoreEmpty && (raw === '' || raw === null || raw === undefined)) continue

    if (def.enum && raw !== null && raw !== undefined && !def.enum.includes(String(raw))) {
      return { error: `字段 ${apiName} 的取值不合法` }
    }
    if (def.maxLength && typeof raw === 'string' && raw.length > def.maxLength) {
      return { error: `字段 ${apiName} 超过 ${def.maxLength} 字` }
    }

    columns.push(def.column)
    values.push(encodeValue(def, raw))
  }

  if (columns.length === 0 && !allowEmpty) return { error: '没有可写入的字段' }
  return { columns, values }
}

/* ============================================================
   多对多关联
   ============================================================ */

/**
 * 一次查询取回多个主体的关联 id。
 * 返回 apiName → (ownerId → targetId[])，避免在循环里查库。
 */
async function loadRelations(
  env: Env,
  config: CrudConfig,
  ownerIds: number[],
): Promise<Map<string, Map<number, number[]>>> {
  const out = new Map<string, Map<number, number[]>>()
  const rels = config.relations
  if (!rels || ownerIds.length === 0) return out

  for (const [apiName, rel] of Object.entries(rels)) {
    const map = new Map<number, number[]>()
    try {
      const placeholders = ownerIds.map(() => '?').join(', ')
      const res = await env.DB.prepare(
        `SELECT ${rel.ownerColumn} AS owner_id, ${rel.targetColumn} AS target_id
           FROM ${rel.table}
          WHERE ${rel.ownerColumn} IN (${placeholders})`,
      )
        .bind(...ownerIds)
        .all<{ owner_id: number; target_id: number }>()

      for (const r of res.results ?? []) {
        const list = map.get(r.owner_id) ?? []
        list.push(r.target_id)
        map.set(r.owner_id, list)
      }
    } catch {
      // 关联表读失败不该让整个列表挂掉，退化成空数组
    }
    out.set(apiName, map)
  }
  return out
}

/** 把关联 id 回填进 API 对象 */
async function attachRelations(
  env: Env,
  config: CrudConfig,
  items: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const ids = items.map((i) => Number(i.id)).filter((n) => Number.isFinite(n))
  const loaded = await loadRelations(env, config, ids)
  for (const item of items) {
    for (const [apiName, map] of loaded) {
      item[apiName] = map.get(Number(item.id)) ?? []
    }
  }
  return items
}

/**
 * 同步关联表：先删掉该主体的全部关联，再按请求里的 id 重新插入。
 * 用一个 batch 发出去，避免 N 条标签就是 N 次往返。
 */
async function syncRelations(
  env: Env,
  config: CrudConfig,
  ownerId: number,
  body: Record<string, unknown>,
): Promise<void> {
  const rels = config.relations
  if (!rels) return

  for (const [apiName, rel] of Object.entries(rels)) {
    if (!Object.prototype.hasOwnProperty.call(body, apiName)) continue

    const raw = body[apiName]
    const ids = Array.isArray(raw)
      ? [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
      : []

    const stmts = [
      env.DB.prepare(`DELETE FROM ${rel.table} WHERE ${rel.ownerColumn} = ?`).bind(ownerId),
      ...ids.map((targetId) =>
        env.DB.prepare(
          `INSERT INTO ${rel.table} (${rel.ownerColumn}, ${rel.targetColumn}) VALUES (?, ?)`,
        ).bind(ownerId, targetId),
      ),
    ]
    await env.DB.batch(stmts)
  }
}

/* ============================================================
   Handler 工厂
   ============================================================ */

/** GET /resource —— 列表（支持 ?limit=&offset=） */
export function listHandler(config: CrudConfig) {
  const defaultLimit = config.defaultLimit ?? 50
  const maxLimit = config.maxLimit ?? 200

  return withAdmin(async ({ env, request }: Ctx) => {
    const params = new URL(request.url).searchParams
    const limitRaw = Number(params.get('limit') ?? defaultLimit)
    const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : defaultLimit))
    const offsetRaw = Number(params.get('offset') ?? 0)
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0)

    const where = config.softDeleteColumn
      ? `WHERE ${config.softDeleteColumn} IS NULL`
      : config.listWhere
        ? `WHERE ${config.listWhere}`
        : ''

    try {
      const res = await env.DB.prepare(
        `SELECT * FROM ${config.table} ${where} ORDER BY ${config.orderBy} LIMIT ? OFFSET ?`,
      )
        .bind(limit, offset)
        .all<Record<string, unknown>>()

      const items = (res.results ?? []).map((r) => rowToApi(config, r))
      await attachRelations(env, config, items)
      return json({ items, limit, offset })
    } catch (e) {
      return fail(`查询失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
    }
  })
}

/** POST /resource —— 创建 */
export function createHandler(config: CrudConfig) {
  return withAdmin(async ({ env, request }: Ctx) => {
    if (config.allowCreate === false) return fail('该资源不支持创建', 405)

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return badRequest('请求体不是合法的 JSON')
    }

    const extracted = extractWritable(config, body, true)
    if ('error' in extracted) return badRequest(extracted.error)

    const placeholders = extracted.columns.map(() => '?').join(', ')
    try {
      const row = await env.DB.prepare(
        `INSERT INTO ${config.table} (${extracted.columns.join(', ')})
         VALUES (${placeholders})
         RETURNING *`,
      )
        .bind(...extracted.values)
        .first<Record<string, unknown>>()

      if (!row) return fail('写入失败', 500)

      // 先落主体，再同步中间表（关联写入失败不该把已创建的主体回滚掉，
      // 前端可以再打开编辑一次重试；比整个 500 更好排查）
      await syncRelations(env, config, Number(row.id), body)

      const [item] = await attachRelations(env, config, [rowToApi(config, row)])
      return json(item, { status: 201 })
    } catch (e) {
      return fail(`创建失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
    }
  })
}

/** GET /resource/:id —— 单条 */
export function readHandler(config: CrudConfig) {
  return withAdmin(async ({ env, params }: Ctx) => {
    const id = Number(params.id)
    if (!Number.isFinite(id)) return badRequest('id 不合法')

    try {
      const row = await env.DB.prepare(`SELECT * FROM ${config.table} WHERE id = ? LIMIT 1`)
        .bind(id)
        .first<Record<string, unknown>>()
      if (!row) return notFound('记录不存在')
      const [item] = await attachRelations(env, config, [rowToApi(config, row)])
      return json(item)
    } catch (e) {
      return fail(`查询失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
    }
  })
}

/** PUT /resource/:id —— 更新（只更新请求里出现的字段） */
export function updateHandler(config: CrudConfig) {
  return withAdmin(async ({ env, params, request }: Ctx) => {
    if (config.allowUpdate === false) return fail('该资源不支持修改', 405)

    const id = Number(params.id)
    if (!Number.isFinite(id)) return badRequest('id 不合法')

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return badRequest('请求体不是合法的 JSON')
    }

    // 只提交了关联字段（例如只改了标签）时，主体没有可写的列 —— 这是合法的，
    // 所以这里允许「空字段更新」，只同步中间表
    const hasRelations = Object.keys(config.relations ?? {}).some((k) =>
      Object.prototype.hasOwnProperty.call(body, k),
    )

    const extracted = extractWritable(config, body, false, hasRelations)
    if ('error' in extracted) return badRequest(extracted.error)

    // 自动刷新 updated_at（如果配了），避免前端漏传导致时间戳不更新
    const touch = config.touchColumn ? `, ${config.touchColumn} = datetime('now')` : ''

    try {
      let row: Record<string, unknown> | null
      if (extracted.columns.length > 0) {
        const assignments = extracted.columns.map((c) => `${c} = ?`).join(', ')
        row = await env.DB.prepare(
          `UPDATE ${config.table} SET ${assignments}${touch} WHERE id = ? RETURNING *`,
        )
          .bind(...extracted.values, id)
          .first<Record<string, unknown>>()
      } else {
        row = await env.DB.prepare(`SELECT * FROM ${config.table} WHERE id = ? LIMIT 1`)
          .bind(id)
          .first<Record<string, unknown>>()
      }

      if (!row) return notFound('记录不存在')

      await syncRelations(env, config, id, body)

      const [item] = await attachRelations(env, config, [rowToApi(config, row)])
      return json(item)
    } catch (e) {
      return fail(`更新失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
    }
  })
}

/** DELETE /resource/:id —— 删除（配了软删除列则只打时间戳） */
export function deleteHandler(config: CrudConfig) {
  return withAdmin(async ({ env, params }: Ctx) => {
    if (config.allowDelete === false) return fail('该资源不支持删除', 405)

    const id = Number(params.id)
    if (!Number.isFinite(id)) return badRequest('id 不合法')

    try {
      // 先清掉指向本行的引用（外键级联在 SQLite 里默认不生效，见 beforeDelete 注释）
      if (config.beforeDelete?.length) {
        await env.DB.batch(config.beforeDelete.map((sql) => env.DB.prepare(sql).bind(id)))
      }

      if (config.softDeleteColumn) {
        const row = await env.DB.prepare(
          `UPDATE ${config.table} SET ${config.softDeleteColumn} = datetime('now')
            WHERE id = ? AND ${config.softDeleteColumn} IS NULL
            RETURNING id`,
        )
          .bind(id)
          .first<{ id: number }>()
        if (!row) return notFound('记录不存在或已删除')
      } else {
        const row = await env.DB.prepare(`DELETE FROM ${config.table} WHERE id = ? RETURNING id`)
          .bind(id)
          .first<{ id: number }>()
        if (!row) return notFound('记录不存在')
      }
      return json({ ok: true, id })
    } catch (e) {
      return fail(`删除失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
    }
  })
}

/** 预检：后台接口也需要 CORS 支持 */
export const adminPreflight = () => preflight()
