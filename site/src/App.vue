<script setup lang="ts">
/**
 * 应用外壳
 * ------------------------------------------------------------
 * 两套版式，按路由 meta.layout 切换：
 *   · 公开站：全站背景 → 报头 → 路由视图 → 页脚 → 悬浮播放器
 *   · 后台  ：只有路由视图（后台自己带侧栏外壳），不加载公开站的数据
 */
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Post, Tag } from '@/types'
import { getPosts, getTags, recordVisit } from '@/api'
import { useSettingsStore } from '@/stores/settings'
import { defaultSettings } from '@/data/settings'
import { useThemeStore } from '@/stores/theme'
import SiteBackdrop from '@/components/SiteBackdrop.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import MusicPlayer from '@/components/MusicPlayer.vue'
import AppPreloader from '@/components/AppPreloader.vue'

const route = useRoute()
const settingsStore = useSettingsStore()
const themeStore = useThemeStore()

/** 后台路由：不套公开站的壳，也不拉公开站的数据 */
const isAdminLayout = computed(() => route.meta.layout === 'admin')

/** 预加载遮罩是否收场：主题就绪即可，不必等所有数据 */
const ready = ref(false)

/** 页脚需要的最新文章与热门标签（全局只拉一次） */
const latestPosts = ref<{ slug: string; title: string }[]>([])
const hotTags = ref<{ name: string; slug: string }[]>([])

/**
 * 访客统计上报（阶段 5）
 * ------------------------------------------------------------
 * 只在公开站记，后台的访问不算站点 PV。
 * **失败必须静默**：统计是锦上添花，不能因为它挂掉而影响页面。
 * 这里是 SPA，路由切换不会重新挂载 App，所以另外用 watch 补上
 * 「站内翻页」的 PV —— 否则一个访客无论看多少页都只算 1 次。
 */
function trackVisit(): void {
  if (isAdminLayout.value) return
  void recordVisit(route.fullPath).catch(() => {})
}

watch(
  () => route.fullPath,
  () => trackVisit(),
)

/**
 * 标签页标题：站点名以「站点设置」为准
 * ------------------------------------------------------------
 * 原来标题只认 router/index.ts 里那个构建期常量（SITE_NAME = '纸上'），
 * 后台把站点名改成别的，标签页还停在旧名字上 —— 和 kicker 是同一类
 * 「后台能改、前台没读」的 bug。
 *
 * 放在这里而不是路由守卫里，是因为站点设置是**异步**加载的：
 * 首帧守卫跑的时候设置还没回来，只有 watch 能在它回来后再补一次标题。
 */
watch(
  () => [route.meta.title, settingsStore.settings.siteName] as const,
  ([title, siteName]) => {
    // 兜底用 defaultSettings，别再写第三份 '纸上'（settings 还没回来时先顶上）
    const name = (siteName || '').trim() || defaultSettings.siteName
    document.title = title ? `${title} - ${name}` : name
  },
  { immediate: true },
)

onMounted(async () => {
  // 主题要尽早初始化，避免暗色用户看到一闪而过的白底（后台同样需要）
  themeStore.init()

  // 后台不需要站点设置、文章列表这些公开数据，省掉这几次请求
  if (isAdminLayout.value) {
    ready.value = true
    return
  }

  // 站点设置（阶段 1 走 mock，阶段 3 换成接口）
  await settingsStore.load()
  ready.value = true

  // 记一次 PV（首次进入由这里负责，站内翻页由上面的 watch 负责）
  trackVisit()

  // 页脚数据属于锦上添花，失败不影响页面
  const [posts, tags] = await Promise.allSettled([getPosts({ perPage: 5 }), getTags()])
  if (posts.status === 'fulfilled') {
    latestPosts.value = posts.value.items.map((p: Post) => ({ slug: p.slug, title: p.title }))
  }
  if (tags.status === 'fulfilled') {
    hotTags.value = tags.value.slice(0, 10).map((t: Tag) => ({ name: t.name, slug: t.slug }))
  }
})

const preloaderDone = computed(() => ready.value || settingsStore.loaded)
</script>

<template>
  <!-- 后台：只有路由视图，后台外壳由 AdminLayout 提供 -->
  <template v-if="isAdminLayout">
    <RouterView />
    <AppPreloader :ready="preloaderDone" />
  </template>

  <!-- 公开站 -->
  <div v-else class="app">
    <a class="skip-link" href="#main">跳到主要内容</a>

    <!-- 全站统一背景（唯一来源）：所有页面共用这一层，
         换背景只需要改 SiteBackdrop.vue 一个文件 -->
    <SiteBackdrop />

    <SiteHeader :settings="settingsStore.settings" @toggle-theme="themeStore.toggle()" />

    <main id="main" class="app__main">
      <RouterView v-slot="{ Component, route: r }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="r.path" />
        </Transition>
      </RouterView>
    </main>

    <SiteFooter
      :settings="settingsStore.settings"
      :latest-posts="latestPosts"
      :hot-tags="hotTags"
    />

    <!-- 全局悬浮层 -->
    <MusicPlayer />
    <AppPreloader :ready="preloaderDone" />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  /* 内容浮在极光层之上 */
  z-index: var(--z-content);
}

.app__main {
  flex: 1;
  padding-bottom: var(--sp-8);
}

/*
 * 首页的 Hero 自己就是"整整一屏"（导航 + Hero = 100dvh），
 * 如果这里还留着 padding-bottom，首屏就会多出一条空隙，
 * 高度基准又对不上了。所以首页下划掉这层 padding，
 * 由 .layout 自己的 padding-top 承接第一屏之后的呼吸。
 *
 * 用 :has() 而不是给 RouterView 的组件加类名：
 * .home 是 HomeView 的根元素，直接子级关系稳定，
 * 且不需要为了样式去改数据/路由结构。
 */
.app__main:has(> .home) {
  padding-bottom: 0;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: var(--z-toast);
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-gold);
  color: var(--c-accent-ink);
  border-radius: 0 0 var(--radius) 0;
  font-size: var(--fs-sm);
}
.skip-link:focus {
  left: 0;
}

/* 路由切换：轻微上浮淡入 */
.page-enter-active,
.page-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
