<script setup lang="ts">
/**
 * 后台登录 / 首次初始化
 * ------------------------------------------------------------
 * 首次访问（数据库里还没有管理员）时显示「初始化」表单，
 * 之后显示普通登录表单 —— 由 /api/admin/status 决定。
 *
 * 口令不会离开这个页面：这里只把 PBKDF2 的结果发给服务端。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const admin = useAdminStore()

const username = ref('admin')
const nickname = ref('')
const password = ref('')
const password2 = ref('')
const error = ref('')
const probing = ref(true)

const isSetup = computed(() => admin.initialized === false)
const canSubmit = computed(() => {
  if (admin.busy) return false
  if (!username.value.trim() || !password.value) return false
  if (isSetup.value) {
    if (password.value.length < 8) return false
    if (password.value !== password2.value) return false
  }
  return true
})

onMounted(async () => {
  try {
    await admin.refreshStatus()
    // 已经登录过就直接进后台
    if (await admin.refreshMe()) {
      void router.replace({ name: 'admin-dashboard' })
    }
  } catch (e) {
    error.value = admin.describeError(e)
  } finally {
    probing.value = false
  }
})

async function onSubmit() {
  if (!canSubmit.value) return
  error.value = ''
  try {
    if (isSetup.value) {
      await admin.setupWithPassword(username.value.trim(), nickname.value.trim(), password.value)
    } else {
      await admin.loginWithPassword(username.value.trim(), password.value)
    }
    // 清掉内存里的口令
    password.value = ''
    password2.value = ''
    void router.replace({ name: 'admin-dashboard' })
  } catch (e) {
    error.value = admin.describeError(e)
  }
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <div class="login__head">
        <h1 class="login__title">{{ isSetup ? '初始化后台' : '后台登录' }}</h1>
        <p v-if="probing" class="login__sub">正在检查后台状态…</p>
        <p v-else-if="isSetup" class="login__sub">
          这是第一次使用，请创建管理员账号。口令只保存在你的浏览器里经过 60 万次哈希的结果，
          原始口令不会发送到服务器。
        </p>
        <p v-else class="login__sub">请输入管理员账号与口令。</p>
      </div>

      <form class="login__form" @submit.prevent="onSubmit">
        <div class="login__row">
          <label class="login__label" for="lg-user">用户名</label>
          <input
            id="lg-user"
            v-model="username"
            class="login__input"
            type="text"
            autocomplete="username"
            :disabled="probing || admin.busy"
          />
        </div>

        <div v-if="isSetup" class="login__row">
          <label class="login__label" for="lg-nick">昵称</label>
          <input
            id="lg-nick"
            v-model="nickname"
            class="login__input"
            type="text"
            placeholder="显示在后台，可留空"
            :disabled="probing || admin.busy"
          />
        </div>

        <div class="login__row">
          <label class="login__label" for="lg-pass">口令</label>
          <input
            id="lg-pass"
            v-model="password"
            class="login__input"
            type="password"
            :autocomplete="isSetup ? 'new-password' : 'current-password'"
            :placeholder="isSetup ? '至少 8 位' : ''"
            :disabled="probing || admin.busy"
          />
        </div>

        <div v-if="isSetup" class="login__row">
          <label class="login__label" for="lg-pass2">确认口令</label>
          <input
            id="lg-pass2"
            v-model="password2"
            class="login__input"
            type="password"
            autocomplete="new-password"
            :disabled="probing || admin.busy"
          />
        </div>

        <p v-if="isSetup && password && password.length < 8" class="login__hint">
          口令至少 8 位
        </p>
        <p v-if="isSetup && password2 && password !== password2" class="login__hint login__hint--warn">
          两次输入的口令不一致
        </p>

        <p v-if="error" class="login__error" role="alert">{{ error }}</p>

        <button class="login__btn" type="submit" :disabled="!canSubmit">
          {{ admin.busy ? '正在校验…' : isSetup ? '创建并进入' : '登录' }}
        </button>
      </form>

      <p class="login__foot">
        <RouterLink :to="{ name: 'home' }">← 回到站点首页</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--sp-5);
  background: var(--c-bg-deep);
}
.login__card {
  width: 100%;
  max-width: 420px;
  padding: var(--sp-6);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-xl);
  background: var(--c-bg);
  box-shadow: var(--glass-shadow-lg);
}
.login__head {
  margin-bottom: var(--sp-5);
}
.login__title {
  font-size: var(--fs-2xl);
  font-weight: 800;
  margin-bottom: var(--sp-2);
}
.login__sub {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-3);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.login__row {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.login__label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink);
}
.login__input {
  padding: 0.6em 0.85em;
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  outline: none;
  transition: border-color var(--dur-fast) var(--ease);
}
.login__input:focus {
  border-color: var(--c-gold);
}
.login__hint {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
.login__hint--warn {
  color: var(--c-gold);
}
.login__error {
  font-size: var(--fs-sm);
  color: var(--c-pink);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
}
.login__btn {
  margin-top: var(--sp-2);
  padding: 0.7em 1em;
  border-radius: var(--radius);
  border: 1px solid var(--c-gold);
  background: var(--c-gold);
  color: var(--c-accent-ink);
  font-weight: 700;
  font-size: var(--fs-sm);
  transition: filter var(--dur-fast) var(--ease);
}
.login__btn:hover:not(:disabled) {
  filter: brightness(1.08);
}
.login__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.login__foot {
  margin-top: var(--sp-5);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-line);
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
</style>
