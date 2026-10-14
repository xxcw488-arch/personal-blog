/** /api/admin/moments/:id — 读取 / 更新 / 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { momentsConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(momentsConfig)
export const onRequestPut = updateHandler(momentsConfig)
export const onRequestDelete = deleteHandler(momentsConfig)
