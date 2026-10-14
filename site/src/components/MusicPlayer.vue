<script setup lang="ts">
/**
 * 全局悬浮音乐播放器（右下角常驻的玻璃面板）
 * ------------------------------------------------------------
 * · 收起态：一颗圆形玻璃按钮（当前封面 + 播放/暂停角标），点击展开。
 * · 展开态：玻璃面板（旋转封面 / 歌名歌手 / 进度 / 时间 / 控制）。
 *   顶部只有收起箭头，没有标题文字。
 *   不再带音量行：那一行在窄面板里既挤又难用，直接砍掉。
 * · 状态全部来自 usePlayerStore；本组件只负责「把 <audio> 交给 store」与渲染。
 * · 固定在右下角；手机上默认收起且面板不超过视口宽。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEFAULT_VOLUME, usePlayerStore } from '@/stores/player'
import { formatDuration } from '@/utils'

const player = usePlayerStore()

/** store 不持有 <audio>，由这里创建并交给它 */
const audioEl = ref<HTMLAudioElement | null>(null)
const expanded = ref(false)
/** 封面加载失败时退回音符图标，避免裂图 */
const coverFailed = ref(false)

const track = computed(() => player.current)

/** 进度条上限：时长未知时给个 1，避免 max=0 的非法区间 */
const rangeMax = computed(() => (player.duration > 0 ? player.duration : 1))
const seekDisabled = computed(() => player.duration <= 0)

const modeLabel = computed<string>(() => {
  switch (player.mode) {
    case 'single':
      return '单曲循环'
    case 'shuffle':
      return '随机播放'
    default:
      return '顺序播放'
  }
})

/** 时间读屏文案：1:05 / 3:20 */
const timeText = computed(
  () => `${formatDuration(player.currentTime)} / ${formatDuration(player.duration)}`,
)

/* 换曲时重置封面失败标记，新封面有机会重新加载 */
watch(
  () => track.value?.id,
  () => {
    coverFailed.value = false
  },
)

/** 低于这个音量在实机上已经等于静音（面板里没有音量控件，没法自己调回来） */
const NEAR_SILENT = 0.05

/* 曲目由全局播放器负责拉取：本组件在所有页面都挂载，
   所以 load() 放在这里，用户不必先访问 /music 才能看到播放器。
   store 内部做了"只拉一次"的守卫，重复调用无副作用。 */
onMounted(() => {
  void player.load()
  /* 音量行已经删掉，界面上再没有地方能把音量调回来。
     存档里若是 0 或 0.0x 这类「等于静音」的值，这里复位一次，
     否则会变成「在放歌却永远没声音、且无法自救」。 */
  if (player.volume < NEAR_SILENT) player.setVolume(DEFAULT_VOLUME)
})

