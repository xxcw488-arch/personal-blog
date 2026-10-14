/** /api/admin/guestbook/:id — 读取 / 回复（改 reply 或 status）/ 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { guestbookConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(guestbookConfig)
export const onRequestPut = updateHandler(guestbookConfig)
export const onRequestDelete = deleteHandler(guestbookConfig)
