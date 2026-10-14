<script setup lang="ts">
/**
 * AlbumWidget —— 相册专辑
 * ------------------------------------------------------------
 * 最多 2 行：封面缩略图 + 标题 + 「共 N 张」。
 * album.cover 为空时用本地生成封面（albumCoverImage），不留破图。
 * 缩略图外层固定 aspect-ratio，撑住空间、不产生布局位移。
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Album } from '@/types'
import { albumCoverImage } from '@/utils/cover'

const props = defineProps<{
  albums: Album[]
}>()

const MAX_ALBUMS = 2

interface AlbumRow {
  key: string
  slug: string
  title: string
  cover: string
  count: number | null
}

const rows = computed<AlbumRow[]>(() =>
  props.albums
    .filter((album) => album && album.slug)
    .slice(0, MAX_ALBUMS)
    .map((album) => ({
      key: album.slug,
      slug: album.slug,
      title: album.title || '未命名专辑',
      cover: (album.cover || '').trim() || albumCoverImage(album.slug),
      count:
        typeof album.imageCount === 'number'
          ? album.imageCount
          : (album.images?.length ?? null),
    })),
)
</script>

<template>
  <section class="albums glass-card glass-pad">
    <div class="widget-head">
      <h2 class="widget-head__title">相册专辑</h2>
      <RouterLink class="widget-head__more" to="/album">查看全部</RouterLink>
    </div>

    <ul v-if="rows.length" class="albums__list">
      <li v-for="row in rows" :key="row.key" class="albums__item">
        <RouterLink class="albums__link" :to="`/album/${row.slug}`">
          <span class="albums__thumb">
            <img
              class="albums__thumb-img"
              :src="row.cover"
              :alt="`${row.title} 的封面`"
              loading="lazy"
              decoding="async"
            />
          </span>
          <span class="albums__text">
            <span class="albums__title clamp-1">{{ row.title }}</span>
            <span class="meta albums__count">
              {{ row.count === null ? '暂无照片信息' : `共 ${row.count} 张` }}
            </span>
          </span>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="albums__empty">暂无相册</p>
  </section>
</template>

<style scoped>
.albums__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.albums__link {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2);
  border-radius: var(--radius);
  border: 1px solid transparent;
  transition: background var(--hover-dur) var(--ease), border-color var(--hover-dur) var(--ease),
    filter var(--hover-dur) var(--ease);
}

/* 卡片内的列表行：用与卡片同一套配色（边框转暖金 + 提亮），
   但**不做位移** —— 行是卡片内部的一段，浮起来会显得和列表脱开 */
.albums__link:hover {
  background: var(--glass-bg-hover);
  border-color: var(--hover-border);
  filter: brightness(var(--hover-brightness));
  color: inherit;
}

/* 固定宽高比，图片加载前后占位一致 */
.albums__thumb {
  flex: 0 0 auto;
  display: block;
  width: 56px;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
}

.albums__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter var(--hover-dur) var(--ease);
}

/* 悬停只提亮，不缩放（全站统一规则：位移 / 边框 / 亮度，禁止缩放） */
.albums__link:hover .albums__thumb-img {
  filter: brightness(1.08);
}

.albums__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.albums__title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink);
}

.albums__link:hover .albums__title {
  color: var(--c-gold);
}

.albums__empty {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
</style>
