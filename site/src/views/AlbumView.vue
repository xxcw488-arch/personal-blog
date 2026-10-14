<script setup lang="ts">
/**
 * 相册详情（对齐参考站 /album/:slug）
 * ------------------------------------------------------------
 * 玻璃卡片承载封面与元信息；下方图片网格。点击任意图片打开全屏灯箱：
 * 左右切换（按钮 / ←→ 键）、Esc 关闭、点背景关闭、循环播放；
 * 打开时锁定 body 滚动，焦点移入对话框，关闭后还给触发元素。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { Album, AlbumImage } from '@/types'
import { getAlbum } from '@/api'
import { albumCoverImage } from '@/utils/cover'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const props = defineProps<{ slug: string }>()

const loading = ref(true)
const notFound = ref(false)
const album = ref<Album | null>(null)
/** 相册封面加载失败过：改用生成的深色占位封面 */
const coverBroken = ref(false)

async function load(slug: string) {
  loading.value = true
  notFound.value = false
  album.value = null
  coverBroken.value = false
  closeLightbox(false)
  try {
    album.value = await getAlbum(slug)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

const images = computed<AlbumImage[]>(() => album.value?.images ?? [])

const coverSrc = computed(() => {
  const a = album.value
  if (!a) return ''
  if (a.cover && !coverBroken.value) return a.cover
  return albumCoverImage(a.slug)
})

/* ============================================================
   灯箱
   ============================================================ */
const lightboxOpen = ref(false)
const activeIndex = ref(0)
const dialogRef = useTemplateRef<HTMLElement>('dialogRef')
/** 对话框内可聚焦元素，Tab / Shift+Tab 时把焦点圈在灯箱里 */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
/** 打开灯箱前聚焦的元素，关闭时把焦点还回去 */
let lastFocused: HTMLElement | null = null
/** 打开前的 body overflow，关闭时还原 */
let prevBodyOverflow = ''

const activeImage = computed<AlbumImage | null>(() => images.value[activeIndex.value] ?? null)
const counter = computed(() => `${activeIndex.value + 1} / ${images.value.length}`)
/** 对话框可访问名称：带上相册名与当前图序号 */
const dialogLabel = computed(() => {
  const title = album.value?.title ?? '相册'
  return `${title} 图片浏览，第 ${activeIndex.value + 1} 张，共 ${images.value.length} 张`
})

function openLightbox(index: number) {
  if (!images.value.length) return
  activeIndex.value = Math.min(Math.max(index, 0), images.value.length - 1)
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  prevBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  lightboxOpen.value = true
  // 等对话框挂上 DOM 再移焦
  void nextTick(() => dialogRef.value?.focus())
}

function closeLightbox(restoreFocus = true) {
  if (!lightboxOpen.value) return
  lightboxOpen.value = false
  document.body.style.overflow = prevBodyOverflow
  if (restoreFocus) lastFocused?.focus()
  lastFocused = null
}

/** 上一张 / 下一张：两端循环 */
function step(delta: number) {
  const total = images.value.length
  if (total === 0) return
  activeIndex.value = ((activeIndex.value + delta) % total + total) % total
}

function onDialogKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closeLightbox()
      break
    case 'ArrowLeft':
      event.preventDefault()
      step(-1)
      break
    case 'ArrowRight':
      event.preventDefault()
      step(1)
      break
    case 'Tab': {
      // 焦点陷阱：只有「关闭 / 上一张 / 下一张」，循环即可
      const dialog = dialogRef.value
      if (!dialog) break
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        break
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) break
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
      break
    }
    default:
      break
  }
}

/** 点击遮罩（而非图片本身）关闭 */
function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) closeLightbox()
}

/** 图片加载失败时给出可见的占位提示，避免出现破图 */
const brokenImages = ref<Set<number>>(new Set())
function onImageError(id: number) {
  const next = new Set(brokenImages.value)
  next.add(id)
  brokenImages.value = next
}
function isBroken(id: number): boolean {
  return brokenImages.value.has(id)
}

