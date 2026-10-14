/** /api/admin/links/:id — 读取 / 更新（含审核状态）/ 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { linksConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(linksConfig)
export const onRequestPut = updateHandler(linksConfig)
export const onRequestDelete = deleteHandler(linksConfig)
