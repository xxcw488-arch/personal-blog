<script setup lang="ts">
/**
 * SiteHeader —— 吸顶玻璃导航条
 * ------------------------------------------------------------
 * 版式（对齐参考站）：左侧「玻璃小方块品牌标记 + 渐变站名」，
 * 正中间是导航胶囊（当前项为暖金半透明胶囊），最右是搜索与主题切换。
 * 交互：整条吸顶；主题图标读 <html data-theme> 并用 MutationObserver 跟随，
 * 切换只 emit 给外层 store。移动端（<=980px）折叠为汉堡 + 下滑玻璃面板，
 * 路由变化 / Esc / 遮罩点击都能关闭。
 * 极光背景、音乐播放器都是独立组件，这里一律不引入。
 *
 * 【首屏呼出】只有首页（`/`）走「浮层 + 滚动呼出」：
 *   停在首屏时不显示，向下滚过阈值后从视口上方滑入并吸顶常驻，
 *   滚回顶部再滑出。其他页面保持原来的常驻吸顶，行为完全不变。
 *   这样做也更贴近参考站——它的首屏背景一直铺到视口顶端，
 *   导航是浮在上面的，而不是占掉一条位置。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { SiteSettings } from '@/types'

defineProps<{
  /** 站点设置（后台可改，字段与接口一致） */
  settings: SiteSettings
}>()

const emit = defineEmits<{
  /** 请求切换浅色 / 暗色主题，由外层 store 处理 */
  'toggle-theme': []
}>()

interface NavItem {
  label: string
  to: string
}

/** 主导航：文案与真实路由（单数）一一对应 */
const NAV_ITEMS: NavItem[] = [
  { label: '首页', to: '/' },
  { label: '文章', to: '/article' },
  { label: '时光集', to: '/album' },
  { label: '音域', to: '/music' },
  { label: '碎碎念', to: '/moment' },
  { label: '项目', to: '/projects' },
  { label: '友链', to: '/links' },
  { label: '关于', to: '/about' },
]

/** 折叠断点，必须与 <style> 里的 980px 保持一致 */
const MOBILE_BREAKPOINT = 980

/**
 * 首页首屏「呼出导航」的滚动阈值（px）。
 * 取一个不大的值：滚一点点就让导航滑进来，既保住首屏的干净构图，
 * 又不会让人"想导航却找不到"。调手感改这一个数就行。
 */
const REVEAL_AT = 96

const route = useRoute()

/** 移动端面板开关 */
const menuOpen = ref(false)

/** 是否已经滚过阈值（决定首页的导航露不露头） */
const scrolled = ref(false)

/** 只有首页走浮层呼出模式 */
const isHome = computed(() => route.path === '/')

/**
 * 首页浮层模式：导航不占布局位置，浮在首屏之上。
 * 首屏期间整条隐藏，滚过阈值后滑入。
 */
const overlayMode = computed(() => isHome.value)

/** 首页首屏期间把导航收起来（其他页面永远为 false） */
const navHidden = computed(() => isHome.value && !scrolled.value)

/** 当前是否为暗色（决定显示太阳还是月亮） */
const isDark = ref(true)

function onScroll(): void {
  scrolled.value = window.scrollY > REVEAL_AT
}

/**
 * 当前栏目判定：首页只认精确匹配，其余按前缀匹配，
 * 这样 /article/foo 也会把「文章」点亮。
 */
function isActive(to: string): boolean {
  const path = route.path
  if (to === '/') return path === '/'
  return path === to || path.startsWith(`${to}/`)
}

function closeMenu(): void {
  menuOpen.value = false
}

/** 路由变化后自动收起移动端面板，并重新判定导航是否该露头 */
watch(() => route.fullPath, () => {
  closeMenu()
  // 换页后滚动位置会变（回到顶部或恢复），必须重新量一次，
  // 否则从"滚到一半的内页"切回首页时会带着旧的 scrolled 状态
  onScroll()
})

/**
 * 导航收起时顺手关掉移动端面板。
 * 面板和遮罩都是 position: fixed，如果留着开着的面板让导航滑走，
 * 屏幕上会剩下一块没有归属的浮层。
 */
watch(navHidden, (hidden) => {
  if (hidden) closeMenu()
})

