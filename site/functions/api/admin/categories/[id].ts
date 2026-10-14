/** /api/admin/categories/:id — 读取 / 修改 / 删除 */
import { adminPreflight, deleteHandler, readHandler, updateHandler } from '../../../_lib/crud'
import { categoriesConfig } from '../../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = readHandler(categoriesConfig)
export const onRequestPut = updateHandler(categoriesConfig)
export const onRequestDelete = deleteHandler(categoriesConfig)
