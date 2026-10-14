<script setup lang="ts">
/**
 * HotTagsCard —— 热门标签
 * ------------------------------------------------------------
 * 纯展示：父级传入 tags，这里只负责排版与截断（最多 12 个）。
 * 空数据时给一行安静提示，不渲染空壳子。
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Tag } from '@/types'

const props = defineProps<{
  tags: Tag[]
}>()

/** 侧栏空间有限，超出的标签交给「查看全部」 */
const MAX_TAGS = 12

const visibleTags = computed(() =>
  props.tags.filter((tag) => tag && tag.slug && tag.name).slice(0, MAX_TAGS),
)
</script>

<template>
  <section class="hot-tags glass-card glass-pad">
    <div class="widget-head">
      <h2 class="widget-head__title">热门标签</h2>
      <RouterLink class="widget-head__more" to="/article">查看全部</RouterLink>
    </div>

    <div v-if="visibleTags.length" class="hot-tags__list">
      <RouterLink
        v-for="tag in visibleTags"
        :key="tag.id"
        class="tag-pill"
        :to="{ path: '/article', query: { tag: tag.slug } }"
      >
        {{ tag.name }}
      </RouterLink>
    </div>
    <p v-else class="hot-tags__empty">暂无标签</p>
  </section>
</template>

<style scoped>
.hot-tags__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.hot-tags__empty {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
</style>
