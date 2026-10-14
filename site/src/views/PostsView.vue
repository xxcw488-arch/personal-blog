<script setup lang="ts">
/**
 * 文章列表（对齐参考站 /article）
 * 页头 + 搜索框 + 标签筛选 + 大卡片列表 + 分页
 * 筛选状态同步到 URL query（?tag= / ?q= / ?page=），可分享可回退。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Category, Post, Tag } from '@/types'
import { getCategories, getPosts, getTags } from '@/api'
import { debounce } from '@/utils'
import PostCard from '@/components/PostCard.vue'
import AppPagination from '@/components/AppPagination.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const posts = ref<Post[]>([])
const total = ref(0)
const totalPages = ref(1)
const tags = ref<Tag[]>([])
/** 用于把 URL 里的 ?category=slug 显示成「分类：技术」 */
const categories = ref<Category[]>([])

const PER_PAGE = 6

/** 搜索框本地值，输入后防抖写回 URL */
const keyword = ref(String(route.query.q ?? ''))

const currentPage = computed(() => Number(route.query.page ?? 1) || 1)
const currentTag = computed(() => String(route.query.tag ?? ''))
/** 分类筛选：?category=<分类 slug>（与标签是两套，见下方筛选条） */
const currentCategory = computed(() => String(route.query.category ?? ''))

async function fetchList() {
  loading.value = true
  try {
    const res = await getPosts({
      page: currentPage.value,
      perPage: PER_PAGE,
      tag: currentTag.value || undefined,
      category: currentCategory.value || undefined,
      q: String(route.query.q ?? '') || undefined,
    })
    posts.value = res.items
    total.value = res.total
    totalPages.value = res.totalPages
  } finally {
    loading.value = false
  }
}

/** 只改指定字段，其余条件保留；改动后回到第 1 页 */
function setQuery(patch: Record<string, string | undefined>) {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (typeof v === 'string' && v) query[k] = v
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '') delete query[k]
    else query[k] = v
  }
  delete query.page
  void router.push({ path: '/article', query })
}

const syncKeyword = debounce((v: string) => {
  setQuery({ q: v.trim() || undefined })
}, 350)

watch(keyword, (v) => syncKeyword(v))

watch(
  () => route.query,
  (q) => {
    const kw = String(q.q ?? '')
    if (kw !== keyword.value) keyword.value = kw
    void fetchList()
  },
)

function goPage(p: number) {
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (typeof v === 'string' && v) query[k] = v
  }
  if (p > 1) query.page = String(p)
  else delete query.page
  void router.push({ path: '/article', query })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** 当前页的条目区间文案：「第 1-6 条 / 共 10 条」 */
const rangeText = computed(() => {
  if (total.value === 0) return '暂无内容'
  const start = (currentPage.value - 1) * PER_PAGE + 1
  const end = Math.min(currentPage.value * PER_PAGE, total.value)
  return `第 ${start}-${end} 条 / 共 ${total.value} 条`
})

onMounted(async () => {
  void fetchList()
  const [tagRes, catRes] = await Promise.allSettled([getTags(), getCategories()])
  tags.value = tagRes.status === 'fulfilled' ? tagRes.value : []
  categories.value = catRes.status === 'fulfilled' ? catRes.value : []
})
</script>

<template>
  <div class="archive container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">文章</h1>
      <p class="page-head__sub">共 {{ total }} 篇文章</p>
      <hr class="grad-rule" />
    </header>

    <!-- 搜索框 -->
    <div class="searchbox glass-card">
      <svg class="searchbox__icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
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
      <button
        v-if="keyword"
        class="searchbox__clear"
        aria-label="清空搜索"
        @click="keyword = ''"
      >
        ✕
      </button>
    </div>

    <!-- 分类筛选：以前只能从文章详情页的分类胶囊点进来，访客根本发现不了 -->
    <div v-if="categories.length" class="filters">
      <span class="filters__label meta">分类</span>
      <button
        class="chip"
        :class="{ 'chip--on': !currentCategory }"
        @click="setQuery({ category: undefined })"
      >
        全部
      </button>
      <button
        v-for="c in categories"
        :key="c.slug"
        class="chip"
        :class="{ 'chip--on': currentCategory === c.slug }"
        @click="setQuery({ category: c.slug })"
      >
        {{ c.name }}
        <span v-if="c.count" class="chip__count">{{ c.count }}</span>
      </button>
    </div>

    <!-- 标签筛选 -->
    <div v-if="tags.length" class="filters">
      <span class="filters__label meta">标签</span>
      <button
        class="chip"
        :class="{ 'chip--on': !currentTag }"
        @click="setQuery({ tag: undefined })"
      >
        全部
      </button>
      <button
        v-for="t in tags"
        :key="t.slug"
        class="chip"
        :class="{ 'chip--on': currentTag === t.slug }"
        @click="setQuery({ tag: t.slug })"
      >
        #{{ t.name }}
        <span v-if="t.count" class="chip__count">{{ t.count }}</span>
      </button>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="stack">
      <SkeletonBlock v-for="i in 3" :key="i" variant="feature" />
    </div>

    <template v-else-if="posts.length">
      <div class="stack">
        <PostCard v-for="p in posts" :key="p.slug" :post="p" />
      </div>

      <div class="pager">
        <p class="pager__info meta">{{ rangeText }}</p>
        <AppPagination :page="currentPage" :total-pages="totalPages" @update:page="goPage" />
      </div>
    </template>

    <EmptyState
      v-else
      title="没有匹配的文章"
      description="换个关键词或标签试试。"
    />
  </div>
</template>

<style scoped>
.archive {
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

/* ---------- 分类 / 标签筛选 ---------- */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}
/* 每行前面的「分类 / 标签」小标，让两行一眼能区分 */
.filters__label {
  margin-right: var(--sp-1);
  white-space: nowrap;
}
.chip__count {
  opacity: 0.6;
  font-size: 0.9em;
}

/* ---------- 列表 ---------- */
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

/* ---------- 分页 ---------- */
.pager {
  margin-top: var(--sp-7);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
}
.pager__info {
  color: var(--c-ink-4);
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
}
</style>
