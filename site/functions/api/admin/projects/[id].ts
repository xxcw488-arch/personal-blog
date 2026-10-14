/** /api/admin/projects/:id — 读取 / 更新 / 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { projectsConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(projectsConfig)
export const onRequestPut = updateHandler(projectsConfig)
export const onRequestDelete = deleteHandler(projectsConfig)
