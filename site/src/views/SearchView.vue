<script setup lang="ts">
/**
 * 站内搜索
 * 搜索框沿用文章列表页的玻璃胶囊（放大镜 + 清空按钮）；
 * 关键词防抖后写回 URL（?q=），URL 变化驱动实际检索，可分享可回退。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Post } from '@/types'
import { search } from '@/api'
import { debounce } from '@/utils'
import PostCard from '@/components/PostCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()

const keyword = ref(String(route.query.q ?? ''))
const loading = ref(false)
const results = ref<Post[]>([])
/** 是否已经跑过一次检索（区分「还没搜」和「搜了没结果」） */
const searched = ref(false)

const hasKeyword = computed(() => keyword.value.trim().length > 0)

async function run(q: string) {
  const kw = q.trim()
  if (!kw) {
    results.value = []
    searched.value = false
    return
  }
  loading.value = true
  try {
    results.value = await search(kw)
    searched.value = true
  } finally {
    loading.value = false
  }
}

/** 只在关键词真变化时才改 URL，避免路由冗余跳转与重复检索 */
const syncUrl = debounce((v: string) => {
  if (v === String(route.query.q ?? '')) return
  const query: Record<string, string> = v ? { q: v } : {}
  void router.replace({ path: '/search', query })
}, 350)

watch(keyword, (v) => syncUrl(v.trim()))

watch(
  () => route.query.q,
  (q) => {
    const kw = String(q ?? '')
    if (kw !== keyword.value) keyword.value = kw
    void run(kw)
  },
  { immediate: true },
)

onMounted(() => {
  if (hasKeyword.value) void run(keyword.value)
})
</script>

<template>
  <div class="search-page container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">站内搜索</h1>
      <p class="page-head__sub">
        <template v-if="loading">搜索中…</template>
        <template v-else-if="searched">找到 {{ results.length }} 篇</template>
        <template v-else>输入关键词，检索标题、摘要与正文</template>
      </p>
      <hr class="grad-rule" />
    </header>

    <!-- 搜索框（与文章列表页同一套视觉） -->
    <div class="searchbox glass-card">
      <svg
        class="searchbox__icon"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        v-model="keyword"
        type="search"
        class="searchbox__input"
        placeholder="搜索文章…"
        aria-label="搜索文章"
        autocomplete="off"
      />
      <button v-if="keyword" class="searchbox__clear" aria-label="清空搜索" @click="keyword = ''">
        ✕
      </button>
    </div>

    <!-- 结果 -->
    <div v-if="loading" class="stack">
      <SkeletonBlock v-for="i in 3" :key="i" variant="feature" />
    </div>

    <div v-else-if="results.length" class="stack">
      <PostCard v-for="p in results" :key="p.slug" :post="p" />
    </div>

    <EmptyState
      v-else-if="searched"
      title="没有找到相关文章"
      description="换个关键词试试，或者去文章列表按标签浏览。"
    >
      <RouterLink to="/article" class="btn btn--sm">浏览全部文章</RouterLink>
    </EmptyState>

    <EmptyState v-else title="输入关键词开始搜索" description="标题、摘要和正文都会被检索。" />
  </div>
</template>

<style scoped>
.search-page {
  padding-top: var(--sp-6);
  max-width: 900px;
}

/* ---------- 页头 ---------- */
.page-head {
  margin-bottom: var(--sp-5);
}
.page-head__title {
  font-size: var(--fs-3xl);
  font-weight: 800;
}
.page-head__sub {
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}

/* ---------- 搜索框 ---------- */
.searchbox {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 0 var(--sp-4);
  border-radius: var(--radius-full);
  margin-bottom: var(--sp-5);
}
.searchbox__icon {
  color: var(--c-ink-4);
  flex-shrink: 0;
}
.searchbox__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  padding: 0.85em 0;
  font-size: var(--fs-sm);
  color: var(--c-ink);
}
.searchbox__input::placeholder {
  color: var(--c-ink-4);
}
.searchbox__clear {
  color: var(--c-ink-4);
  font-size: var(--fs-sm);
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--radius-full);
}
.searchbox__clear:hover {
  color: var(--c-gold);
  background: var(--c-gold-soft);
}

/* ---------- 结果 ---------- */
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
}
</style>