/**
 * 灯箱打开时统一在 window 上处理键盘。
 * ------------------------------------------------------------
 * ⚠️ 这里**只挂一个监听**。之前 dialog 上还写了 `@keydown="onDialogKeydown"`，
 * 而焦点在 dialog 内时事件会先触发 dialog 的处理器、再冒泡到 window，
 * 同一个按键被处理两次 —— 按一次右键跳两张，顺序看起来完全乱掉
 * （3 张图时按右键会走出 1→3→2→1）。
 */
function onWindowKeydown(event: KeyboardEvent) {
  // 灯箱未打开时不劫持方向键，页面滚动照常
  if (!lightboxOpen.value) return
  // 双保险：万一以后又有人给某个元素加了处理器，这里不再重复处理
  if (event.defaultPrevented) return
  onDialogKeydown(event)
}

onMounted(() => {
  void load(props.slug)
  window.addEventListener('keydown', onWindowKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  document.body.style.overflow = prevBodyOverflow
})

watch(
  () => props.slug,
  (s) => void load(s),
)
</script>

<template>
  <div class="album-page container">
    <div v-if="loading" class="loading">
      <SkeletonBlock variant="feature" />
    </div>

    <EmptyState
      v-else-if="notFound || !album"
      title="找不到这个相册"
      description="它可能已被删除，或者链接输入有误。"
    >
      <RouterLink to="/album" class="btn">回到时光集</RouterLink>
    </EmptyState>

    <template v-else>
      <RouterLink to="/album" class="back meta">← 全部相册</RouterLink>

      <!-- 封面 + 元信息 -->
      <section class="hero glass-card glass-card--lg">
        <div class="hero__media">
          <img
            :src="coverSrc"
            :alt="album.title"
            loading="eager"
            decoding="async"
            @error="coverBroken = true"
          />
        </div>
        <div class="hero__body">
          <h1 class="hero__title">{{ album.title }}</h1>
          <p v-if="album.description" class="hero__desc">{{ album.description }}</p>
          <div class="hero__stats">
            <span class="hero__count mono">{{ images.length }} 张</span>
            <span class="meta">
              <span v-if="album.location">{{ album.location }}</span>
              <span v-if="album.location && album.takenAt" class="meta__sep">·</span>
              <span v-if="album.takenAt">{{ album.takenAt }}</span>
            </span>
          </div>
        </div>
      </section>

      <!-- 图片网格 -->
      <section v-if="images.length" class="gallery">
        <div class="section-head">
          <h2 class="section-head__title">全部照片</h2>
          <span class="section-head__more meta">点击放大</span>
        </div>

        <ul class="grid">
          <li v-for="(img, i) in images" :key="img.id" class="grid__item">
            <button
              type="button"
              class="shot glass-card glass-card--hover"
              :aria-label="`查看第 ${i + 1} 张：${img.caption || album.title}`"
              @click="openLightbox(i)"
            >
              <img
                v-if="!isBroken(img.id)"
                :src="img.url"
                :alt="img.caption || `${album.title} 第 ${i + 1} 张`"
                loading="lazy"
                decoding="async"
                @error="onImageError(img.id)"
              />
              <span v-else class="shot__fallback meta">图片已失效</span>
              <span v-if="img.caption" class="shot__caption clamp-1">{{ img.caption }}</span>
            </button>
          </li>
        </ul>
      </section>

      <p v-else class="gallery-empty meta">这个相册还没有照片。</p>
    </template>

    <!-- ============ 灯箱 ============ -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen && activeImage"
        ref="dialogRef"
        class="lightbox"
        role="dialog"
        aria-modal="true"
        :aria-label="dialogLabel"
        tabindex="-1"
        @click="onBackdropClick"
      >
        <p class="visually-hidden" aria-live="polite">{{ dialogLabel }}</p>

        <button
          type="button"
          class="lightbox__close"
          aria-label="关闭（Esc）"
          @click="closeLightbox()"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <button
          type="button"
          class="lightbox__nav lightbox__nav--prev"
          aria-label="上一张（←）"
          @click="step(-1)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <figure class="lightbox__figure">
          <img
            class="lightbox__img"
            :src="activeImage.url"
            :alt="activeImage.caption || `${album?.title ?? ''} 第 ${activeIndex + 1} 张`"
            decoding="async"
          />
          <figcaption class="lightbox__caption">
            <span v-if="activeImage.caption" class="lightbox__text">{{ activeImage.caption }}</span>
            <span class="lightbox__counter mono">{{ counter }}</span>
          </figcaption>
        </figure>

        <button
          type="button"
          class="lightbox__nav lightbox__nav--next"
          aria-label="下一张（→）"
          @click="step(1)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.album-page {
  padding-top: var(--sp-6);
  max-width: 1080px;
}
.loading {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}
.back {
  display: inline-block;
  margin-bottom: var(--sp-4);
}
.back:hover {
  color: var(--c-gold);
}

