/** /api/admin/albums/:id — 读取 / 更新 / 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { albumsConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(albumsConfig)
export const onRequestPut = updateHandler(albumsConfig)
export const onRequestDelete = deleteHandler(albumsConfig)
