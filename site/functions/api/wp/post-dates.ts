/**
 * GET /api/wp/post-dates — 发布日历用：哪天发了文、每天几篇
 * ------------------------------------------------------------
 * 首页「发文日历」只需要「日期 + 篇数」，不需要文章正文。
 * 原来日历是拿首页那 5 篇最新文章的日期凑的：一个月只有 5 个点，
 * 更早的日期永远点不亮。这里用一条 GROUP BY 查询取回全部发布日期，
 * 返回体只有几百字节，同时给出篇数（日历按篇数分「少 / 中 / 多」三档）。
 *
 * 返回：[{ date: 'YYYY-MM-DD', count: n }]，按日期升序。
 */

import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep } from '../../_lib/db'

interface DateCountRow {
  date: string | null
  count: number
}

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT substr(published_at, 1, 10) AS date, COUNT(*) AS count
         FROM posts
        WHERE status = 'published'
          AND deleted_at IS NULL
          AND published_at IS NOT NULL
          AND published_at <> ''
        GROUP BY date
        ORDER BY date ASC`,
    ).all<DateCountRow>()

    // 脏数据兜底：published_at 不是 'YYYY-MM-DD' 开头的行直接丢掉，
    // 日历拿到没法解析的日期只会白白渲染一个永远不匹配的标记
    const dates = (res.results ?? [])
      .filter((r): r is { date: string; count: number } => /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? ''))
      .map((r) => ({ date: r.date, count: Number(r.count) || 0 }))

    return cachedJson(dates, 60)
  } catch (e) {
    // 只把细节写日志：匿名调用方不该看到 D1 的报错文本（表名 / SQL 片段）
    console.error('[post-dates]', e)
    return fail('读取发布日历失败', 500)
  }
}
