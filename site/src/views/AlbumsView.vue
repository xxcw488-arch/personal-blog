<script setup lang="ts">
/**
 * 时光集 —— 相册列表（对齐参考站 /album）
 * 页头 + 自适应玻璃卡片网格；封面缺失或加载失败时回落到深色占位封面。
 */
import { onMounted, ref } from 'vue'
import type { Album } from '@/types'
import { getAlbums } from '@/api'
import { albumCoverImage } from '@/utils/cover'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(true)
const albums = ref<Album[]>([])

/** 该相册封面加载失败过的 slug：改用生成的深色占位封面 */
const brokenCovers = ref<Set<string>>(new Set())

/** 优先用后台上传的封面，没有（或坏图）时用按 slug 生成的深色封面 */
function coverFor(album: Album): string {
  if (album.cover && !brokenCovers.value.has(album.slug)) return album.cover
  return albumCoverImage(album.slug)
}

function onCoverError(slug: string) {
  const next = new Set(brokenCovers.value)
  next.add(slug)
  brokenCovers.value = next
}

/** 张数文案：优先用后端聚合的 imageCount，其次数当前已带出的图片 */
function countOf(album: Album): number {
  return album.imageCount ?? album.images?.length ?? 0
}

onMounted(async () => {
  try {
    albums.value = await getAlbums()
  } catch {
    albums.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="albums container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">时光集</h1>
      <p class="page-head__sub">旅行与日常的影像记录。</p>
      <hr class="grad-rule" />
    </header>

    <div v-if="loading" class="grid">
      <SkeletonBlock v-for="i in 3" :key="i" variant="card" />
    </div>

    <div v-else-if="albums.length" class="grid">
      <RouterLink
        v-for="(a, i) in albums"
        :key="a.slug"
        :to="`/album/${a.slug}`"
        class="album glass-card glass-card--hover glass-card--lg"
        v-reveal="i * 60"
      >
        <div class="album__media">
          <img
            :src="coverFor(a)"
            :alt="a.title"
            loading="lazy"
            decoding="async"
            @error="onCoverError(a.slug)"
          />
          <span v-if="countOf(a)" class="album__count mono">共 {{ countOf(a) }} 张</span>
        </div>

        <div class="album__body">
          <h2 class="album__title clamp-1">{{ a.title }}</h2>
          <p v-if="a.description" class="album__desc clamp-2">{{ a.description }}</p>
          <p class="album__meta meta">
            <span v-if="a.location">{{ a.location }}</span>
            <span v-if="a.location && a.takenAt" class="meta__sep">·</span>
            <span v-if="a.takenAt">{{ a.takenAt }}</span>
          </p>
        </div>
      </RouterLink>
    </div>

    <EmptyState v-else title="还没有相册" description="出去走走，回来就有照片了。" />
  </div>
</template>

<style scoped>
.albums {
  padding-top: var(--sp-6);
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

/* ---------- 网格 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--sp-5);
}

/* ---------- 相册卡片 ---------- */
.album {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.album__media {
  position: relative;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: var(--c-bg-deep);
}
.album__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter var(--hover-dur) var(--ease);
}
/* 悬停只提亮封面，不缩放（全站统一：位移 / 边框 / 亮度，禁止缩放） */
.album:hover .album__media img {
  filter: brightness(1.08);
}
.album__count {
  position: absolute;
  right: var(--sp-3);
  bottom: var(--sp-3);
  font-size: var(--fs-xs);
  padding: 0.2em 0.7em;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--c-line);
  color: var(--c-ink);
}
.album__media::after {
  /* 底部渐隐，让角标在亮图上也可读 */
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 45%;
  background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.55));
  pointer-events: none;
}

.album__body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
}
.album__title {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
  transition: color var(--dur-fast) var(--ease);
}
.album:hover .album__title {
  color: var(--c-gold);
}
.album__desc {
  font-size: var(--fs-sm);
  line-height: 1.7;
  color: var(--c-ink-3);
  min-height: 2.4em;
}
.album__meta {
  margin-top: var(--sp-1);
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
