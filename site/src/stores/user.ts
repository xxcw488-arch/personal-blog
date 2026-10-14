/**
 * 登录用户（评论身份）
 * ------------------------------------------------------------
 * 为什么单独开一个 store 而不是让每个评论区自己拉：
 *   页面上可能同时有多个评论入口（文章页、碎碎念），
 *   身份只需要查一次；登录跳转回来后也只需要刷新一处。
 *
 * 注意：这是**评论身份**，与后台管理员的登录状态完全独立
 * （两套 cookie、两张会话，登出评论区不会把后台也登出）。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CurrentUser } from '@/types'
import { getCurrentUser, githubLoginUrl, logoutUser } from '@/api'

export const useUserStore = defineStore('user', () => {
  const user = ref<CurrentUser | null>(null)
  /** 站长有没有配置 GitHub OAuth；false 时前端不显示登录按钮 */
  const githubEnabled = ref(false)
  /** 是否已经查过一次（避免每个组件都发请求） */
  const loaded = ref(false)

  const isLoggedIn = computed(() => user.value !== null)

  /** 查询登录状态；force=true 时强制重查（登录跳转回来后用） */
  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    try {
      const state = await getCurrentUser()
      user.value = state.user
      githubEnabled.value = state.githubEnabled
    } catch {
      // 身份接口挂了就当未登录，不影响页面其它部分
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  /** 当前页面的登录跳转入口（回跳地址就是当前路径） */
  function loginHref(redirect?: string): string {
    const back = redirect ?? `${window.location.pathname}${window.location.search}`
    return githubLoginUrl(back)
  }

  async function logout(): Promise<void> {
    try {
      await logoutUser()
    } catch {
      /* 即使请求失败也把本地状态清掉，用户可以刷新重试 */
    }
    user.value = null
  }

  return { user, githubEnabled, loaded, isLoggedIn, load, loginHref, logout }
})
