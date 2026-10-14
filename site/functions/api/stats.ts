/**
 * /api/stats — 访客统计
 * ------------------------------------------------------------
 * GET  : 读统计快照（首页侧栏用）
 * POST : 记录一次访问，并**顺便把最新快照一起返回**
 *
 * 为什么 POST 要返回快照：前端一次调用就拿到数据，省一次请求
 * （Pages Functions 免费版 10 万请求/天，能省则省）。
 *
 * 为什么不把「记录」塞进 GET：GET 可能被浏览器预取、被爬虫抓、被 CDN 缓存，
 * 那样 PV 会虚高且不可控。写操作必须由前端显式发起。
 *
 * 缓存：**no-store**。「此刻 N 人在线」要是被缓存 60 秒就没有意义了。
 */

import type { Handler } from '../_lib/context'
import { fail, json, preflight } from '../_lib/http'
import { clientIpHash } from '../_lib/ratelimit'
import { isBot, readStats, recordVisit } from '../_lib/stats'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    return json(await readStats(env), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return fail(`读取统计失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}

export const onRequestPost: Handler = async ({ env, request }) => {
  try {
    // 爬虫 / RSS 阅读器不计入，否则统计会被抓取流量淹没
    if (!isBot(request)) {
      const ipHash = await clientIpHash(request)
      const raw = new URL(request.url).searchParams.get('path') ?? '/'
      // path 只用于记录「当天首次落在哪一页」，截断防止被塞进超长字符串
      const path = raw.slice(0, 200) || '/'
      await recordVisit(env, ipHash, path)
    }
    return json(await readStats(env), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return fail(`记录访问失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
