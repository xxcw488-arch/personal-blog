<script setup lang="ts">
/**
 * 后台外壳
 * ------------------------------------------------------------
 * 与公开站完全分开的一套版式：左侧固定导航 + 顶部信息栏 + 内容区。
 * 刻意不继承公开站的极光背景与页头页脚（在 App.vue 里按路由切换）。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { ADMIN_NAV } from '@/admin/resources'

const route = useRoute()
const router = useRouter()
const admin = useAdminStore()

const mobileNavOpen = ref(false)

/** 当前所在的资源 key（用于高亮导航） */
const activeKey = computed(() => String(route.params.resource ?? ''))

const pageTitle = computed(() => {
  const name = String(route.name ?? '')
  if (name === 'admin-dashboard') return '概览'
  if (name === 'admin-settings') return '站点设置'
  const found = ADMIN_NAV.find((n) => n.key === activeKey.value)
  return found?.label ?? '后台'
})

async function onLogout() {
  await admin.logout()
  void router.push({ name: 'admin-login' })
}

function go(key: string) {
  mobileNavOpen.value = false
  void router.push({ name: 'admin-resource', params: { resource: key } })
}
</script>

<template>
  <div class="adm">
    <!-- 侧栏 -->
    <aside class="adm__side" :class="{ 'is-open': mobileNavOpen }">
      <div class="adm__brand">
        <span class="adm__brand-mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </span>
        <span class="adm__brand-text">后台管理</span>
      </div>

      <nav class="adm__nav" aria-label="后台导航">
        <RouterLink
          :to="{ name: 'admin-dashboard' }"
          class="adm__link"
          :class="{ 'is-on': route.name === 'admin-dashboard' }"
          @click="mobileNavOpen = false"
        >
          概览
        </RouterLink>

        <button
          v-for="item in ADMIN_NAV"
          :key="item.key"
          class="adm__link"
          :class="{ 'is-on': activeKey === item.key }"
          type="button"
          @click="go(item.key)"
        >
          {{ item.label }}
        </button>

        <RouterLink
          :to="{ name: 'admin-settings' }"
          class="adm__link"
          :class="{ 'is-on': route.name === 'admin-settings' }"
          @click="mobileNavOpen = false"
        >
          站点设置
        </RouterLink>
      </nav>

      <div class="adm__side-foot">
        <RouterLink :to="{ name: 'home' }" class="adm__link adm__link--sub">
          ← 回到站点
        </RouterLink>
      </div>
    </aside>

    <!-- 移动端遮罩 -->
    <div v-if="mobileNavOpen" class="adm__scrim" @click="mobileNavOpen = false" />

    <!-- 主区 -->
    <div class="adm__main">
      <header class="adm__top">
        <button
          class="adm__burger"
          type="button"
          aria-label="切换导航"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        <h1 class="adm__title">{{ pageTitle }}</h1>

        <div class="adm__user">
          <span class="adm__user-name">{{ admin.user?.nickname || admin.user?.username }}</span>
          <button class="adm__btn adm__btn--sm" type="button" @click="onLogout">退出</button>
        </div>
      </header>

      <div class="adm__content">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.adm {
  display: flex;
  min-height: 100vh;
  background: var(--c-bg-deep);
  color: var(--c-ink-2);
}

/* ---------- 侧栏 ---------- */
.adm__side {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-3);
  background: var(--c-bg);
  border-right: 1px solid var(--c-line);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
.adm__brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--c-line);
}
.adm__brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius);
  background: var(--c-gold-soft);
  color: var(--c-gold);
  flex-shrink: 0;
}
.adm__brand-text {
  font-weight: 700;
  color: var(--c-ink);
  font-size: var(--fs-sm);
}

.adm__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.adm__link {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5em 0.8em;
  border-radius: var(--radius);
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
  border: 1px solid transparent;
  transition: all var(--dur-fast) var(--ease);
}
.adm__link:hover {
  background: var(--glass-bg);
  color: var(--c-ink);
}
.adm__link.is-on {
  background: var(--c-gold-soft);
  border-color: var(--c-line);
  color: var(--c-gold);
  font-weight: 600;
}
.adm__link--sub {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
.adm__side-foot {
  border-top: 1px solid var(--c-line);
  padding-top: var(--sp-3);
}

/* ---------- 主区 ---------- */
.adm__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.adm__top {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-5);
  border-bottom: 1px solid var(--c-line);
  background: var(--c-bg);
  position: sticky;
  top: 0;
  z-index: 10;
}
.adm__title {
  font-size: var(--fs-lg);
  font-weight: 700;
  flex: 1;
  min-width: 0;
}
.adm__user {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.adm__user-name {
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}
.adm__burger {
  display: none;
  color: var(--c-ink-3);
  padding: var(--sp-1);
}

.adm__content {
  padding: var(--sp-5);
  flex: 1;
  min-width: 0;
}

/* ---------- 通用按钮（供子页面复用）---------- */
:deep(.adm-btn),
.adm__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: 0.45em 1em;
  border-radius: var(--radius);
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  transition: all var(--dur-fast) var(--ease);
  white-space: nowrap;
}
:deep(.adm-btn:hover),
.adm__btn:hover {
  border-color: var(--c-gold);
  color: var(--c-gold);
}
:deep(.adm-btn--primary) {
  background: var(--c-gold);
  border-color: var(--c-gold);
  color: var(--c-accent-ink);
  font-weight: 600;
}
:deep(.adm-btn--primary:hover) {
  color: var(--c-accent-ink);
  filter: brightness(1.08);
}
:deep(.adm-btn--danger:hover) {
  border-color: var(--c-pink);
  color: var(--c-pink);
}
:deep(.adm-btn--sm) {
  padding: 0.3em 0.7em;
  font-size: var(--fs-xs);
}
:deep(.adm-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}
.adm__btn--sm {
  padding: 0.3em 0.7em;
  font-size: var(--fs-xs);
}

.adm__scrim {
  display: none;
}

/* ---------- 响应式 ---------- */
@media (max-width: 820px) {
  .adm__side {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 40;
    transform: translateX(-100%);
    transition: transform var(--dur) var(--ease);
  }
  .adm__side.is-open {
    transform: none;
  }
  .adm__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(0, 0, 0, 0.6);
  }
  .adm__burger {
    display: inline-flex;
  }
  .adm__content {
    padding: var(--sp-4);
  }
}
</style>
