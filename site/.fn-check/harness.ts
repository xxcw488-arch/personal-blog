/**
 * Pages Functions 本地验证脚手架
 * ------------------------------------------------------------
 * 为什么需要它：workerd 运行时在部分 Windows 环境下无法启动（见 README「已知限制」），
 * 所以 `wrangler pages dev` 会跑不起来。这个脚手架用 sql.js（真实 SQLite）
 * 实现一个 D1 接口的替身，然后**直接调用真实的 handler 代码**，
 * 断言返回的 JSON —— 验证的是我写的接口逻辑与 SQL，而不只是 SQL 本身。
 *
 * 用法：见同目录 verify.mjs
 */

import initSqlJs, { type Database } from 'sql.js'
import { readFileSync } from 'node:fs'

/* ============================================================
   D1 替身
   ============================================================ */

type Bind = string | number | null

/** 把 sql.js 包成 D1 的 prepare/bind/first/all/run 接口 */
export function makeD1(db: Database) {
  function exec(sql: string, params: Bind[]): Record<string, unknown>[] {
    const stmt = db.prepare(sql)
    try {
      if (params.length > 0) stmt.bind(params)
      const out: Record<string, unknown>[] = []
      while (stmt.step()) out.push(stmt.getAsObject())
      return out
    } finally {
      stmt.free()
    }
  }

  function makeStmt(sql: string, params: Bind[]) {
    return {
      // 暴露原始 sql/params 供 batch 执行（真实 D1 不需要，但替身需要）
      __sql: sql,
      __params: params,
      bind(...args: Bind[]) {
        return makeStmt(sql, args)
      },
      async first(col?: string) {
        const rows = exec(sql, params)
        const row = rows[0]
        if (!row) return null
        return col ? (row[col] ?? null) : row
      },
      async all() {
        return { results: exec(sql, params), success: true, meta: {} }
      },
      async run() {
        const rows = exec(sql, params)
        return { results: rows, success: true, meta: {} }
      },
    }
  }

  return {
    prepare(sql: string) {
      return makeStmt(sql, [])
    },
    /**
     * 真实 D1 的 batch 会按顺序执行所有语句。
     * 替身必须真的执行 —— 之前这里返回原数组（空操作），
     * 导致「批量写设置」这条路径看起来通过、实际没写库。
     */
    async batch(stmts: { __sql: string; __params: Bind[] }[]) {
      const out: unknown[] = []
      for (const s of stmts) {
        out.push({ results: exec(s.__sql, s.__params), success: true, meta: {} })
      }
      return out
    },
  }
}

/* ============================================================
   R2 替身
   ============================================================ */

export interface RecordedPut {
  key: string
  size: number
  contentType: string | undefined
  cacheControl: string | undefined
}

/** 只实现上传接口用到的那部分 R2 API，并记录调用以便断言 */
export function makeR2() {
  const puts: RecordedPut[] = []
  return {
    puts,
    async put(
      key: string,
      value: unknown,
      options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
    ) {
      // value 在真实环境是 ReadableStream；这里只需要确认它非空
      const size = value && typeof (value as { size?: number }).size === 'number'
        ? (value as { size: number }).size
        : -1
      puts.push({
        key,
        size,
        contentType: options?.httpMetadata?.contentType,
        cacheControl: options?.httpMetadata?.cacheControl,
      })
      return { key }
    },
  }
}

/* ============================================================
   建库
   ============================================================ */

export async function createTestDb(schemaPath: string, seedPath: string) {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(readFileSync(schemaPath, 'utf8'))
  db.run(readFileSync(seedPath, 'utf8'))
  return db
}

/** 直接查一行，用于断言副作用（如阅读量自增是否真的落库） */
export function queryOne(db: Database, sql: string): Record<string, unknown> | null {
  const stmt = db.prepare(sql)
  try {
    const out: Record<string, unknown>[] = []
    while (stmt.step()) out.push(stmt.getAsObject())
    return out[0] ?? null
  } finally {
    stmt.free()
  }
}

/* ============================================================
   调用 handler
   ============================================================ */

interface CtxOptions {
  url: string
  method?: string
  body?: unknown
  params?: Record<string, string>
  headers?: Record<string, string>
  /** 覆盖 env 里的字段（如给 GitHub OAuth 测试注入 client id/secret） */
  env?: Record<string, unknown>
}

/** 构造一个尽量贴近 Pages 真实上下文的假 context */
export function makeContext(db: Database, opts: CtxOptions, r2?: ReturnType<typeof makeR2>) {
  const waits: Promise<unknown>[] = []
  const request = new Request(opts.url, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.7',
      ...(opts.headers ?? {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })

  return {
    env: {
      DB: makeD1(db),
      BUCKET: r2 ?? makeR2(),
      SITE_URL: 'https://example.pages.dev',
      MEDIA_URL: 'https://static.example.pages.dev',
      ADMIN_PEPPER: 'test-pepper-do-not-use-in-production',
      ...(opts.env ?? {}),
    },
    request,
    params: opts.params ?? {},
    waitUntil: (p: Promise<unknown>) => waits.push(p),
    next: async () => new Response('next'),
    data: {},
    /** 等所有 waitUntil 里的异步任务跑完，便于断言副作用 */
    async drain() {
      await Promise.allSettled(waits)
    },
  }
}

/** 调用 handler 并把响应解析成 JSON */
export async function callJson(
  handler: (ctx: unknown) => Promise<Response>,
  ctx: unknown,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res = await handler(ctx)
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: res.status, body, headers: res.headers }
}
