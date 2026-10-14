/**
 * 主题 store（浅色 / 暗色）
 * ------------------------------------------------------------
 * 优先级：用户手动选择（localStorage） > 系统偏好 > 浅色。
 * 通过 <html data-theme> 切换，tokens.css 负责换变量，组件无感知。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'blog-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export const useThemeStore = defineStore('theme', () => {
  /** 用户选择的模式（auto 表示跟随系统） */
  const mode = ref<ThemeMode>('auto')
  /** 系统当前是否为暗色 */
  const systemDark = ref(false)

  /** 实际生效的主题 */
  const resolved = computed<'light' | 'dark'>(() => {
    if (mode.value === 'auto') return systemDark.value ? 'dark' : 'light'
    return mode.value
  })

  const isDark = computed(() => resolved.value === 'dark')

  /** 把主题写到 <html> 上，并同步浏览器 UI 配色 */
  function apply() {
    const root = document.documentElement
    root.dataset.theme = resolved.value
    // 让移动端浏览器地址栏/状态栏配色跟随主题
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved.value === 'dark' ? '#16151a' : '#fbf9f4')
  }

  /** 初始化：读 URL 参数 / 本地存储 + 监听系统变化 */
  function init() {
    systemDark.value = media().matches

    // URL 参数优先级最高，便于分享指定主题的链接（也方便截图与预览）
    const fromUrl = new URLSearchParams(window.location.search).get('theme')
    if (fromUrl === 'light' || fromUrl === 'dark') {
      mode.value = fromUrl
      localStorage.setItem(STORAGE_KEY, fromUrl)
    } else {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        mode.value = saved
      }
    }

    apply()

    // 系统主题变化时，只有 auto 模式需要跟随（apply 依赖 resolved，会自动重算）
    media().addEventListener('change', (e) => {
      systemDark.value = e.matches
      if (mode.value === 'auto') apply()
    })
  }

  /** 在浅色/暗色之间切换（切换后即视为手动模式） */
  function toggle() {
    mode.value = isDark.value ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, mode.value)
    apply()
  }

  /** 显式设置模式 */
  function setMode(next: ThemeMode) {
    mode.value = next
    localStorage.setItem(STORAGE_KEY, next)
    apply()
  }

  return { mode, resolved, isDark, init, toggle, setMode, apply }
})
