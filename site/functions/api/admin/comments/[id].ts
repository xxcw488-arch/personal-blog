/** /api/admin/comments/:id — 读取 / 审核（改 status）/ 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { commentsConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(commentsConfig)
export const onRequestPut = updateHandler(commentsConfig)
export const onRequestDelete = deleteHandler(commentsConfig)