/* ---------- 封面 hero ---------- */
.hero {
  overflow: hidden;
}
.hero__media {
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: var(--c-bg-deep);
}
.hero__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero__body {
  padding: var(--sp-5) var(--sp-6) var(--sp-6);
}
.hero__title {
  font-size: var(--fs-3xl);
  font-weight: 800;
  letter-spacing: -0.01em;
}
.hero__desc {
  margin-top: var(--sp-3);
  font-size: var(--fs-md);
  line-height: 1.85;
  color: var(--c-ink-2);
  max-width: 42em;
}
.hero__stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
}
.hero__count {
  font-size: var(--fs-xs);
  padding: 0.2em 0.75em;
  border-radius: var(--radius-full);
  border: 1px solid var(--c-line);
  background: var(--c-gold-soft);
  color: var(--c-gold);
}

/* ---------- 网格 ---------- */
.gallery {
  margin-top: var(--sp-7);
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-4);
}
.grid__item {
  min-width: 0;
}
.shot {
  display: block;
  width: 100%;
  padding: 0;
  position: relative;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  background: var(--c-bg-deep);
  cursor: zoom-in;
  text-align: left;
}
.shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter var(--hover-dur) var(--ease);
}
/* 悬停只提亮，不缩放（全站统一：位移 / 边框 / 亮度，禁止缩放） */
.shot:hover img,
.shot:focus-visible img {
  filter: brightness(1.08);
}
.shot__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.shot__caption {
  position: absolute;
  inset: auto 0 0 0;
  padding: var(--sp-5) var(--sp-3) var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--c-ink);
  background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.72));
  pointer-events: none;
}
.gallery-empty {
  margin-top: var(--sp-6);
}

/* ============================================================
   灯箱
   ============================================================ */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-6) var(--sp-4);
  background: rgba(0, 0, 0, 0.88);
}
.lightbox:focus {
  outline: none;
}
.lightbox__figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  pointer-events: none;
}
.lightbox__img {
  max-width: 100%;
  max-height: 78vh;
  object-fit: contain;
  border-radius: var(--radius-lg);
  border: 1px solid var(--c-line);
  box-shadow: var(--glass-shadow-lg);
  background: var(--c-bg-deep);
}
.lightbox__caption {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  flex-wrap: wrap;
  justify-content: center;
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
  text-align: center;
  max-width: 60ch;
}
.lightbox__counter {
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  letter-spacing: 0.08em;
}

.lightbox__nav,
.lightbox__close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  border: 1px solid var(--c-line);
  background: var(--glass-bg-strong);
  color: var(--c-ink);
  transition: all var(--dur-fast) var(--ease);
}
.lightbox__nav:hover,
.lightbox__close:hover {
  border-color: var(--c-gold);
  color: var(--c-gold);
  box-shadow: var(--glow-gold);
}
.lightbox__close {
  position: absolute;
  top: var(--sp-5);
  right: var(--sp-5);
}

@media (max-width: 640px) {
  .hero__body {
    padding: var(--sp-4);
  }
  .hero__title {
    font-size: var(--fs-2xl);
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--sp-3);
  }
  .lightbox {
    padding: var(--sp-5) var(--sp-2);
    gap: var(--sp-1);
  }
  .lightbox__nav {
    width: 38px;
    height: 38px;
  }
  .lightbox__img {
    max-height: 68vh;
  }
}

/* 系统偏好「减少动效」时不做过渡（提亮本身保留，它不是动效） */
@media (prefers-reduced-motion: reduce) {
  .shot img,
  .hero__media img {
    transition: none;
  }
}
</style>
