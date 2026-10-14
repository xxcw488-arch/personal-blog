/** /api/admin/album-images/:id — 读取 / 更新 / 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { albumImagesConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(albumImagesConfig)
export const onRequestPut = updateHandler(albumImagesConfig)
export const onRequestDelete = deleteHandler(albumImagesConfig)
