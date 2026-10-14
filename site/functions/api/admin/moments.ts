/** /api/admin/moments — 碎碎念列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { momentsConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(momentsConfig)
export const onRequestPost = createHandler(momentsConfig)
