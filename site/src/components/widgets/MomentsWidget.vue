<script setup lang="ts">
/**
 * MomentsWidget —— 最新碎碎念
 * ------------------------------------------------------------
 * 最多 2 条：正文 2 行截断，放在内嵌的柔和面板里（左侧暖金竖线），
 * 下方是相对时间。空数据时一行安静提示。
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Moment } from '@/types'
import { timeAgo } from '@/utils'

const props = defineProps<{
  moments: Moment[]
}>()

const MAX_MOMENTS = 2

interface MomentRow {
  key: string
  content: string
  createdAt: string
  relative: string
}

const rows = computed<MomentRow[]>(() =>
  props.moments
    .filter((moment) => moment && (moment.content || '').trim().length > 0)
    .slice(0, MAX_MOMENTS)
    .map((moment) => ({
      key: String(moment.id),
      content: moment.content,
      createdAt: moment.createdAt,
      relative: timeAgo(moment.createdAt),
    })),
)
</script>

<template>
  <section class="moments glass-card glass-pad">
    <div class="widget-head">
      <h2 class="widget-head__title">最新碎碎念</h2>
      <RouterLink class="widget-head__more" to="/moment">查看全部</RouterLink>
    </div>

    <ul v-if="rows.length" class="moments__list">
      <li v-for="row in rows" :key="row.key" class="moments__item">
        <blockquote class="moments__quote">
          <p class="moments__text clamp-2">{{ row.content }}</p>
        </blockquote>
        <p class="meta moments__meta">
          <time :datetime="row.createdAt">{{ row.relative }}</time>
        </p>
      </li>
    </ul>
    <p v-else class="moments__empty">暂无碎碎念</p>
  </section>
</template>

<style scoped>
.moments__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.moments__quote {
  margin: 0;
  padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
  border-left: 2px solid var(--c-gold);
  border-radius: 0 var(--radius) var(--radius) 0;
  background: var(--glass-bg);
}

.moments__text {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-2);
}

.moments__meta {
  margin-top: var(--sp-2);
}

.moments__empty {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
</style>
