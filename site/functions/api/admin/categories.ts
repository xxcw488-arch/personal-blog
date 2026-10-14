/** /api/admin/categories — 分类列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { categoriesConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(categoriesConfig)
export const onRequestPost = createHandler(categoriesConfig)
