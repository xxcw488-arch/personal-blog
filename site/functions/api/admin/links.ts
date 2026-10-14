/** /api/admin/links — 友链列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { linksConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(linksConfig)
export const onRequestPost = createHandler(linksConfig)
