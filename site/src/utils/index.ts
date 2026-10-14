/**
 * 通用工具
 */

/** 相对时间：刚刚 / 5 分钟前 / 3 天前 / 具体日期 */
export function timeAgo(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  const diff = Date.now() - date.getTime()
  const min = 60 * 1000
  const hour = 60 * min
  const day = 24 * hour

  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(date)
}

/** 格式化日期：2026 年 3 月 18 日 */
export function formatDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 短日期：2026.03.18（杂志页眉常用） */
export function formatDateShort(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

/** 中文数字星期 */
export function weekdayCN(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]
}

/** 大数字缩写：1200 → 1.2k */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w`
}

/* ============================================================
   URL 白名单
   ------------------------------------------------------------
   后台的社交字段是自由文本，直接绑进 href 就等于把「写设置的人」
   当成了可信来源：`javascript:` 会被浏览器在站点源上执行（Vue 3
   不做 URL 协议清洗）。所以所有出站链接统一过这两个函数。
   ============================================================ */

/** 只放行 http(s) 绝对地址；javascript: / data: / 相对路径一律丢弃 */
export function safeExternalUrl(value?: string): string {
  const s = (value ?? '').trim()
  return /^https?:\/\//i.test(s) ? s : ''
}

/**
 * 站内相对路径（/xxx）或 http(s) 绝对地址。
 * 注意排除 `//evil.com` 这种协议相对写法 —— 它看着像站内路径，实际是外站。
 */
export function safeLinkUrl(value?: string): string {
  const s = (value ?? '').trim()
  if (/^https?:\/\//i.test(s)) return s
  return /^\/(?!\/)/.test(s) ? s : ''
}

/** 秒 → mm:ss */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 从 Markdown 正文估算阅读时长（分钟），中文按 350 字/分钟 */
export function estimateReadingTime(content: string): number {
  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*`\-_[\]()!]/g, '')
  const cjk = (plain.match(/[\u4e00-\u9fa5]/g) ?? []).length
  const words = (plain.match(/[a-zA-Z]+/g) ?? []).length
  return Math.max(1, Math.round(cjk / 350 + words / 220))
}

/** 解析 LRC 歌词为带时间轴的数组 */
export interface LyricLine {
  time: number
  text: string
}
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of lrc.split('\n')) {
    const tags = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
    const text = raw.replace(/\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]/g, '').trim()
    if (!text) continue
    for (const t of tags) {
      const m = parseInt(t[1] ?? '0', 10)
      const s = parseInt(t[2] ?? '0', 10)
      const frac = parseInt((t[3] ?? '0').padEnd(3, '0'), 10)
      lines.push({ time: m * 60 + s + frac / 1000, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

/** 简易防抖 */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

/** 截断纯文本（用于摘要兜底） */
export function truncate(text: string, max = 120): string {
  const plain = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain
}
