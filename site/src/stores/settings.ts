/**
 * 站点设置 store
 * 启动时拉取一次，供报头/页脚/关于页使用。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SiteSettings } from '@/types'
import { defaultSettings } from '@/data/settings'
import { getSettings } from '@/api'

/**
 * 强调色要覆盖的一整套变量。
 * ------------------------------------------------------------
 * ⚠️ 关键：主题里真正被大量引用的是 **--c-gold**（约 150 处），
 * 而 --c-accent 只有极少数地方在用。早期这里只写了 `--c-accent`，
 * 结果后台改了强调色**整个站点看不出变化** —— 像是功能坏了。
 */
const ACCENT_VARS = [
  '--c-accent',
  '--c-gold',
  '--c-gold-deep',
  '--c-gold-soft',
  '--c-accent-soft',
  '--c-accent-ink',
] as const

/** 解析 #rgb / #rrggbb；不是合法十六进制返回 null */
function parseHex(input: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!m?.[1]) return null
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SiteSettings>({ ...defaultSettings })
  const loaded = ref(false)
  const loading = ref(false)

  async function load(force = false) {
    if (loading.value) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      // getSettings 内部已做异常兜底，这里不会再抛
      settings.value = await getSettings()
      loaded.value = true
      applyAccent()
    } finally {
      loading.value = false
    }
  }

  /** 后台可配置主题强调色；为空则沿用 tokens.css 里的默认值 */
  function applyAccent() {
    const root = document.documentElement
    const rgb = parseHex(settings.value.accentColor ?? '')

    if (!rgb) {
      for (const v of ACCENT_VARS) root.style.removeProperty(v)
      return
    }

    const { r, g, b } = rgb
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`
    root.style.setProperty('--c-accent', hex)
    root.style.setProperty('--c-gold', hex)
    // 深一档：悬停态、描边
    root.style.setProperty('--c-gold-deep', `#${toHex(r * 0.78)}${toHex(g * 0.78)}${toHex(b * 0.78)}`)
    // 半透明底：胶囊、标签底色
    const soft = `rgba(${r}, ${g}, ${b}, 0.15)`
    root.style.setProperty('--c-gold-soft', soft)
    root.style.setProperty('--c-accent-soft', soft)
    // 强调色上的文字：按亮度自动选深/浅，否则选到浅色强调色时文字会看不清
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    root.style.setProperty('--c-accent-ink', luminance > 0.6 ? '#1c1915' : '#f6f2ea')
  }

  const title = computed(() => settings.value.siteName)
  const tagline = computed(() => settings.value.tagline)

  return { settings, loaded, loading, load, title, tagline }
})
