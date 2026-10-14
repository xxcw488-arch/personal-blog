<script setup lang="ts">
/**
 * 碎碎念（对齐参考站 /moment）
 * 页头 + 按日期分组的时间轴；每条碎碎念是一张玻璃子卡片。
 */
import { computed, onMounted, ref } from 'vue'
import type { Moment } from '@/types'
import { getMoments } from '@/api'
import { formatDate, timeAgo } from '@/utils'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(true)
const moments = ref<Moment[]>([])

interface MomentGroup {
  /** 分组日期文案，同时作为 v-for 的 key */
  date: string
  items: Moment[]
}

/** 按日期分组，形成时间轴（保持接口返回的顺序） */
const groups = computed<MomentGroup[]>(() => {
  const map = new Map<string, Moment[]>()
  for (const m of moments.value) {
    const key = formatDate(m.createdAt)
    const arr = map.get(key)
    if (arr) arr.push(m)
    else map.set(key, [m])
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }))
})

onMounted(async () => {
  try {
    moments.value = await getMoments()
  } catch {
    moments.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="moments-page container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">碎碎念</h1>
      <p class="page-head__sub">生活里的小事，记下来就不算丢。</p>
      <hr class="grad-rule" />
    </header>

    <div v-if="loading" class="timeline">
      <SkeletonBlock v-for="i in 3" :key="i" variant="text" :lines="3" />
    </div>

    <div v-else-if="groups.length" class="timeline">
      <section
        v-for="(group, gi) in groups"
        :key="group.date"
        class="group"
        v-reveal="gi * 40"
      >
        <h2 class="group__date">
          <span class="group__dot" aria-hidden="true" />
          {{ group.date }}
        </h2>

        <ul class="group__list">
          <li v-for="m in group.items" :key="m.id" class="moment glass-card">
            <p class="moment__text">{{ m.content }}</p>

            <div v-if="m.images.length" class="moment__images">
              <div v-for="(src, i) in m.images" :key="`${m.id}-${i}`" class="moment__frame">
                <img
                  :src="src"
                  :alt="`碎碎念配图 ${i + 1}`"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>

            <div class="moment__meta meta">
              <span v-if="m.location">{{ m.location }}</span>
              <span v-if="m.location && m.mood" class="meta__sep">·</span>
              <span v-if="m.mood">{{ m.mood }}</span>
              <span v-if="(m.location || m.mood) && m.likes" class="meta__sep">·</span>
              <span v-if="m.likes" class="moment__likes">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 20s-7-4.4-7-9.2A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.8C19 15.6 12 20 12 20z" />
                </svg>
                {{ m.likes }}
              </span>
              <span class="meta__sep">·</span>
              <time :datetime="m.createdAt">{{ timeAgo(m.createdAt) }}</time>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <EmptyState v-else title="还没有碎碎念" description="想到什么就记一句。" />
  </div>
</template>

<style scoped>
.moments-page {
  padding-top: var(--sp-6);
  /* 单栏舒适阅读宽度 */
  max-width: 760px;
}

/* ---------- 页头 ---------- */
.page-head {
  margin-bottom: var(--sp-6);
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

/* ---------- 时间轴 ---------- */
.timeline {
  display: flex;
  flex-direction: column;
  gap: var(--sp-7);
}
.group {
  position: relative;
  padding-left: var(--sp-5);
  border-left: 1px solid var(--c-line);
}
.group__date {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--c-ink);
  margin-bottom: var(--sp-4);
}
.group__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--grad-brand-no);
  box-shadow: 0 0 0 4px var(--c-gold-soft);
  margin-left: calc(-1 * var(--sp-5) - 5px);
  flex-shrink: 0;
}

.group__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

/* ---------- 单条 ---------- */
.moment {
  padding: var(--sp-4) var(--sp-5);
}
.moment__text {
  font-size: var(--fs-base);
  line-height: 1.85;
  color: var(--c-ink-2);
  white-space: pre-line;
}
.moment__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.moment__frame {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--c-line);
  background: var(--c-bg-deep);
}
.moment__frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.moment__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-1);
  margin-top: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-line-soft);
}
.moment__likes {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  color: var(--c-pink);
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
  .moment {
    padding: var(--sp-4);
  }
}
</style>
