/** /api/admin/music/:id — 读取 / 更新 / 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { musicConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(musicConfig)
export const onRequestPut = updateHandler(musicConfig)
export const onRequestDelete = deleteHandler(musicConfig)
