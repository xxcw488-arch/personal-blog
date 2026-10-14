<script setup lang="ts">
/**
 * CalendarWidget —— 发布日历
 * ------------------------------------------------------------
 * 当月迷你月历：周一为一周之始（一 二 三 四 五 六 日）。
 *
 * 正确性要点：
 *   1. 天数由 new Date(y, m + 1, 0).getDate() 推出 —— 闰年 2 月自动是 29。
 *   2. 前导空格按「当月 1 号是星期几」计算，firstDay 为 0(周日) 时映射到第 6 位。
 *   3. 「今天」用本地日期（日历是给访客自己用的，与 ClockCard 的北京时间为不同目的）。
 *   4. 月份状态是组件本地的，前后翻月按钮可独立工作。
 *
 * 只渲染当月，不渲染相邻月份的日子（避免出现「看起来能点但其实是别的月」的格子）。
 */
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 有发布的日期与当天篇数，ISO 形式 YYYY-MM-DD */
    marks?: { date: string; count: number }[]
    /** 卡片标题 */
    title?: string
  }>(),
  { marks: () => [], title: '发布日历' },
)

/** 周一起始的星期表头 */
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

const pad2 = (n: number) => String(n).padStart(2, '0')

const today = new Date()
const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`

/** 当前展示的月份（组件本地状态） */
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

/** date → 当天篇数 */
const markCounts = computed(() => {
  const map = new Map<string, number>()
  for (const m of props.marks) {
    if (!m?.date) continue
    // count 缺失 / 为 0 的项直接跳过：画一个点出去比不画更糟（日历会「说谎」）
    const n = Number(m.count)
    if (!Number.isFinite(n) || n <= 0) continue
    map.set(m.date, Math.floor(n))
  }
  return map
})

interface DayCell {
  /** 1-31 */
  day: number
  /** YYYY-MM-DD */
  key: string
  isToday: boolean
  /** 当天发布篇数，0 = 没发 */
  count: number
  /** 点的大小档位：0 无点、1 少、2 中、3 多 */
  level: 0 | 1 | 2 | 3
}

/**
 * 篇数 → 点的档位（对应图例「少 / 中 / 多」）。
 * 1 篇太少，点小到几乎看不见；3 篇以上再放大就没意义了，
 * 所以只分三档，让「今天有发文」这件事一眼能看见。
 */
function levelOf(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  return 3
}

/** 前导空格数：0=周一 … 6=周日 */
const leadingBlanks = computed(() => {
  const firstWeekday = new Date(viewYear.value, viewMonth.value, 1).getDay()
  return (firstWeekday + 6) % 7
})

const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate())

const cells = computed<DayCell[]>(() => {
  const list: DayCell[] = []
  for (let day = 1; day <= daysInMonth.value; day++) {
    const key = `${viewYear.value}-${pad2(viewMonth.value + 1)}-${pad2(day)}`
    const count = markCounts.value.get(key) ?? 0
    list.push({ day, key, isToday: key === todayKey, count, level: levelOf(count) })
  }
  return list
})

/**
 * 按周切分成多行。
 * 关键：必须真的分行渲染 —— 如果把整个月都塞进同一个 <tr>，
 * 31 个单元格会挤在一行里互相重叠（之前就是这个 bug）。
 * 每行固定 7 格，不足处用 null 补齐，保证列对齐。
 */
const weeks = computed<(DayCell | null)[][]>(() => {
  const slots: (DayCell | null)[] = [
    ...Array.from({ length: leadingBlanks.value }, () => null),
    ...cells.value,
  ]
  // 尾部补齐到 7 的整数倍
  while (slots.length % 7 !== 0) slots.push(null)

  const rows: (DayCell | null)[][] = []
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7))
  return rows
})

const monthLabel = computed(() => `${viewYear.value} 年 ${viewMonth.value + 1} 月`)

/** 网格里该月有发布的日期个数，用于给辅助技术一句概览 */
const markedCount = computed(() => cells.value.filter((cell) => cell.count > 0).length)

/** 该月总发布篇数（右下角「本月 N 篇」） */
const monthTotal = computed(() => cells.value.reduce((sum, cell) => sum + cell.count, 0))

function shiftMonth(delta: number): void {
  const base = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = base.getFullYear()
  viewMonth.value = base.getMonth()
}

function goToday(): void {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
}

const isCurrentMonth = computed(
  () => viewYear.value === today.getFullYear() && viewMonth.value === today.getMonth(),
)
</script>

<template>
  <section class="calendar glass-card glass-pad">
    <div class="widget-head">
      <h2 class="widget-head__title">{{ props.title }}</h2>
      <div class="calendar__nav">
        <button
          class="calendar__nav-btn"
          type="button"
          aria-label="上一个月"
          @click="shiftMonth(-1)"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <button
          class="calendar__nav-btn"
          type="button"
          aria-label="下一个月"
          @click="shiftMonth(1)"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>

    <div class="calendar__bar">
      <button
        class="calendar__month"
        type="button"
        :title="isCurrentMonth ? '已经是本月' : '回到本月'"
        @click="goToday"
      >
        {{ monthLabel }}
      </button>
    </div>

    <p class="visually-hidden" role="status">
      {{ monthLabel }}，本月有 {{ markedCount }} 天发布，共 {{ monthTotal }} 篇
    </p>

    <table class="calendar__grid">
      <caption class="visually-hidden">
        {{ monthLabel }} 的日历
      </caption>
      <thead>
        <tr>
          <th v-for="label in WEEK_LABELS" :key="label" scope="col" class="calendar__head">
            {{ label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, wi) in weeks" :key="`w-${wi}`">
          <td
            v-for="(cell, ci) in week"
            :key="cell ? cell.key : `empty-${wi}-${ci}`"
            class="calendar__cell"
            :class="{
              'calendar__cell--today': cell?.isToday,
              'calendar__cell--marked': (cell?.count ?? 0) > 0,
            }"
          >
            <template v-if="cell">
              <time :datetime="cell.key" class="calendar__day">{{ cell.day }}</time>
              <span
                v-if="cell.level > 0"
                class="calendar__dot"
                :class="`calendar__dot--${cell.level}`"
                aria-hidden="true"
              />
              <span v-if="cell.count > 0" class="visually-hidden">有发布 {{ cell.count }} 篇</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 图例 + 本月合计：点的大小对应当天发了几篇 -->
    <div class="calendar__foot">
      <span class="calendar__legend" aria-hidden="true">
        <span class="calendar__legend-item"><i class="calendar__legend-dot" />少</span>
        <span class="calendar__legend-item"><i class="calendar__legend-dot" />中</span>
        <span class="calendar__legend-item"><i class="calendar__legend-dot" />多</span>
      </span>
      <span class="calendar__total">本月 {{ monthTotal }} 篇</span>
    </div>
  </section>
</template>

<style scoped>
.calendar__nav {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}

.calendar__nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
  color: var(--c-ink-3);
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.calendar__nav-btn:hover {
  color: var(--c-gold);
  border-color: var(--c-gold);
}

.calendar__bar {
  margin-bottom: var(--sp-2);
  text-align: center;
}

.calendar__month {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-ink-2);
  letter-spacing: 0.02em;
  padding: 0.15em 0.6em;
  border-radius: var(--radius-full);
  transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.calendar__month:hover {
  color: var(--c-gold);
  background: var(--c-gold-soft);
}

.calendar__grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.calendar__head {
  padding-bottom: var(--sp-1);
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-ink-4);
  text-align: center;
}

.calendar__cell {
  position: relative;
  /* 数字往上靠，下面留出放点的位置（点绝不能被数字或今天的圆底盖住） */
  height: 32px;
  padding: 1px 0 0;
  text-align: center;
  vertical-align: top;
}

.calendar__day {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  font-variant-numeric: tabular-nums;
}

/* 今天：暖金实心 + 深色字 */
.calendar__cell--today .calendar__day {
  background: var(--c-gold);
  color: var(--c-accent-ink);
  font-weight: 700;
}

/* 有发布的日期：数字提亮，下方一个金点 */
.calendar__cell--marked:not(.calendar__cell--today) .calendar__day {
  color: var(--c-ink);
}

/* 发文标记点：篇数越多点越大（对应下方「少 / 中 / 多」图例） */
.calendar__dot {
  position: absolute;
  left: 50%;
  bottom: 2px;
  translate: -50% 0;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--c-gold);
}
.calendar__dot--1 {
  width: 4px;
  height: 4px;
}
.calendar__dot--2 {
  width: 5px;
  height: 5px;
}
.calendar__dot--3 {
  width: 6px;
  height: 6px;
}

/* ---------- 图例 + 本月合计 ---------- */
.calendar__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
  padding-top: var(--sp-2);
  border-top: 1px solid var(--c-line-soft);
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

.calendar__legend {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-3);
}

.calendar__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.calendar__legend-dot {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--c-gold);
}
.calendar__legend-item:nth-child(2) .calendar__legend-dot {
  width: 5px;
  height: 5px;
}
.calendar__legend-item:nth-child(3) .calendar__legend-dot {
  width: 6px;
  height: 6px;
}

.calendar__total {
  color: var(--c-ink-3);
  font-variant-numeric: tabular-nums;
}
</style>