/**
 * 主题来源是 <html data-theme>：tokens.css 的 :root 本身就是暖调深色，
 * 只有显式 light 才是浅色，所以"不是 light 就是暗色"。
 */
function syncTheme(): void {
  isDark.value = document.documentElement.dataset.theme !== 'light'
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu()
}

function onResize(): void {
  if (window.innerWidth > MOBILE_BREAKPOINT) closeMenu()
}

let themeObserver: MutationObserver | undefined

onMounted(() => {
  syncTheme()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  // 首帧就量一次：带 hash 直接进来、或浏览器恢复了滚动位置时，
  // 导航该露头就得立刻露，不能等用户先滚一下
  onScroll()

  // 主题由父级 store 改，这里只跟随，不持有状态
  themeObserver = new MutationObserver(syncTheme)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onScroll)
  themeObserver?.disconnect()
  themeObserver = undefined
})
</script>

<template>
  <header
    class="hdr"
    :class="{ 'hdr--overlay': overlayMode, 'hdr--hidden': navHidden }"
  >
    <!-- 滑动层：导航的底色 / 描边 / 投影都挂在这一层，滑出时整条一起走。
         注意**不能**把 transform 加在 .hdr 上：transform 会让
         position: fixed 的子元素改为相对它定位，
         移动端下滑面板和遮罩就会错位。 -->
    <div class="hdr__slide">
      <div class="container hdr__bar">
        <!-- 品牌：图标玻璃方块 + 渐变站名 -->
        <RouterLink class="brand" to="/" :aria-label="`${settings.siteName} 首页`">
          <span class="brand__tile">
            <!-- 品牌标记：抽象的光斑/纸页叠合图形，不再使用吉祥物插画。
                 内联 SVG 而非 <img>：描边要用 currentColor 跟随主题。 -->
            <svg class="brand__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <rect x="3.2" y="3.2" width="13.2" height="13.2" rx="3.6" stroke="currentColor" stroke-width="1.7" />
              <rect x="7.6" y="7.6" width="13.2" height="13.2" rx="3.6" stroke="currentColor" stroke-width="1.7" opacity="0.62" />
            </svg>
          </span>
          <span class="brand__name gradient-text">{{ settings.siteName }}</span>
        </RouterLink>

        <!-- 主导航：桌面横排，移动端变形为下滑玻璃面板 -->
        <nav
          id="site-nav"
          class="hdr__nav"
          :class="{ 'is-open': menuOpen }"
          aria-label="主导航"
        >
          <ul class="hdr__list">
            <li v-for="item in NAV_ITEMS" :key="item.to">
              <RouterLink
                class="nav-link"
                :class="{ 'is-active': isActive(item.to) }"
                :to="item.to"
                :aria-current="isActive(item.to) ? 'page' : undefined"
                @click="closeMenu"
              >
                {{ item.label }}
              </RouterLink>
            </li>
          </ul>
        </nav>

        <div class="hdr__actions">
          <!-- 搜索：直接进文章列表 -->
          <RouterLink class="icon-btn" to="/article" aria-label="搜索文章" title="搜索文章">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
          </RouterLink>

          <!-- 主题切换：图标随 <html data-theme> 变化 -->
          <button
            class="icon-btn"
            type="button"
            :aria-label="isDark ? '切换到浅色主题' : '切换到深色主题'"
            :title="isDark ? '切换到浅色主题' : '切换到深色主题'"
            @click="emit('toggle-theme')"
          >
            <svg
              v-if="isDark"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4.2" />
              <path
                d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"
              />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
            </svg>
          </button>

          <!-- 汉堡：只在移动端出现 -->
          <button
            class="icon-btn hdr__burger"
            type="button"
            aria-controls="site-nav"
            :aria-expanded="menuOpen"
            :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'"
            @click="menuOpen = !menuOpen"
          >
            <svg
              v-if="menuOpen"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 移动端遮罩：真实 button，键盘也能关 -->
    <button
      v-if="menuOpen"
      class="hdr__backdrop"
      type="button"
      aria-label="关闭导航菜单"
      tabindex="-1"
      @click="closeMenu"
    />
  </header>
</template>

