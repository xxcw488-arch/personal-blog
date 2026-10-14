/**
 * GET /api/wp/settings — 站点设置
 * site_settings 是键值表，这里还原成前端 SiteSettings 结构。
 */

import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep, toSiteSettings } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(env.DB, 'SELECT key, value FROM site_settings').all<{
      key: string
      value: string
    }>()

    return cachedJson(toSiteSettings(res.results ?? []), 300)
  } catch (e) {
    return fail(`读取站点设置失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
