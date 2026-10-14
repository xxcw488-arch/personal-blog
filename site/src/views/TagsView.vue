<script setup lang="ts">
/**
 * 全部标签（对齐参考站 /tags）
 * 页头 + 一张玻璃卡里的标签云：字号随文章数温和放大（封顶，避免个别标签撑破版式）。
 */
import { computed, onMounted, ref } from 'vue'
import type { Tag } from '@/types'
import { getTags } from '@/api'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(true)
const tags = ref<Tag[]>([])

const countOf = (t: Tag) => t.count ?? 0

/** 出现次数最多的标签，用于把字号映射到 0~1 的区间 */
const maxCount = computed(() => Math.max(1, ...tags.value.map(countOf)))

/** 字号缩放：1rem → 1.4rem，封顶，避免长尾标签大到离谱 */
function fontSize(t: Tag): string {
  const ratio = Math.sqrt(countOf(t) / maxCount.value)
  const size = 0.95 + ratio * 0.45
  return `${Math.min(1.4, Math.max(0.95, size)).toFixed(3)}rem`
}

/** 热门标签的计数用暖金强调，让云层有轻重 */
function isHot(t: Tag): boolean {
  return countOf(t) >= 8
}

onMounted(async () => {
  try {
    tags.value = await getTags()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="tags-page container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">全部标签</h1>
      <p class="page-head__sub">按标签浏览文章</p>
      <hr class="grad-rule" />
    </header>

    <SkeletonBlock v-if="loading" variant="text" :lines="5" />

    <div v-else-if="tags.length" class="cloud glass-card glass-card--lg glass-pad">
      <RouterLink
        v-for="t in tags"
        :key="t.slug"
        :to="{ path: '/article', query: { tag: t.slug } }"
        class="tag-pill cloud__item"
        :style="{ fontSize: fontSize(t) }"
      >
        {{ t.name }}
        <span class="cloud__count" :class="{ 'cloud__count--hot': isHot(t) }">{{ countOf(t) }}</span>
      </RouterLink>
    </div>

    <EmptyState v-else title="还没有标签" description="文章打上标签后会出现在这里。" />
  </div>
</template>

<style scoped>
.tags-page {
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

/* ---------- 标签云 ---------- */
.cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-2);
  padding: var(--sp-6) var(--sp-5);
}
.cloud__item {
  line-height: 1.5;
  padding: 0.35em 0.95em;
}
.cloud__count {
  font-family: var(--font-mono);
  font-size: 0.62em;
  opacity: 0.6;
}
.cloud__count--hot {
  color: var(--c-gold);
  opacity: 0.95;
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
  .cloud {
    padding: var(--sp-4);
    gap: var(--sp-2);
  }
  /* 窄屏以整齐为主，放弃字号差异 */
  .cloud__item {
    font-size: var(--fs-xs) !important;
  }
}
</style>