<style scoped>
/* ---------- 吸顶玻璃条 ---------- */
.hdr {
  /* 高度直接引用全局令牌，不再另起 --hdr-h：
     之前这里是独立的 4rem，和 tokens.css 里算 Hero 高度用的
     --header-h 是两份互不相干的值，一旦有人只改一处，
     「导航 + Hero = 一屏」的前提就悄悄失效了。 */
  --hdr-h: var(--header-h);
  /* 导航**实际**总高 = 自身高度 + 底部 1px 分隔线。
     移动端下滑面板和遮罩要贴在这条线下面：
     原来直接用 --hdr-h(64px) 会比导航底(65px)高 1px，
     面板顶边压住导航的分隔线，那条线会被半透明面板盖出一道浅痕。 */
  --hdr-total: calc(var(--hdr-h) + 1px);
  position: sticky;
  top: 0;
  z-index: var(--z-header);
}

/*
 * 首页浮层模式：导航**不占布局位置**，浮在首屏之上。
 * 因为不占位，首页的首屏才能是整整一屏（见 tokens.css 的 --hero-h）。
 */
.hdr--overlay {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
}

/*
 * 滑动层：底色 / 描边 / 投影都挂在这一层，收起时整条一起滑走。
 *
 * 为什么用一层 inner wrapper、而不是直接把 transform 加在 .hdr 上：
 * 非 none 的 transform 会让 position: fixed 的**后代**改为相对该元素定位，
 * 移动端下滑面板（.hdr__nav）和遮罩（.hdr__backdrop）都是 fixed，
 * 一旦 .hdr 带上 transform 就会整体错位。
 * 把 transform 关在这层里，.hdr 始终没有 transform，fixed 后代就永远相对视口。
 * 所以这里也**不要**给它加 will-change: transform —— 那同样会创建包含块。
 */
.hdr__slide {
  background: var(--glass-bg-strong);
  border-bottom: 1px solid var(--c-line);
  box-shadow: var(--glass-shadow);
  transition: transform var(--dur) var(--ease);
}

/*
 * 收起态：向上滑出视口，同时 visibility: hidden。
 * visibility 必须等滑出动画播完再切（0s 延迟 var(--dur)），
 * 否则元素会在滑动过程中就消失；反向（显示）时不带延迟，立刻可见。
 *
 * 加 visibility 是为了**键盘可达性**：只靠 translateY 的话，
 * 元素仍在 Tab 顺序里，用户会 focus 到一个屏幕外的导航。
 * pointer-events: none 是配套的：.hdr 自己是 fixed 且占着顶部那一条，
 * 不关掉的话它会挡住首屏顶部的点击。
 */
.hdr--hidden {
  pointer-events: none;
}
.hdr--hidden .hdr__slide {
  transform: translateY(-100%);
  visibility: hidden;
  transition: transform var(--dur) var(--ease), visibility 0s linear var(--dur);
}

@media (prefers-reduced-motion: reduce) {
  .hdr__slide,
  .hdr--hidden .hdr__slide {
    transition: none;
  }
}

/* 用 .hdr .hdr__bar 提高特异度，压过全局 .container 的 z-index: var(--z-content)；
   再抬高到遮罩之上，让整条导航（含下滑面板）始终可点 */
.hdr .hdr__bar {
  position: relative;
  z-index: 3;
  /* 三列：左品牌 / 中导航 / 右操作。两侧都是 1fr，宽度永远相等，
     导航胶囊才真正落在整条的中轴上。
     原来用 flex + margin-inline: auto，剩余空间会被「导航左侧 + 导航右侧 +
     操作区左侧」三个 auto margin 均分，导航必然被挤到中轴左边
     （1440 视口下实测偏左 96px），右侧还空出一大块。 */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--hdr-h);
}

/* ---------- 品牌 ---------- */
.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  flex: none;
  min-width: 0;
  /* 网格第一列：贴左 */
  justify-self: start;
}

.brand__tile {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  border-radius: var(--radius);
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
  box-shadow: var(--glass-highlight);
  transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
}

.brand:hover .brand__tile {
  border-color: var(--c-gold);
  box-shadow: var(--glass-highlight), var(--glow-gold);
}

