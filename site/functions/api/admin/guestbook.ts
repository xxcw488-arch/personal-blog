/** /api/admin/guestbook — 留言列表（GET）。留言由公开接口产生，后台不手工新建。 */
import { adminPreflight, listHandler } from '../../_lib/crud'
import { guestbookConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(guestbookConfig)
