<script setup lang="ts">
/**
 * 单个标签下的文章归档（对齐参考站 /article?tag=slug 的入口）
 * 页头展示「#标签名 / 共 N 篇文章」，下面是一列大卡片。
 */
import { onMounted, ref, watch } from 'vue'
import type { Post, Tag } from '@/types'
import { getPosts, getTags } from '@/api'
import PostCard from '@/components/PostCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps<{ slug: string }>()

const loading = ref(true)
const posts = ref<Post[]>([])
const tag = ref<Tag | null>(null)

/** 显示名优先用标签表里的名称，找不到时退回 slug */
const tagName = ref(props.slug)

async function load(slug: string) {
  loading.value = true
  posts.value = []
  tag.value = null
  tagName.value = slug
  try {
    const [list, tags] = await Promise.all([getPosts({ tag: slug, perPage: 50 }), getTags()])
    posts.value = list.items
    const found = tags.find((t) => t.slug === slug) ?? null
    tag.value = found
    if (found) tagName.value = found.name
  } finally {
    loading.value = false
  }
}

onMounted(() => void load(props.slug))
watch(
  () => props.slug,
  (s) => void load(s),
)
</script>

<template>
  <div class="tag-page container">
    <!-- 页头 -->
    <header class="page-head">
      <RouterLink to="/tags" class="page-head__back">← 全部标签</RouterLink>
      <h1 class="page-head__title">
        <span class="page-head__hash">#</span>{{ tagName }}
      </h1>
      <p class="page-head__sub">共 {{ posts.length }} 篇文章</p>
      <hr class="grad-rule" />
    </header>

    <div v-if="loading" class="stack">
      <SkeletonBlock v-for="i in 3" :key="i" variant="feature" />
    </div>

    <div v-else-if="posts.length" class="stack">
      <PostCard v-for="p in posts" :key="p.slug" :post="p" />
    </div>

    <EmptyState v-else title="这个标签下还没有文章" description="换一个标签看看。">
      <RouterLink to="/tags" class="btn btn--sm">回到全部标签</RouterLink>
    </EmptyState>
  </div>
</template>

<style scoped>
.tag-page {
  padding-top: var(--sp-6);
  max-width: 900px;
}

/* ---------- 页头 ---------- */
.page-head {
  margin-bottom: var(--sp-5);
}
.page-head__back {
  display: inline-block;
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
  margin-bottom: var(--sp-3);
}
.page-head__back:hover {
  color: var(--c-gold);
}
.page-head__title {
  font-size: var(--fs-3xl);
  font-weight: 800;
  display: flex;
  align-items: baseline;
  gap: 0.08em;
  min-width: 0;
}
.page-head__hash {
  color: var(--c-gold);
}
.page-head__sub {
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}

/* ---------- 列表 ---------- */
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
