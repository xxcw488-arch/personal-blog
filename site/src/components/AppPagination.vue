<script setup lang="ts">
/**
 * AppPagination —— 分页器
 * ------------------------------------------------------------
 * 玻璃拟态胶囊风格：当前页为暖金实底，其余为半透明玻璃。
 * totalPages <= 1 时整体不渲染（调用方无需自己判断）。
 * 页码用省略号折叠长序列，当前页带 aria-current="page"。
 */
import { computed } from 'vue'

const props = defineProps<{
  /** 当前页，从 1 开始 */
  page: number
  /** 总页数 */
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'update:page', value: number): void
}>()

/** 首尾始终展示的页数 */
const EDGE = 1
/** 当前页左右各展开的页数 */
const AROUND = 1

/** 折叠后的一页：数字，或省略号占位 */
type PageCell = number | 'gap-start' | 'gap-end'

const visible = computed(() => props.totalPages > 1)

const cells = computed<PageCell[]>(() => {
  const total = props.totalPages
  const current = Math.min(Math.max(props.page, 1), total)

  // 页数不多时全部铺开，不做折叠
  if (total <= EDGE * 2 + AROUND * 2 + 3) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const result: PageCell[] = []
  const left = Math.max(current - AROUND, EDGE + 2)
  const right = Math.min(current + AROUND, total - EDGE - 1)

  for (let i = 1; i <= EDGE; i += 1) result.push(i)
  if (left > EDGE + 1) result.push('gap-start')
  for (let i = left; i <= right; i += 1) result.push(i)
  if (right < total - EDGE) result.push('gap-end')
  for (let i = total - EDGE + 1; i <= total; i += 1) result.push(i)

  return result
})

const canPrev = computed(() => props.page > 1)
const canNext = computed(() => props.page < props.totalPages)

function go(target: number): void {
  const next = Math.min(Math.max(target, 1), props.totalPages)
  if (next === props.page) return
  emit('update:page', next)
}
</script>

<template>
  <nav v-if="visible" class="pager" aria-label="文章分页">
    <button
      class="pager__step"
      type="button"
      :disabled="!canPrev"
      aria-label="上一页"
      @click="go(page - 1)"
    >
      <span aria-hidden="true">←</span>
      <span class="pager__step-text">上一页</span>
    </button>

    <ul class="pager__list">
      <li v-for="cell in cells" :key="cell">
        <span v-if="typeof cell !== 'number'" class="pager__gap">
          <span aria-hidden="true">…</span>
          <span class="visually-hidden">{{
            cell === 'gap-start' ? '中间省略若干页' : '末尾省略若干页'
          }}</span>
        </span>
        <button
          v-else
          class="pager__num"
          :class="{ 'is-current': cell === page }"
          type="button"
          :aria-label="`第 ${cell} 页`"
          :aria-current="cell === page ? 'page' : undefined"
          @click="go(cell)"
        >
          {{ cell }}
        </button>
      </li>
    </ul>

    <button
      class="pager__step"
      type="button"
      :disabled="!canNext"
      aria-label="下一页"
      @click="go(page + 1)"
    >
      <span class="pager__step-text">下一页</span>
      <span aria-hidden="true">→</span>
    </button>
  </nav>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.pager__list {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  list-style: none;
  margin: 0;
  padding: 0;
}

.pager__step,
.pager__num,
.pager__gap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  padding-inline: var(--sp-2);
  font-size: var(--fs-sm);
  font-family: var(--font-sans);
  color: var(--c-ink-3);
  background: var(--glass-bg);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-full);
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease);
}

.pager__step {
  gap: var(--sp-2);
  padding-inline: var(--sp-4);
  letter-spacing: 0.02em;
}

.pager__step:hover:not(:disabled),
.pager__num:hover:not(.is-current) {
  color: var(--c-gold);
  border-color: var(--c-gold);
  background: var(--c-gold-soft);
}

.pager__step:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 当前页：暖金实底 + 加粗，不依赖颜色单一维度 */
.pager__num.is-current {
  color: var(--c-accent-ink);
  background: var(--c-gold);
  border-color: var(--c-gold);
  font-weight: 700;
}

.pager__gap {
  color: var(--c-ink-4);
  background: none;
  border-color: transparent;
  cursor: default;
}

@media (max-width: 640px) {
  .pager {
    gap: var(--sp-1);
  }

  .pager__step-text {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .pager__step {
    padding-inline: var(--sp-2);
  }

  .pager__num {
    min-width: 1.75rem;
  }
}
</style>
