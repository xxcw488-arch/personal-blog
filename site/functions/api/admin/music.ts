/** /api/admin/music — 音乐列表（GET）/ 新建（POST） */
import { adminPreflight, createHandler, listHandler } from '../../_lib/crud'
import { musicConfig } from '../../_lib/resources'

export const onRequestOptions = adminPreflight
export const onRequestGet = listHandler(musicConfig)
export const onRequestPost = createHandler(musicConfig)
