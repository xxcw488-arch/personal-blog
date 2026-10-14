<script setup lang="ts">
/**
 * ContactDialog —— 「复制联系方式」小窗
 * ------------------------------------------------------------
 * 首页站长卡片里，微信 / QQ / 邮箱这类**填号码（地址）而不是网址**的社交项，
 * 点击后弹这个框：展示内容 + 一键复制，方便访客拿去客户端里搜索或粘贴。
 * 填了网址的项不会走这里 —— 卡片上直接就是一条外链。
 *
 * 邮箱额外给一个「用邮件客户端打开」：不是每台机器都配了默认邮件程序，
 * 直接甩 mailto: 过去点了没反应，所以 mailto 收进小窗里当可选项。
 *
 * 交互沿用相册灯箱那一套（见 AlbumView.vue）：Teleport 到 body、
 * Esc / 点遮罩关闭、Tab 焦点陷阱、关闭后焦点归位、打开期间锁 body 滚动。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

const props = defineProps<{
  open: boolean
  /** 平台：决定标题、提示与是否给 mailto 入口 */
  kind: 'wechat' | 'qq' | 'email'
  /** 要复制的内容（微信号 / QQ 号 / 邮箱地址） */
  value: string
  /** 头像地址（与站长卡片同一个来源） */
  avatar: string
  authorName: string
}>()

const emit = defineEmits<{ close: [] }>()

const dialogRef = useTemplateRef<HTMLElement>('dialogRef')
const valueRef = useTemplateRef<HTMLInputElement>('valueRef')

/** 复制成功 / 失败的即时反馈 */
const copied = ref(false)
const copyFailed = ref(false)

const DIALOG_LABELS = {
  wechat: {
    title: '搜索加我微信',
    hint: '在微信里搜索这个号，或复制后粘贴添加',
    note: '加我请备注「博客」，谢谢～',
  },
  qq: {
    title: '搜索加我 QQ',
    hint: '在 QQ 里搜索这个号，或复制后粘贴添加',
    note: '加我请备注「博客」，谢谢～',
  },
  email: {
    title: '给我发邮件',
    hint: '复制地址后到你的邮箱里写，或直接用邮件客户端打开',
    note: '',
  },
} as const

const label = computed(() => DIALOG_LABELS[props.kind])

/** 邮箱专用：想走系统邮件客户端的入口（只放行「像邮箱地址」的值，挡住 ?/&/CRLF 注入） */
const EMAIL_RE = /^[^\s?&#]+@[^\s?&#]+$/
const mailtoHref = computed(() => {
  const v = props.value.trim()
  return props.kind === 'email' && EMAIL_RE.test(v) ? `mailto:${v}` : ''
})

/** 卡片首字兜底：没有头像时也不出现破图 */
const initial = computed(() => (props.authorName || 'A').slice(0, 1))

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
/** 打开前聚焦的元素，关闭时把焦点还回去 */
let lastFocused: HTMLElement | null = null
/** 打开前的 body overflow，关闭时还原 */
let prevBodyOverflow = ''
let resetTimer: number | undefined

async function copy(): Promise<void> {
  const text = props.value.trim()
  // 空值也要给反馈：静默 return 会让用户以为按钮坏了
  if (!text) {
    copied.value = false
    copyFailed.value = true
    return
  }

  let ok = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      ok = true
    }
  } catch {
    ok = false
  }
  // 剪贴板 API 在非安全上下文（http 域名）或旧浏览器里不可用，退回选中 + execCommand
  if (!ok) ok = legacyCopy()

  copied.value = ok
  copyFailed.value = !ok
  if (resetTimer) window.clearTimeout(resetTimer)
  // 成功与失败都自动复位，否则「已复制 / 复制失败」会一直挂在窗里
  resetTimer = window.setTimeout(() => {
    copied.value = false
    copyFailed.value = false
  }, 2000)
}

/** 兜底复制：选中输入框里的号码，再用 execCommand 复制 */
function legacyCopy(): boolean {
  const el = valueRef.value
  if (!el) return false
  el.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  }
}

/** 点号码框本身 = 全选，方便手动复制 */
function selectAll(): void {
  valueRef.value?.select()
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) emit('close')
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (!props.open || event.defaultPrevented) return

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  // 焦点陷阱：窗里只有「号码框 / 复制 / 关闭」，循环即可
  const dialog = dialogRef.value
  if (!dialog) return
  const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null,
  )
  if (items.length === 0) {
    event.preventDefault()
    dialog.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
      prevBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      copied.value = false
      copyFailed.value = false
      // 等小窗挂上 DOM 再移焦
      void nextTick(() => dialogRef.value?.focus())
    } else {
      document.body.style.overflow = prevBodyOverflow
      lastFocused?.focus()
      lastFocused = null
    }
  },
)

onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  document.body.style.overflow = prevBodyOverflow
  if (resetTimer) window.clearTimeout(resetTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="dialogRef"
      class="cd"
      role="dialog"
      aria-modal="true"
      :aria-label="label.title"
      tabindex="-1"
      @click="onBackdropClick"
    >
      <!-- 头像压在面板上沿：和参考站的加好友小窗同一构图 -->
      <div class="cd__avatar">
        <img v-if="avatar" :src="avatar" :alt="`${authorName} 的头像`" decoding="async" />
        <span v-else class="cd__avatar-initial" aria-hidden="true">{{ initial }}</span>
      </div>

      <div class="cd__panel">
        <button class="cd__close" type="button" aria-label="关闭（Esc）" @click="emit('close')">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 class="cd__title">{{ label.title }}</h2>
        <p class="cd__hint">{{ label.hint }}</p>

        <div class="cd__row">
          <input
            ref="valueRef"
            class="cd__value mono"
            type="text"
            readonly
            :value="value"
            :aria-label="kind === 'email' ? '邮箱地址' : '联系方式'"
            @focus="selectAll"
          />
          <button class="btn btn--primary cd__copy" type="button" @click="copy">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>

        <p v-if="copyFailed" class="cd__error" role="alert">复制失败，请手动选中复制</p>

        <!-- 邮箱：想走系统邮件客户端的，从这里进（没配默认邮件程序时点了没反应，
             所以它只是可选项，主操作永远是「复制」） -->
        <a v-if="mailtoHref" class="btn btn--ghost cd__mailto" :href="mailtoHref">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="m3.6 7.2 8.4 5.8 8.4-5.8" />
          </svg>
          用邮件客户端打开
        </a>

        <p v-if="label.note" class="cd__note">{{ label.note }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ---------- 遮罩 ---------- */
.cd {
  position: fixed;
  inset: 0;
  /* 与相册灯箱同级：模态层压过导航(100) 与播放器(250) */
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--sp-5);
  /* 允许的原始 rgba：纯遮罩层 */
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: cd-fade var(--dur) var(--ease) both;
}
.cd:focus {
  outline: none;
}

@keyframes cd-fade {
  from {
    opacity: 0;
  }
}

/* ---------- 头像：负边距让它压住面板上沿 ---------- */
.cd__avatar {
  position: relative;
  z-index: 1;
  width: 84px;
  height: 84px;
  margin-bottom: -42px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  border: 1px solid var(--c-gold);
  background: var(--c-code-bg);
  box-shadow: var(--glow-gold), var(--glass-shadow);
  color: var(--c-gold);
  font-size: var(--fs-2xl);
  font-weight: 700;
}
.cd__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---------- 面板 ---------- */
.cd__panel {
  position: relative;
  width: min(330px, calc(100vw - 2rem));
  /* 上半截给头像让位（84 / 2 = 42，再加一点呼吸） */
  padding: calc(42px + var(--sp-4)) var(--sp-5) var(--sp-5);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  text-align: center;
  /* 浮在正文之上：底色要够实，否则后面的字会透出来和内容糊在一起 */
  background: rgba(28, 25, 21, 0.96);
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
  box-shadow: var(--glass-shadow-lg), var(--glass-highlight);
}
:root[data-theme='light'] .cd__panel {
  background: rgba(250, 248, 243, 0.96);
}

.cd__close {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border-radius: var(--radius-full);
  color: var(--c-ink-3);
  transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}
.cd__close:hover {
  color: var(--c-ink);
  background: var(--glass-bg-hover);
}

.cd__title {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
}

.cd__hint {
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-ink-4);
}

/* ---------- 号码 + 复制 ---------- */
.cd__row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
}
.cd__value {
  flex: 1;
  min-width: 0;
  padding: 0.55em 0.75em;
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  text-align: center;
  outline: none;
  /* 邮箱地址可能比微信号长：放不下就省略号，别把「复制」按钮挤变形 */
  text-overflow: ellipsis;
  transition: border-color var(--dur-fast) var(--ease);
}
.cd__value:focus {
  border-color: var(--c-gold);
}
.cd__copy {
  flex: none;
}

/* 邮箱专用：次要操作，弱化处理 */
.cd__mailto {
  font-size: var(--fs-xs);
  padding: 0.45em 1.1em;
  color: var(--c-ink-2);
}

.cd__error {
  font-size: var(--fs-xs);
  color: var(--c-pink);
}

.cd__note {
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
}

@media (prefers-reduced-motion: reduce) {
  .cd {
    animation: none;
  }
}
</style>
