<script setup lang="ts">
/**
 * SkeletonBlock —— 加载骨架
 * ------------------------------------------------------------
 * 尺寸刻意对齐 PostCard 的真实版式（封面比例、标题行高、元信息行），
 * 数据到位后切换不会产生布局位移。
 * 纯装饰，对辅助技术隐藏；加载语义由外层容器负责播报。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'card' | 'text' | 'feature'
    /** 仅 text 变体生效：文本行数 */
    lines?: number
  }>(),
  { variant: 'card', lines: 3 },
)

/** 文本行宽循环模式：制造参差感，模拟真实段落 */
const LINE_WIDTHS = [100, 94, 88, 96, 82]

const lineWidths = computed(() => {
  const count = Math.min(Math.max(Math.round(props.lines), 1), 12)
  return Array.from({ length: count }, (_, i) => {
    // 最后一行留短，更像一段真实文字的收尾
    if (i === count - 1 && count > 1) return 62
    return LINE_WIDTHS[i % LINE_WIDTHS.length] ?? 100
  })
})
</script>

<template>
  <div class="sk" :class="`sk--${variant}`" aria-hidden="true">
    <template v-if="variant === 'text'">
      <p
        v-for="(width, i) in lineWidths"
        :key="i"
        class="skeleton sk__line"
        :style="{ width: `${width}%` }"
      />
    </template>

    <template v-else>
      <div class="skeleton sk__media" />
      <div class="sk__body">
        <p class="skeleton sk__kicker" />
        <p class="skeleton sk__title" />
        <p v-if="variant === 'feature'" class="skeleton sk__title sk__title--sub" />
        <p class="skeleton sk__line" style="width: 96%" />
        <p class="skeleton sk__line" style="width: 78%" />
        <p class="skeleton sk__meta" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.sk {
  display: block;
}

/* ---------- text ---------- */
.sk--text {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding-block: var(--sp-2);
}

.sk__line {
  height: 0.7rem;
  margin: 0;
}

/* ---------- card / feature ---------- */
.sk__media {
  aspect-ratio: 16 / 9;
  width: 100%;
  border-radius: var(--radius-sm);
}

.sk__body {
  padding-top: var(--sp-4);
}

.sk__kicker {
  height: 0.55rem;
  width: 4.5rem;
  margin: 0 0 var(--sp-3);
}

.sk__title {
  height: 1.05rem;
  width: 74%;
  margin: 0 0 var(--sp-3);
}

.sk__title--sub {
  width: 52%;
}

.sk__body .sk__line {
  margin-bottom: var(--sp-3);
}

.sk__meta {
  height: 0.55rem;
  width: 9rem;
  margin: var(--sp-4) 0 0;
}

/* ---------- feature 对齐头条的更大比例 ---------- */
.sk--feature .sk__media {
  aspect-ratio: 21 / 9;
}

.sk--feature .sk__title {
  height: 2.1rem;
  width: 68%;
}

.sk--feature .sk__title--sub {
  height: 2.1rem;
  width: 40%;
}

@media (max-width: 640px) {
  .sk--feature .sk__media {
    aspect-ratio: 16 / 9;
  }

  .sk--feature .sk__title {
    height: 1.4rem;
  }
}
</style>