/* 音频元素一旦挂载就交给 store；卸载时摘掉监听（不销毁 store 状态） */
watch(
  audioEl,
  (el) => {
    if (el) player.attachAudio(el)
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => {
  player.detachAudio()
})

function onSeekInput(event: Event): void {
  const el = event.target as HTMLInputElement
  player.seek(Number(el.value))
}
</script>

<template>
  <div
    v-if="player.hasTracks"
    class="memo"
    :class="{ 'is-expanded': expanded }"
    @keydown.escape="expanded = false"
  >
    <!-- store 不创建元素：这里放一个交给它 -->
    <audio ref="audioEl" preload="metadata" />

    <Transition name="memo-swap" mode="out-in">
      <!-- ---------- 收起态：圆形玻璃按钮 ---------- -->
      <button
        v-if="!expanded"
        key="fab"
        class="memo__fab glass-card"
        type="button"
        aria-label="展开音乐播放器"
        :aria-expanded="false"
        @click="expanded = true"
      >
        <img
          v-if="track?.cover && !coverFailed"
          class="memo__fab-art"
          :src="track.cover"
          alt=""
          @error="coverFailed = true"
        />
        <svg
          v-else
          class="memo__fab-art memo__note"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M20 4.5v10.2a3.3 3.3 0 1 1-1.8-2.9V7.4l-7.4 1.9v8.2a3.3 3.3 0 1 1-1.8-2.9V5.2z"
          />
        </svg>
        <span class="memo__fab-badge" aria-hidden="true">
          <svg v-if="player.playing" viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
            <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <path d="M8 5.2v13.6L19 12z" />
          </svg>
        </span>
      </button>

      <!-- ---------- 展开态：玻璃面板 ---------- -->
      <section
        v-else
        key="panel"
        class="memo__panel glass-card"
        role="region"
        aria-label="音乐播放器"
      >
        <!-- 面板顶部只留收起箭头：标题文字（原 MemoSound / 来点音乐）已按需求去掉，
             所以这一行改成靠右对齐，箭头仍然守在右上角。 -->
        <div class="memo__head">
          <button
            class="memo__icon-btn"
            type="button"
            aria-label="收起音乐播放器"
            @click="expanded = false"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        <div class="memo__disc" :class="{ 'is-spinning': player.playing }">
          <img
            v-if="track?.cover && !coverFailed"
            class="memo__disc-art"
            :src="track.cover"
            :alt="track ? `${track.title} 的封面` : '专辑封面'"
            @error="coverFailed = true"
          />
          <svg
            v-else
            class="memo__disc-art memo__note"
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label="暂无封面"
            focusable="false"
          >
            <path
              d="M20 4.5v10.2a3.3 3.3 0 1 1-1.8-2.9V7.4l-7.4 1.9v8.2a3.3 3.3 0 1 1-1.8-2.9V5.2z"
            />
          </svg>
        </div>

        <div class="memo__meta">
          <p class="memo__title clamp-1">{{ track?.title ?? '未选择曲目' }}</p>
          <p class="memo__artist meta clamp-1">{{ track?.artist ?? '—' }}</p>
        </div>

        <!-- 进度：原生 range，键盘可达；accent-color 走暖金令牌 -->
        <div class="memo__progress">
          <input
            class="memo__range"
            type="range"
            min="0"
            :max="rangeMax"
            step="0.1"
            :value="player.currentTime"
            :disabled="seekDisabled"
            :aria-valuetext="timeText"
            aria-label="播放进度"
            @input="onSeekInput"
          />
          <div class="memo__times mono">
            <span>{{ formatDuration(player.currentTime) }}</span>
            <span>{{ formatDuration(player.duration) }}</span>
          </div>
        </div>

        <div class="memo__controls">
          <button class="memo__icon-btn" type="button" aria-label="上一首" @click="player.prev()">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 5v14" />
              <path d="M17.5 5.6v12.8L9 12z" fill="currentColor" />
            </svg>
          </button>

          <button
            class="memo__play"
            type="button"
            :aria-label="player.playing ? '暂停' : '播放'"
            @click="player.toggle()"
          >
            <svg v-if="player.playing" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <rect x="7" y="5" width="3.8" height="14" rx="1.3" />
              <rect x="13.2" y="5" width="3.8" height="14" rx="1.3" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M8 5.2v13.6L19 12z" />
            </svg>
          </button>

          <button class="memo__icon-btn" type="button" aria-label="下一首" @click="player.next()">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M18 5v14" />
              <path d="M6.5 5.6v12.8L15 12z" fill="currentColor" />
            </svg>
          </button>

          <button
            class="memo__icon-btn memo__mode"
            type="button"
            :class="{ 'is-on': player.mode !== 'sequence' }"
            :aria-label="`播放模式：${modeLabel}，点击切换`"
            :title="modeLabel"
            @click="player.cycleMode()"
          >
            <!-- 顺序播放 -->
            <svg
              v-if="player.mode === 'sequence'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M17 3l3 3-3 3" />
              <path d="M20 6H8a4 4 0 0 0-4 4v1" />
              <path d="M7 21l-3-3 3-3" />
              <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
            </svg>
            <!-- 单曲循环 -->
            <svg
              v-else-if="player.mode === 'single'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M17 3l3 3-3 3" />
              <path d="M20 6H8a4 4 0 0 0-4 4v1" />
              <path d="M7 21l-3-3 3-3" />
              <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
              <path d="M11.4 10.6l1.6-1.1v5" />
            </svg>
            <!-- 随机播放 -->
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M16 3h5v5" />
              <path d="M4 20L21 3" />
              <path d="M21 16v5h-5" />
              <path d="M15 15l6 6" />
              <path d="M4 4l5 5" />
            </svg>
          </button>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
/* ---------- 定位：右下角 ---------- */
.memo {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: var(--z-player);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: var(--font-sans);
}

/* ---------- 收起态 ---------- */
.memo__fab {
  position: relative;
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: var(--radius-full);
  overflow: hidden;
  display: grid;
  place-items: center;
  /* 同上：浮在内容之上，用更实的不透明底 + 模糊 */
  background: rgba(28, 25, 21, 0.94);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--c-ink-3);
  cursor: pointer;
  transition: transform var(--hover-dur) var(--ease), box-shadow var(--hover-dur) var(--ease),
    border-color var(--hover-dur) var(--ease), filter var(--hover-dur) var(--ease);
}
/* 与全站卡片同一套悬停语言（位移 / 边框 / 亮度） */
.memo__fab:hover {
  border-color: var(--hover-border);
  box-shadow: var(--glass-shadow-lg), var(--glass-highlight), var(--glow-gold);
  transform: translateY(var(--hover-lift));
  filter: brightness(var(--hover-brightness));
}
.memo__fab-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.memo__note {
  padding: 26%;
  color: var(--c-gold);
}
.memo__fab-badge {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--grad-primary);
  color: var(--c-ink);
  box-shadow: var(--glass-shadow);
}
.memo__fab-badge svg {
  width: 10px;
  height: 10px;
}

