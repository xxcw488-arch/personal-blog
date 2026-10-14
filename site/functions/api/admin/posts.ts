/** /api/admin/posts — 文章列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { postsConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(postsConfig)
export const onRequestPost = createHandler(postsConfig)
