/** /api/admin/tags — 标签列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { tagsConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(tagsConfig)
export const onRequestPost = createHandler(tagsConfig)
