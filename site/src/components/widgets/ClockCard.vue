<script setup lang="ts">
/**
 * ClockCard —— 北京时间数字时钟
 * ------------------------------------------------------------
 * 关键点：**不受访客本地时区影响**。
 * 时间的年/月/日/时/分/秒全部由 Intl.DateTimeFormat 在
 * timeZone: 'Asia/Shanghai' 下取出，绝不用 Date 的本地取值方法。
 *
 * 星期另算：拿到上海的「年/月/日」后，用一次 Date.UTC 求得星期几，
 * 避免依赖不同 ICU 版本的星期文案（有的返回「周一」，有的返回「星期一」）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 卡片标题，默认「北京时间」 */
    label?: string
  }>(),
  { label: '北京时间' },
)

const TIME_ZONE = 'Asia/Shanghai'
/** 中国的 UTC 偏移固定为 +8（1986 年后不再有夏令时） */
const UTC_OFFSET_LABEL = 'UTC+8'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 取出指定时区下的日期字段，忽略 literal 片段 */
function zonedParts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: TIME_ZONE, ...options }).formatToParts(
    date,
  )
  const out: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = part.value
  }
  return out
}

const timeParts = computed(() => {
  const p = zonedParts(now.value, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  // 个别 ICU 在 hourCycle 缺省时给出 24 点，这里统一成 00
  const hour = p.hour === '24' ? '00' : (p.hour ?? '00')
  return {
    hour,
    minute: p.minute ?? '00',
    second: p.second ?? '00',
  }
})

/** 2026 10月12日 星期一 */
const dateText = computed(() => {
  const p = zonedParts(now.value, { year: 'numeric', month: 'numeric', day: 'numeric' })
  const y = Number(p.year)
  const m = Number(p.month)
  const d = Number(p.day)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ''
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? ''
  return `${y} ${m}月${d}日 ${weekday}`
})

/** 供 <time datetime> 用的上海日期，机器可读 */
const isoDate = computed(() => {
  const p = zonedParts(now.value, { year: 'numeric', month: 'numeric', day: 'numeric' })
  const y = Number(p.year)
  const m = Number(p.month)
  const d = Number(p.day)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ''
  return `${y}-${pad2(m)}-${pad2(d)}`
})

const spokenTime = computed(
  () => `北京时间 ${timeParts.value.hour} 时 ${timeParts.value.minute} 分 ${timeParts.value.second} 秒`,
)

onMounted(() => {
  now.value = new Date()
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
})
</script>

<template>
  <section class="clock glass-card glass-pad">
    <div class="widget-head">
      <h2 class="widget-head__title">{{ props.label }}</h2>
      <span class="chip clock__zone" :title="`中国标准时间 ${UTC_OFFSET_LABEL}`">
        {{ UTC_OFFSET_LABEL }}
      </span>
    </div>

    <div class="clock__body">
      <time class="clock__time" :datetime="isoDate">
        <span class="visually-hidden">{{ spokenTime }}</span>
        <span class="clock__digits" aria-hidden="true">
          <span class="clock__num">{{ timeParts.hour }}</span>
          <span class="clock__sep">:</span>
          <span class="clock__num">{{ timeParts.minute }}</span>
          <span class="clock__sep">:</span>
          <span class="clock__num">{{ timeParts.second }}</span>
        </span>
      </time>
      <p class="clock__date">{{ dateText }}</p>
    </div>
  </section>
</template>

<style scoped>
.clock__zone {
  padding: 0.15em 0.6em;
  font-variant-numeric: tabular-nums;
  color: var(--c-ink-4);
}

.clock__body {
  text-align: center;
  padding: var(--sp-2) 0 var(--sp-1);
}

.clock__time {
  display: block;
  font-family: var(--font-clock);
  font-size: var(--fs-2xl);
  font-weight: 700;
  line-height: 1.15;
  color: var(--c-ink);
  letter-spacing: 0.02em;
}

.clock__digits {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
}

.clock__num {
  font-variant-numeric: tabular-nums;
}

/* 暖金冒号 + 轻微辉光：跳秒时也不会让整行宽度变化 */
.clock__sep {
  color: var(--c-gold);
  text-shadow: 0 0 10px var(--c-gold-soft);
  margin-inline: 0.12em;
  animation: clock-pulse 2s var(--ease) infinite;
}

@keyframes clock-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.clock__date {
  margin-top: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
</style>
