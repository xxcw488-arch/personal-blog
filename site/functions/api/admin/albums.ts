/** /api/admin/albums — 相册列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { albumsConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(albumsConfig)
export const onRequestPost = createHandler(albumsConfig)
