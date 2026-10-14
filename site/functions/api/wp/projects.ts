/**
 * GET /api/wp/projects — 项目列表
 * 精选优先，其次按 sort_order。
 */

import type { Project } from '../../../src/types'
import type { Handler } from '../../_lib/context'
import { cachedJson, fail, preflight } from '../../_lib/http'
import { prep, toProject, type ProjectRow } from '../../_lib/db'

export const onRequestOptions: Handler = () => preflight()

export const onRequestGet: Handler = async ({ env }) => {
  try {
    const res = await prep(
      env.DB,
      `SELECT id, name, description, cover, repo_url, demo_url,
              tech_stack, language, stars, status, is_featured
         FROM projects
        ORDER BY is_featured DESC, sort_order ASC, id ASC`,
    ).all<ProjectRow>()

    const projects: Project[] = (res.results ?? []).map(toProject)
    return cachedJson(projects, 300)
  } catch (e) {
    return fail(`查询项目失败：${e instanceof Error ? e.message : '未知错误'}`, 500)
  }
}