.brand__icon {
  /* 原来是 30px 的位图图标（几乎铺满 40px 的方砖）。
     换成描边 SVG 后同样的尺寸会显得顶到边框，收到 20px 留出呼吸；
     color 供 SVG 的 currentColor 取色，跟随主题与悬停态。 */
  width: 20px;
  height: 20px;
  display: block;
  color: var(--c-gold);
  transition: color var(--dur-fast) var(--ease);
}
.brand:hover .brand__icon {
  color: var(--c-ink);
}

.brand__name {
  font-size: var(--fs-lg);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.2;
  white-space: nowrap;
}

/* ---------- 导航胶囊 ---------- */
/* 居中交给网格的第二列（两侧 1fr 等宽 → 正中间），不再用 auto margin */
.hdr__nav {
  justify-self: center;
}

.hdr__list {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 0.35em 0.9em;
  border-radius: var(--radius-full);
  font-size: var(--fs-sm);
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--c-ink-2);
  white-space: nowrap;
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.nav-link:hover {
  background: var(--glass-bg);
  color: var(--c-ink);
}

/* 当前栏目：暖金半透明胶囊 */
.nav-link.is-active,
.nav-link.is-active:hover {
  background: var(--c-gold-soft);
  color: var(--c-gold);
  font-weight: 700;
}

/* ---------- 右侧操作区 ---------- */
.hdr__actions {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: none;
  /* 网格第三列：贴右（原来靠 margin-left: auto，会参与瓜分剩余空间） */
  justify-self: end;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--glass-bg);
  color: var(--c-ink-2);
  transition: background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.icon-btn:hover {
  background: var(--c-gold-soft);
  border-color: var(--c-gold);
  color: var(--c-gold);
}

.icon-btn svg {
  display: block;
  width: 1.1rem;
  height: 1.1rem;
}

.hdr__burger {
  display: none;
}

/* ---------- 移动端遮罩 ---------- */
.hdr__backdrop {
  position: fixed;
  top: var(--hdr-total);
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  width: 100%;
  padding: 0;
  border: none;
  /* 允许的原始 rgba：纯遮罩层 */
  background: rgba(0, 0, 0, 0.5);
  cursor: default;
  animation: hdr-fade var(--dur) var(--ease) both;
}

@keyframes hdr-fade {
  from {
    opacity: 0;
  }
}

/* ---------- 移动端：汉堡 + 下滑玻璃面板 ---------- */
@media (max-width: 980px) {
  .hdr__burger {
    display: inline-flex;
  }

  /* 移动端导航变成 fixed 的下滑面板，已经脱离网格；
     此时行内只剩品牌 + 操作区两项，收成两列（品牌占满左侧，操作区贴右）。 */
  .hdr .hdr__bar {
    grid-template-columns: 1fr auto;
  }

  /* 面板用 fixed 定位，脱离 .hdr__bar（position: relative）的包含块，
     才能做成真正的通栏下滑层，而不是被导航条本身裁窄。
     注意 justify-self 必须显式回到 stretch：桌面那条 .hdr__nav 带
     justify-self: center，而 Chrome 对「left/right 都是 0 的 fixed 盒子 +
     非 stretch 的 justify-self」会按内容宽度居中，面板会缩成一小条。 */
  .hdr__nav {
    position: fixed;
    top: var(--hdr-total);
    right: 0;
    left: 0;
    z-index: 2;
    justify-self: stretch;
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    background: var(--glass-bg-strong);
    border-bottom: 1px solid var(--c-line);
    box-shadow: var(--glass-shadow-lg), var(--glass-highlight);
    visibility: hidden;
    opacity: 0;
    transform: translateY(-0.75rem);
    pointer-events: none;
    transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease),
      visibility var(--dur) var(--ease);
  }

  .hdr__nav.is-open {
    visibility: visible;
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .hdr__list {
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-1);
  }

  .nav-link {
    display: flex;
    padding: 0.55em 0.9em;
    font-size: var(--fs-base);
  }
}

/* ---------- 极窄屏：站名收窄，别把图标挤出屏幕 ---------- */
@media (max-width: 560px) {
  .brand {
    min-width: 0;
  }

  .brand__name {
    font-size: var(--fs-md);
    max-width: 34vw;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .brand__tile {
    width: 2.25rem;
    height: 2.25rem;
  }

  .brand__icon {
    width: 18px;
    height: 18px;
  }
}
</style>
