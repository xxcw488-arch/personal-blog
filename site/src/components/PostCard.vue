<script setup lang="ts">
/**
 * 文章卡片
 * ------------------------------------------------------------
 * 对齐参考站的大卡片：封面通栏在顶 + 标题 + 摘要 + 日期·阅读时长。
 * cover 为空或图片加载失败时，回落到本地确定性生成的封面——
 * 不会出现破图，也不会留下空灰框。
 */
import { computed, ref } from 'vue'
import type { Post } from '@/types'
import { formatDate } from '@/utils'
import { coverImage } from '@/utils/cover'

const props = withDefaults(
  defineProps<{
    post: Post
    /** default = 大卡片（列表用）；compact = 紧凑行；mini = 侧栏纯文字行 */
    variant?: 'default' | 'compact' | 'mini'
  }>(),
  { variant: 'default' },
)

const imageFailed = ref(false)

/** 封面兜底：没有 cover 或加载失败，就用生成的占位封面 */
const coverSrc = computed(() => {
  if (props.post.cover && !imageFailed.value) return props.post.cover
  return coverImage(props.post.slug, 1200, 500, props.post.category?.name ?? '')
})

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/article/${props.post.slug}`)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* 剪贴板不可用时静默失败 */
  }
}
</script>

<template>
  <!-- ---------- mini：侧栏纯文字行 ---------- -->
  <RouterLink v-if="variant === 'mini'" :to="`/article/${post.slug}`" class="mini">
    <span class="mini__title clamp-1">{{ post.title }}</span>
    <span class="mini__date meta">{{ formatDate(post.publishedAt) }}</span>
  </RouterLink>

  <!-- ---------- compact：紧凑横排 ---------- -->
  <RouterLink
    v-else-if="variant === 'compact'"
    :to="`/article/${post.slug}`"
    class="compact glass-card glass-card--hover"
  >
    <div class="compact__thumb">
      <img :src="coverSrc" :alt="post.title" loading="lazy" decoding="async" />
    </div>
    <div class="compact__body">
      <h3 class="compact__title clamp-2">{{ post.title }}</h3>
      <p class="meta">
        {{ formatDate(post.publishedAt) }}
        <span class="meta__sep">·</span>
        {{ post.readingTime }} 分钟阅读
      </p>
    </div>
  </RouterLink>

  <!-- ---------- default：大卡片 ---------- -->
  <article v-else class="card glass-card glass-card--hover glass-card--lg">
    <RouterLink :to="`/article/${post.slug}`" class="card__link">
      <div class="card__cover">
        <img
          :src="coverSrc"
          :alt="post.title"
          loading="lazy"
          decoding="async"
          @error="imageFailed = true"
        />
        <!-- 封面左下角的分类角标（以前这里显示的是「类型」，类型已移除） -->
        <span v-if="post.category" class="card__category">{{ post.category.name }}</span>
      </div>

      <div class="card__body">
        <h3 class="card__title clamp-2">{{ post.title }}</h3>
        <p class="card__excerpt clamp-2">{{ post.excerpt }}</p>
        <div class="card__meta meta">
          <span>{{ formatDate(post.publishedAt) }}</span>
          <span class="meta__sep">·</span>
          <span>{{ post.readingTime }} 分钟阅读</span>
          <template v-if="post.tags.length">
            <span class="meta__sep">·</span>
            <span class="card__tags">
              <span v-for="t in post.tags.slice(0, 3)" :key="t.slug">#{{ t.name }}</span>
            </span>
          </template>
        </div>
      </div>
    </RouterLink>

    <!-- 分享按钮在卡片链接之外，避免 <a> 嵌套 -->
    <button
      class="card__share"
      :class="{ 'is-copied': copied }"
      :aria-label="copied ? '链接已复制' : '复制文章链接'"
      @click.stop="copyLink"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="M16 6l-4-4-4 4M12 2v13" />
      </svg>
    </button>
  </article>
</template>

<style scoped>
/* ============ default：大卡片 ============ */
.card {
  position: relative;
  overflow: hidden;
}
.card__link {
  display: block;
}
.card__cover {
  position: relative;
  aspect-ratio: 12 / 5;
  overflow: hidden;
  background: var(--c-code-bg);
}
.card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter var(--hover-dur) var(--ease);
}
/* 悬停只提亮封面，不缩放（全站统一：位移 / 边框 / 亮度，禁止缩放） */
.card:hover .card__cover img {
  filter: brightness(1.08);
}
/* 图片底部渐隐，让标题区过渡自然 */
.card__cover::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 45%;
  background: linear-gradient(to bottom, transparent, rgba(28, 25, 21, 0.6));
  pointer-events: none;
}
.card__category {
  position: absolute;
  left: var(--sp-4);
  bottom: var(--sp-3);
  z-index: 1;
  font-size: var(--fs-xs);
  padding: 0.15em 0.7em;
  border-radius: var(--radius-full);
  background: rgba(28, 25, 21, 0.55);
  color: var(--c-ink);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.card__body {
  padding: var(--sp-5);
}
.card__title {
  font-size: var(--fs-xl);
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: var(--sp-2);
  color: var(--c-ink);
  transition: color var(--dur-fast) var(--ease);
}
.card:hover .card__title {
  color: var(--c-gold);
}
.card__excerpt {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-3);
  margin-bottom: var(--sp-3);
}
.card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.card__tags {
  display: inline-flex;
  gap: var(--sp-2);
  color: var(--c-gold);
  opacity: 0.85;
}

.card__share {
  position: absolute;
  top: var(--sp-3);
  right: var(--sp-3);
  z-index: 2;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  background: rgba(28, 25, 21, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: var(--c-ink-2);
  opacity: 0;
  transition: all var(--dur-fast) var(--ease);
}
.card:hover .card__share,
.card__share:focus-visible {
  opacity: 1;
}
.card__share:hover {
  background: var(--c-gold);
  color: var(--c-accent-ink);
  border-color: var(--c-gold);
}
.card__share.is-copied {
  opacity: 1;
  background: var(--c-gold);
  color: var(--c-accent-ink);
  border-color: var(--c-gold);
}

/* ============ compact ============ */
.compact {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-3);
  align-items: center;
}
.compact__thumb {
  width: 96px;
  height: 68px;
  flex-shrink: 0;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--c-code-bg);
}
.compact__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.compact__body {
  min-width: 0;
}
.compact__title {
  font-size: var(--fs-base);
  font-weight: 700;
  line-height: 1.45;
  margin-bottom: var(--sp-1);
  color: var(--c-ink);
}
.compact:hover .compact__title {
  color: var(--c-gold);
}

/* ============ mini ============ */
.mini {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
  min-width: 0;
}
.mini + .mini {
  border-top: 1px solid var(--c-line-soft);
}
.mini__title {
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
  min-width: 0;
}
.mini:hover .mini__title {
  color: var(--c-gold);
}
.mini__date {
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .card__cover {
    aspect-ratio: 16 / 9;
  }
  .card__body {
    padding: var(--sp-4);
  }
  .card__title {
    font-size: var(--fs-lg);
  }
  /* 触屏没有 hover，分享按钮常显 */
  .card__share {
    opacity: 1;
  }
}
</style>
