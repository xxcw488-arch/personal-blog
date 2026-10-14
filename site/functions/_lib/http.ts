/**
 * Pages Functions 公共工具：响应封装
 * ------------------------------------------------------------
 * 统一 JSON 响应、错误响应与 CORS 头，避免每个接口各写一遍。
 */

/** 允许跨域的来源。生产环境应改成自己的域名。 */
const ALLOWED_ORIGINS = ['*']

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

/**
 * 成功响应。
 * @param data    任意可 JSON 序列化的数据
 * @param init    额外覆盖项（如自定义 cache-control）
 */
export function json<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...(init.headers ?? {}),
    },
  })
}

/**
 * 带缓存头的成功响应。
 * ------------------------------------------------------------
 * 分两层，各管各的：
 *   · `s-maxage`       —— 给 Cloudflare 边缘用，让它替我们扛住重复读（尤其爬虫）
 *   · `max-age=0` + `must-revalidate` —— 给浏览器用：**明确要求每次都回源**
 *
 * 为什么不能只写 `s-maxage`：浏览器可能自己做启发式缓存，
 * 于是「后台刚把文章改成草稿 / 刚发布，站点上还是旧内容」——
 * 用户看到的就是「我明明发了，怎么没有」。
 *
 * 为什么连 `stale-while-revalidate` 也去掉了：**Chrome 同样实现了这个指令**，
 * 它会先把过期（max-age=0 意味着立刻过期）的旧响应发出来、再在后台revalidate，
 * 于是刷新一次仍然是旧数据。边缘该省的成本照省，浏览器这一层不留任何缓存余地。
 */
export function cachedJson<T>(data: T, seconds = 60): Response {
  return json(data, {
    headers: {
      'Cache-Control': `public, max-age=0, must-revalidate, s-maxage=${seconds}`,
    },
  })
}

/** 错误响应。前端 request() 会读 body.error 显示出来。 */
export function fail(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  })
}

export function notFound(message = '资源不存在'): Response {
  return fail(message, 404)
}

export function badRequest(message = '请求参数不合法'): Response {
  return fail(message, 400)
}

/** 处理预检请求 */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

/** 安全地解析 JSON body */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
