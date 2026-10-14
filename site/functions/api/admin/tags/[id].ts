/**
 * /api/admin/tags/:id — 读取 / 修改 / 删除
 * ------------------------------------------------------------
 * 删除标签时，post_tags 里指向它的行会被外键 ON DELETE CASCADE 一起清掉，
 * 所以文章不会留下悬空引用。
 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { tagsConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(tagsConfig)
export const onRequestPut = updateHandler(tagsConfig)
export const onRequestDelete = deleteHandler(tagsConfig)
