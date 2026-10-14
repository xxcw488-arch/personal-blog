/** /api/admin/projects — 项目列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { projectsConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(projectsConfig)
export const onRequestPost = createHandler(projectsConfig)
