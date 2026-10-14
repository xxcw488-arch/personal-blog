/**
 * 后台登录状态
 * ------------------------------------------------------------
 * 口令全程不离开浏览器：这里只把 PBKDF2 的结果（verifier）发给服务端。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  adminAuth,
  AdminApiError,
  type AdminStatus,
  type AdminUser,
} from '@/admin/api'
import { deriveVerifier, randomSaltHex, DEFAULT_ITERATIONS } from '@/admin/pbkdf2'

export const useAdminStore = defineStore('admin', () => {
  const user = ref<AdminUser | null>(null)
  const status = ref<AdminStatus | null>(null)
  /** 是否已经探测过一次登录态（避免路由守卫误判） */
  const checked = ref(false)
  const busy = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const initialized = computed(() => status.value?.initialized ?? null)

  /** 探测后台是否已初始化；顺带拿到服务端的 KDF 参数 */
  async function refreshStatus(): Promise<AdminStatus> {
    const s = await adminAuth.status()
    status.value = s
    return s
  }

  /** 探测当前登录态。返回是否已登录。 */
  async function refreshMe(): Promise<boolean> {
    try {
      const { user: u } = await adminAuth.me()
      user.value = u
      return true
    } catch {
      user.value = null
      return false
    } finally {
      checked.value = true
    }
  }

  /**
   * 首次初始化。
   * salt 由客户端随机生成并交给服务端保存 —— 服务端不参与生成，
   * 因为它也不需要知道口令相关的任何中间值。
   */
  async function setupWithPassword(username: string, nickname: string, password: string) {
    busy.value = true
    try {
      const iterations = status.value?.pbkdf2Iterations ?? DEFAULT_ITERATIONS
      const salt = randomSaltHex()
      const verifier = await deriveVerifier(password, salt, iterations)
      const { user: u } = await adminAuth.setup({ username, nickname, salt, verifier })
      user.value = u
      if (status.value) status.value.initialized = true
    } finally {
      busy.value = false
    }
  }

  /** 登录：先取 salt，再本地推导 verifier */
  async function loginWithPassword(username: string, password: string) {
    busy.value = true
    try {
      const s = await adminAuth.salt(username)
      const verifier = await deriveVerifier(password, s.salt, s.pbkdf2Iterations)
      const { user: u } = await adminAuth.login({ username, verifier })
      user.value = u
    } finally {
      busy.value = false
    }
  }

  async function logout() {
    try {
      await adminAuth.logout()
    } catch {
      // 即使请求失败也要清掉本地状态，避免界面卡在"已登录"
    } finally {
      user.value = null
    }
  }

  /** 把异常转成可展示的文案 */
  function describeError(e: unknown): string {
    if (e instanceof AdminApiError) {
      if (e.status === 401) return '用户名或口令不正确'
      if (e.status === 429) return e.message
      return e.message
    }
    if (e instanceof Error) {
      // WebCrypto 在非安全上下文（http）下不可用，这是最常见的踩坑
      if (e.name === 'NotSupportedError' || /crypto/i.test(e.message)) {
        return '当前环境不支持 WebCrypto，请通过 HTTPS 访问（localhost 除外）'
      }
      return e.message
    }
    return '未知错误'
  }

  return {
    user,
    status,
    checked,
    busy,
    isLoggedIn,
    initialized,
    refreshStatus,
    refreshMe,
    setupWithPassword,
    loginWithPassword,
    logout,
    describeError,
  }
})
