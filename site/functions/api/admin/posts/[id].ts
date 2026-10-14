/** /api/admin/posts/:id — 读取 / 更新 / 删除（软删除） */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { postsConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(postsConfig)
export const onRequestPut = updateHandler(postsConfig)
export const onRequestDelete = deleteHandler(postsConfig)
