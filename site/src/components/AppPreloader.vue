<script setup lang="ts">
/**
 * 预加载遮罩
 * ------------------------------------------------------------
 * 首屏渐变遮罩（参考站有同样的 preloader）。
 * 退场条件：
 *   1. 父组件把 ready 置为 true（数据已就绪）；
 *   2. 或者 3.5s 安全超时——接口慢 / 失败时绝不能把用户困在遮罩后面。
 * 遮罩样式来自 layout.css 的 .preloader / .preloader__spark / .preloader__text；
 * 退场后 pointer-events: none，不会挡住任何点击。
 */

import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ ready?: boolean }>(), { ready: false })

/** 安全超时：比它更慢的请求就不等了 */
const SAFETY_TIMEOUT = 3500

const done = ref(false)
let safetyTimer: ReturnType<typeof setTimeout> | undefined

function finish(): void {
  done.value = true
}

watch(
  () => props.ready,
  (ready) => {
    if (ready) finish()
  },
  { immediate: true },
)

onMounted(() => {
  safetyTimer = setTimeout(finish, SAFETY_TIMEOUT)
})

onBeforeUnmount(() => {
  if (safetyTimer) clearTimeout(safetyTimer)
})
</script>

<template>
  <div
    class="preloader"
    :class="{ 'preloader--done': done }"
    role="status"
    aria-live="polite"
    :aria-hidden="done ? 'true' : 'false'"
  >
    <div class="preloader__inner">
      <!-- 四角星「火花」：竖着看是星芒，斜着看像指南针的玫瑰 -->
      <svg
        class="preloader__spark"
        viewBox="0 0 48 48"
        role="img"
        aria-label="正在加载"
        focusable="false"
      >
        <defs>
          <linearGradient id="preloader-spark-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop class="preloader__stop preloader__stop--1" offset="0%" />
            <stop class="preloader__stop preloader__stop--2" offset="30%" />
            <stop class="preloader__stop preloader__stop--3" offset="60%" />
            <stop class="preloader__stop preloader__stop--4" offset="100%" />
          </linearGradient>
        </defs>

        <!-- 主星芒 -->
        <path
          d="M24 2 Q26.4 21.6 46 24 Q26.4 26.4 24 46 Q21.6 26.4 2 24 Q21.6 21.6 24 2 Z"
          fill="url(#preloader-spark-gradient)"
        />
        <!-- 右上角的小星芒，增加「罗盘」感 -->
        <path
          d="M24 2 Q26.4 21.6 46 24 Q26.4 26.4 24 46 Q21.6 26.4 2 24 Q21.6 21.6 24 2 Z"
          fill="url(#preloader-spark-gradient)"
          opacity="0.6"
          transform="translate(30 30) scale(0.32)"
        />
      </svg>

      <p class="preloader__text">加载中…</p>
    </div>
  </div>
</template>

<style scoped>
/* 渐变色只走令牌（等于把 --grad-preloader 的四个色标拆开用；
   SVG 的 fill 不能用 CSS 渐变，所以必须落在 stop-color 上） */
.preloader__stop--1 {
  stop-color: var(--c-purple-soft);
}
.preloader__stop--2 {
  stop-color: var(--c-rose);
}
.preloader__stop--3 {
  stop-color: var(--c-purple-mid);
}
.preloader__stop--4 {
  stop-color: var(--c-blue);
}

/* 关闭动效时：不旋转，只留淡出 */
@media (prefers-reduced-motion: reduce) {
  .preloader__spark {
    animation: none;
  }
}
</style>