/* ---------- 展开态 ---------- */
.memo__panel {
  /* 整体比参考站的面板小一圈：264px 宽在宽屏下不抢视线，
     窄屏再退回 calc(100vw - 2rem)，任何视口都不会横向溢出。 */
  width: min(264px, calc(100vw - 2rem));
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  /* 浮层会压在任何内容之上（页脚文字、正文、图片），
     所以这里必须比普通玻璃卡片更实：加深底色 + 背景模糊，
     否则后面的文字会透出来和面板内容糊在一起。 */
  background: rgba(28, 25, 21, 0.94);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
  box-shadow: var(--glass-shadow-lg), var(--glass-highlight);
}

/* 浅色主题下用浅底，避免暗色面板突兀 */
:root[data-theme='light'] .memo__panel {
  background: rgba(250, 248, 243, 0.94);
}

.memo__head {
  width: 100%;
  display: flex;
  align-items: center;
  /* 没有标题文字了：只剩收起箭头，靠右对齐（用 space-between 会把唯一的子元素推到左边） */
  justify-content: flex-end;
  gap: var(--sp-2);
}

/* 封面：播放时缓慢自转，暂停时停在当前角度 */
.memo__disc {
  width: 74px;
  height: 74px;
  border-radius: var(--radius-full);
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  animation: memo-spin 12s linear infinite;
  animation-play-state: paused;
}
.memo__disc.is-spinning {
  animation-play-state: running;
}
.memo__disc-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-full);
}
@keyframes memo-spin {
  to {
    transform: rotate(360deg);
  }
}

.memo__meta {
  width: 100%;
  text-align: center;
}
.memo__title {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink);
}
.memo__artist {
  margin-top: 2px;
}

/* ---------- 进度 ---------- */
.memo__progress {
  width: 100%;
}
.memo__range {
  width: 100%;
  height: 1rem;
  margin: 0;
  background: transparent;
  /* 暖金轨道与滑块，跟随浅色/暗色令牌 */
  accent-color: var(--c-gold);
  cursor: pointer;
}
.memo__range:disabled {
  opacity: 0.5;
  cursor: default;
}
.memo__times {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

/* ---------- 控制按钮 ----------
   三个走带按钮（上一首 / 播放 / 下一首）必须整体落在面板中轴上，
   所以「播放模式」按钮**不参与这行居中**：它绝对定位贴右端。
   如果它留在流内，四个按钮等距排开后中轴会落在「播放」和「下一首」之间，
   播放键就会明显偏左，看着像整行没对齐。 */
.memo__controls {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
}
.memo__mode {
  position: absolute;
  right: 0;
  top: 50%;
  translate: 0 -50%;
}
.memo__icon-btn {
  width: 27px;
  height: 27px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border-radius: var(--radius-full);
  color: var(--c-ink-3);
  transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}
.memo__icon-btn svg {
  width: 16px;
  height: 16px;
}
.memo__icon-btn:hover {
  color: var(--c-ink);
  background: var(--glass-bg-hover);
}
.memo__mode.is-on {
  color: var(--c-gold);
}

.memo__play {
  width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border-radius: var(--radius-full);
  background: var(--grad-primary);
  color: var(--c-ink);
  box-shadow: 0 6px 18px rgba(199, 155, 255, 0.28);
  transition: transform var(--dur-fast) var(--ease), filter var(--dur-fast) var(--ease);
}
.memo__play:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
.memo__play svg {
  width: 15px;
  height: 15px;
}

/* ---------- 展开 / 收起过渡 ---------- */
.memo-swap-enter-active,
.memo-swap-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.memo-swap-enter-from,
.memo-swap-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

/* ---------- 移动端：更贴边，面板不超出视口 ---------- */
@media (max-width: 640px) {
  .memo {
    right: 1rem;
    bottom: 1rem;
  }
  .memo__panel {
    width: calc(100vw - 2rem);
    padding: var(--sp-3) var(--sp-4);
  }
  .memo__disc {
    width: 64px;
    height: 64px;
  }
}

/* 关闭动效：不转动封面，只保留淡入淡出 */
@media (prefers-reduced-motion: reduce) {
  .memo__disc,
  .memo__disc.is-spinning {
    animation: none;
  }
}
</style>
