<script setup lang="ts">
/**
 * 音域（对齐参考站 /music）
 * ------------------------------------------------------------
 * 曲目清单直接驱动全局播放器 store：点任意一行播放该曲，
 * 正在播放的行高亮并显示跳动指示器。播放条本身在 App 里常驻。
 */
import { computed, onMounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatDuration } from '@/utils'
import { coverImage } from '@/utils/cover'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const player = usePlayerStore()

const loading = ref(true)

const tracks = computed(() => player.tracks)
const total = computed(() => tracks.value.length)

/** 封面加载失败过的曲目 id，回落到生成的深色封面 */
const brokenCovers = ref<Set<number>>(new Set())

function coverFor(id: number, cover: string, title: string): string {
  if (cover && !brokenCovers.value.has(id)) return cover
  return coverImage(title || String(id), 600, 600)
}

function onCoverError(id: number) {
  const next = new Set(brokenCovers.value)
  next.add(id)
  brokenCovers.value = next
}

/** 当前曲目：当前行是否高亮 */
function isCurrent(index: number): boolean {
  return player.currentIndex === index
}

/** 点击整行播放该曲；再次点击同一行则暂停 / 继续 */
async function onSelect(index: number) {
  if (isCurrent(index)) {
    await player.toggle()
    return
  }
  await player.playIndex(index)
}

onMounted(async () => {
  try {
    await player.load()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="music container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">音域</h1>
      <p class="page-head__sub">共 {{ total }} 首</p>
      <hr class="grad-rule" />
    </header>

    <div v-if="loading" class="glass-card glass-pad">
      <SkeletonBlock v-for="i in 4" :key="i" variant="text" :lines="1" />
    </div>

    <div v-else-if="tracks.length" class="glass-card glass-card--lg playlist">
      <div class="widget-head playlist__head">
        <h2 class="widget-head__title">曲目清单</h2>
        <span class="widget-head__more">点击任意一行播放</span>
      </div>

      <ol class="list">
        <li
          v-for="(t, i) in tracks"
          :key="t.id"
          class="track"
          :class="{ 'track--on': isCurrent(i) }"
          v-reveal="i * 30"
        >
          <button
            type="button"
            class="track__row"
            :aria-current="isCurrent(i) ? 'true' : undefined"
            :aria-label="`播放 ${t.title} - ${t.artist}`"
            @click="onSelect(i)"
          >
            <span class="track__no mono">{{ String(i + 1).padStart(2, '0') }}</span>

            <span class="track__cover">
              <img
                :src="coverFor(t.id, t.cover, t.title)"
                :alt="t.title"
                loading="lazy"
                decoding="async"
                @error="onCoverError(t.id)"
              />
              <span class="track__overlay" aria-hidden="true">
                <svg v-if="!isCurrent(i) || !player.playing" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5-11-6.5z" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
                </svg>
              </span>
            </span>

            <span class="track__info">
              <span class="track__title clamp-1">{{ t.title }}</span>
              <span class="track__artist meta clamp-1">{{ t.artist }}</span>
            </span>

            <span class="track__album meta clamp-1">{{ t.album }}</span>

            <span v-if="isCurrent(i)" class="track__eq" aria-hidden="true">
              <i /><i /><i />
            </span>

            <span class="track__dur mono meta">{{ formatDuration(t.duration) }}</span>
          </button>
        </li>
      </ol>
    </div>

    <EmptyState v-else title="还没有曲目" description="曲库是空的，先去后台加几首吧。" />
  </div>
</template>

<style scoped>
.music {
  padding-top: var(--sp-6);
  max-width: 900px;
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

/* ---------- 播放列表 ---------- */
.playlist {
  padding: var(--sp-5) var(--sp-5) var(--sp-3);
}
.playlist__head {
  margin-bottom: var(--sp-3);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.track {
  border-radius: var(--radius);
  border-left: 3px solid transparent;
  transition: background var(--hover-dur) var(--ease), filter var(--hover-dur) var(--ease);
}
.track + .track {
  border-top: 1px solid var(--c-line-soft);
}
/* 列表行：与卡片同一套悬停语言（提亮），但不动边框 ——
   左边框被「正在播放」占用，改了会和状态指示打架 */
.track:hover {
  background: var(--glass-bg-hover);
  filter: brightness(var(--hover-brightness));
}
/* 正在播放：金色左边框 + 略亮的底色 */
.track--on {
  border-left-color: var(--c-gold);
  background: var(--c-gold-soft);
}
.track--on:hover {
  background: var(--c-gold-soft);
}

.track__row {
  display: grid;
  grid-template-columns: 2.25rem 3rem minmax(0, 1.4fr) minmax(0, 1fr) auto 3.5rem;
  align-items: center;
  gap: var(--sp-4);
  width: 100%;
  padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-2);
  text-align: left;
  color: inherit;
}
.track__no {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
.track--on .track__no {
  color: var(--c-gold);
}

.track__cover {
  position: relative;
  display: block;
  width: 3rem;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--c-bg-deep);
  border: 1px solid var(--c-line);
}
.track__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.track__overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.5);
  color: var(--c-ink);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease);
}
.track:hover .track__overlay,
.track--on .track__overlay {
  opacity: 1;
}

.track__info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}
.track__title {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--c-ink);
  line-height: 1.4;
}
.track--on .track__title {
  color: var(--c-gold);
}
.track__artist,
.track__album {
  min-width: 0;
}
.track__dur {
  text-align: right;
}

/* ---------- 播放指示器（跳动的三根柱） ---------- */
.track__eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}
.track__eq i {
  width: 3px;
  border-radius: var(--radius-full);
  background: var(--grad-brand-no);
  animation: eq-bounce 900ms var(--ease) infinite;
}
.track__eq i:nth-child(1) {
  height: 60%;
  animation-delay: -200ms;
}
.track__eq i:nth-child(2) {
  height: 100%;
  animation-delay: -600ms;
}
.track__eq i:nth-child(3) {
  height: 45%;
  animation-delay: -350ms;
}
@keyframes eq-bounce {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

@media (max-width: 720px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
  .track__row {
    grid-template-columns: 1.5rem 2.5rem minmax(0, 1fr) auto 2.75rem;
    gap: var(--sp-3);
  }
  .track__cover {
    width: 2.5rem;
  }
  .track__album {
    display: none;
  }
}
</style>
