/** /api/admin/comments — 评论列表（GET）。评论由公开接口产生，后台不手工新建。 */
import { adminPreflight, listHandler } from '../../_lib/crud'
import { commentsConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(commentsConfig)
