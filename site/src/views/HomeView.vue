<script setup lang="ts">
/**
 * 首页 —— 对齐参考站结构
 *   Hero（整屏：背景照片质感层 + 大型角色 + kicker + 渐变大标题 + 简介 + 两个按钮 + 向下滚动）
 *   三栏：左（作者 + 热门标签）/ 中（最新文章）/ 右（时钟 / 相册 / 项目 / 日历 / 碎碎念）
 *
 * Hero 的高度与构图对齐参考站实测值（`section.hero` 836px @ 900 视口）：
 *   Hero 高度 = 视口高 - 吸顶导航高，即「导航 + Hero = 整整一屏」；
 *   内容块垂直中心落在视口中心下方 40px —— 这是视觉中心修正，
 *   因为标题上方的 kicker 拉长了视觉重心，几何居中反而显得偏上。
 * 具体数值全部走 tokens.css 的 --hero-h / --hero-shift。
 */
import { computed, onMounted, ref } from 'vue'
import type { Album, Moment, Post, Project, Stats, Tag } from '@/types'
import { getAlbums, getMoments, getPosts, getPostDates, getProjects, getStats, getTags } from '@/api'
import { useSettingsStore } from '@/stores/settings'
import PostCard from '@/components/PostCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProfileCard from '@/components/widgets/ProfileCard.vue'
import HotTagsCard from '@/components/widgets/HotTagsCard.vue'
import ClockCard from '@/components/widgets/ClockCard.vue'
import AlbumWidget from '@/components/widgets/AlbumWidget.vue'
import ProjectsWidget from '@/components/widgets/ProjectsWidget.vue'
import CalendarWidget from '@/components/widgets/CalendarWidget.vue'
import MomentsWidget from '@/components/widgets/MomentsWidget.vue'

const settingsStore = useSettingsStore()

const loading = ref(true)
const posts = ref<Post[]>([])
const tags = ref<Tag[]>([])
const albums = ref<Album[]>([])
const moments = ref<Moment[]>([])
const projects = ref<Project[]>([])
const stats = ref<Stats>()

/** 作者卡片上的三个统计（对齐参考站的「文章 / 碎碎念 / 照片」） */
const counts = computed(() => ({
  posts: posts.value.length,
  moments: moments.value.length,
  photos: albums.value.reduce((sum, a) => sum + (a.imageCount ?? 0), 0),
}))

/**
 * 发布日历的标记：日期 + 当天篇数。
 * ------------------------------------------------------------
 * 以前是拿首页那 5 篇最新文章的日期凑的 —— 更早的日期永远点不亮，
 * 而日历是可以翻月的，翻到上个月就什么也看不到。
 * 现在单独走一个只回「日期 + 篇数」的轻接口，全部文章都能标上。
 */
const postDates = ref<{ date: string; count: number }[]>([])

const hasPosts = computed(() => posts.value.length > 0)

onMounted(async () => {
  try {
    // 并发拉取；任一失败不影响其它区块
    const [postRes, tagRes, albumRes, momentRes, projRes, statRes] = await Promise.allSettled([
      // 首页只展示最新 5 篇（要更多就去 /article 看全部）
      getPosts({ perPage: 5 }),
      getTags(),
      getAlbums(),
      getMoments(),
      getProjects(),
      getStats(),
    ])
    if (postRes.status === 'fulfilled') posts.value = postRes.value.items
    if (tagRes.status === 'fulfilled') tags.value = tagRes.value
    if (albumRes.status === 'fulfilled') albums.value = albumRes.value
    if (momentRes.status === 'fulfilled') moments.value = momentRes.value
    if (projRes.status === 'fulfilled') projects.value = projRes.value
    if (statRes.status === 'fulfilled') stats.value = statRes.value
  } finally {
    loading.value = false
  }

  /* 日历是装饰件：单独加载，**不进上面那批 allSettled**。
     混在一起的话，它慢一秒首屏骨架就多停一秒（allSettled 要等全部落定），
     挂了还会把整页一起拖住 —— 几个日历点不值得。 */
  try {
    const list = await getPostDates()
    // 接口形状异常时别把非数组塞进 props：日历里 for...of 会直接抛
    if (Array.isArray(list)) postDates.value = list
  } catch (e) {
    console.warn('[home] 发布日历拉取失败', e)
  }
})
</script>

<template>
  <div class="home">
    <!-- ============ Hero（整屏） ============ -->
    <!-- 背景不再由首屏自己渲染：全站统一用 App.vue 里的 <SiteBackdrop />，
         这样「首页背景 == 内页背景」在结构上就成立，换背景只改一个文件。 -->
    <section class="hero">
      <!-- 内容块：整块垂直居中，再由 --hero-shift 微调（现为 0） -->
      <div class="hero__inner container">
        <div class="hero__content">
          <!-- 首屏小字导语：读后台「站点设置 → 报头上方小字（kicker）」。
               留空则整行不渲染（后台清空它就该真的消失，而不是留一个空胶囊）。 -->
          <div v-if="settingsStore.settings.kicker" class="hero__kicker">
            {{ settingsStore.settings.kicker }}
          </div>
          <h1 class="hero__title">
            <span class="gradient-text">{{ settingsStore.settings.siteName }}</span>
          </h1>
          <p class="hero__desc">{{ settingsStore.settings.tagline }}</p>

          <div class="hero__actions">
            <RouterLink to="/article" class="btn btn--primary">浏览文章</RouterLink>
            <RouterLink to="/about" class="btn">关于我</RouterLink>
          </div>
        </div>
      </div>

      <!-- 滚动提示：绝对定位贴底，不参与内容居中的计算 -->
      <a class="hero__scroll" href="#latest" aria-label="向下滚动到最新文章">
        <span>向下滚动</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </a>
    </section>

    <!-- ============ 三栏主体 ============ -->
    <div class="layout container container--wide">
      <!-- ---------- 左栏 ---------- -->
      <aside class="col col--left">
        <ProfileCard
          :settings="settingsStore.settings"
          :stats="stats"
          :counts="counts"
        />
        <HotTagsCard :tags="tags" />
      </aside>

      <!-- ---------- 中栏：最新文章 ---------- -->
      <main id="latest" class="col col--center">
        <div class="section-head">
          <h2 class="section-head__title">最新文章</h2>
          <RouterLink to="/article" class="section-head__more">查看全部 →</RouterLink>
        </div>

        <div v-if="loading" class="stack">
          <SkeletonBlock v-for="i in 3" :key="i" variant="feature" />
        </div>

        <div v-else-if="hasPosts" class="stack">
          <PostCard v-for="p in posts" :key="p.slug" :post="p" />
        </div>

        <EmptyState v-else title="还没有文章" description="去后台写第一篇吧。" />
      </main>

      <!-- ---------- 右栏 ---------- -->
      <aside class="col col--right">
        <ClockCard />
        <AlbumWidget :albums="albums" />
        <ProjectsWidget :projects="projects" />
        <CalendarWidget :marks="postDates" title="发布日历" />
        <MomentsWidget :moments="moments" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
   Hero —— 整屏首屏
   ------------------------------------------------------------
   高度：--hero-h = 整整一屏。首页导航是浮层（不占布局位置），
        停在首屏时收起，所以背景要一直铺到视口最顶端。
   内容：整块垂直居中，再用 --hero-shift 微调（现为 0 = 几何居中）。
   层级：背景 0 / 压暗 2 / 内容 3，用 z-index 明确排队，
        不靠 DOM 顺序碰运气（isolation 把层级封在 Hero 内部，
        避免和全局的 --z-header / --z-player 互相打架）。
   ============================================================ */
.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  /* 高度就是整整一屏，不再叠加最小高度：
     一旦 min-height 顶上来（矮屏兜底），Hero 就会高过一屏，
     下面三栏的第一行会从首屏底部露出来，首屏构图立刻散掉。
     矮屏改用媒体查询整体缩放内容，而不是把 Hero 撑高。 */
  height: var(--hero-h);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 横向留白照常；纵向 padding 只作为内容过高的兜底，
     居中靠 justify-content，不能被 padding 拉偏 */
  padding: var(--sp-5);
  text-align: center;
}

/* ---------- 内容 ---------- */
.hero__inner {
  position: relative;
  z-index: 3;
  width: 100%;
  display: flex;
  justify-content: center;
}
/* 垂直微调 = --hero-shift（正数下移、0 = 几何居中）。用 translate 而不是 margin，
   这样居中算法仍然按"整块"计算，不会被 margin 影响。 */
.hero__content {
  max-width: var(--hero-content-max);
  translate: 0 var(--hero-shift);
}
/* 内容自身的"软底衬"：角色放大后会从标题后方透出来，
   单靠文字投影在浅色角色上会糊。加一层极柔的径向暗底，
   既压住角色让文字立起来，又不会形成可见的方形色块。 */
.hero__content::before {
  content: '';
  position: absolute;
  inset: -14% -12%;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(
    58% 54% at 50% 50%,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0.28) 46%,
    transparent 78%
  );
  filter: blur(18px);
}
:root[data-theme='light'] .hero__content::before {
  background: radial-gradient(
    58% 54% at 50% 50%,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(255, 255, 255, 0.44) 46%,
    transparent 78%
  );
}

.hero__kicker {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  /* 用 --c-ink-3(#a89f8e) 时实测对比度只有 2.7 —— 中灰 + 柔和底衬
     的组合天生吃亏。提到 --c-ink(#ede6d8) 后达 6.0。
     它本来就是弱化元素，靠字号和字距区分层级，不靠压低对比度。 */
  color: var(--c-ink);
  margin-bottom: var(--sp-5);
  /* 中央光晕是画面最亮的一块，这一行正好压在它上面，
     纯投影不够（实测浅色主题下几乎读不出来）。
     给一块极淡的胶囊底衬，保证任何背景上都能读。 */
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(8px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.55);
}
.hero__kicker::before,
.hero__kicker::after {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--c-gold);
}
:root[data-theme='light'] .hero__kicker {
  color: var(--c-ink);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 12px rgba(255, 255, 255, 0.75);
}

.hero__title {
  font-size: var(--fs-hero);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.08;
  margin-bottom: var(--sp-4);
  /* 渐变文字在照片背景上需要更强的投影才能立住 */
  filter: drop-shadow(0 2px 16px rgba(255, 110, 199, 0.28))
    drop-shadow(0 8px 30px rgba(0, 0, 0, 0.5));
}

.hero__desc {
  max-width: 34em;
  margin: 0 auto var(--sp-6);
  /* 从 --fs-lg(18px) 提到 --fs-xl(22px)：首屏文字整体放大一档 */
  font-size: var(--fs-xl);
  color: var(--c-ink-2);
  text-shadow: 0 1px 14px rgba(0, 0, 0, 0.6);
}
:root[data-theme='light'] .hero__desc {
  text-shadow: 0 1px 14px rgba(255, 255, 255, 0.8);
}

.hero__actions {
  display: flex;
  gap: var(--sp-3);
  justify-content: center;
  flex-wrap: wrap;
}
/* 首屏按钮加大一档：参考站的首屏按钮也是明显大于内页的 */
.hero__actions .btn {
  padding: 0.75em 1.9em;
  font-size: var(--fs-base);
}
/* ---------- 滚动提示：贴底，不参与内容居中 ----------
   这里**不要底衬**：贴底正中的一块黑色胶囊会变成画面里最抢眼的
   一个"补丁"，把首屏构图切碎（实测观感远差于它换来的那点对比度）。
   所以只留文字 + 箭头，靠多层柔和投影把它从背景里"托"起来：
   近处一层贴字压暗轮廓，远处两层大半径扩散，水面高光再亮也读得清。 */
.hero__scroll {
  position: absolute;
  left: 50%;
  bottom: var(--sp-5);
  z-index: 3;
  translate: -50% 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-xs);
  letter-spacing: 0.16em;
  color: var(--c-ink);
  background: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 2px 10px rgba(0, 0, 0, 0.85),
    0 0 22px rgba(0, 0, 0, 0.7);
  transition: color var(--dur) var(--ease);
}
:root[data-theme='light'] .hero__scroll {
  color: var(--c-ink);
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.95), 0 2px 10px rgba(255, 255, 255, 0.9),
    0 0 22px rgba(255, 255, 255, 0.8);
}
.hero__scroll:hover {
  color: var(--c-gold);
}

.hero__scroll svg {
  animation: scroll-bounce 2s ease-in-out infinite;
}
@keyframes scroll-bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  50% {
    transform: translateY(6px);
    opacity: 1;
  }
}

/* ============================================================
   三栏布局
   ============================================================ */
.layout {
  display: grid;
  grid-template-columns: var(--sidebar-left) minmax(0, 1fr) var(--sidebar-right);
  gap: var(--sp-5);
  align-items: start;
  padding-top: var(--sp-6);
  border-top: 1px solid var(--c-line);
}
/* 「向下滚动」跳到的锚点（#latest）。
   首页导航是浮层，跳过去后目标顶部会被导航压住，
   用 scroll-margin-top 留出导航高 + 一点呼吸。
   导航收起时不占位，所以这个偏移只在导航露头时才有意义——
   而点「向下滚动」必然伴随滚动，导航那时已经滑进来了。 */
#latest {
  scroll-margin-top: calc(var(--header-h) + var(--sp-5));
}
.col {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  min-width: 0;
}
/* 左右侧栏吸顶滚动 */
.col--left,
.col--right {
  position: sticky;
  top: calc(var(--header-h) + 1rem);
  max-height: calc(100dvh - var(--header-h) - 2rem);
  overflow-y: auto;
  scrollbar-width: thin;
  /* 隐藏滚动条但保留滚动能力 */
  scrollbar-color: var(--c-line) transparent;
}
.col--left::-webkit-scrollbar,
.col--right::-webkit-scrollbar {
  width: 4px;
}
.col--left::-webkit-scrollbar-thumb,
.col--right::-webkit-scrollbar-thumb {
  background: var(--c-line);
  border-radius: var(--radius-full);
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

/* ============================================================
   响应式
   ============================================================ */
@media (max-width: 1180px) {
  .layout {
    grid-template-columns: var(--sidebar-left) minmax(0, 1fr);
  }
  /* 右栏内容移到中栏下方 */
  .col--right {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
    overflow: visible;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .col--left,
  .col--right {
    position: static;
    max-height: none;
    overflow: visible;
  }
  .col--right {
    grid-template-columns: minmax(0, 1fr);
  }
  .col--left {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

/* ---------- 手机 ----------
   标题字号不再单独覆盖：--fs-hero 已经是 clamp(3.5rem, 9vw, 7rem)，
   窄屏会自动落到下限 3.5rem，比原来的 --fs-3xl(36px) 明显更大，
   这正是这次要的效果。 */
@media (max-width: 640px) {
  .hero__desc {
    font-size: var(--fs-lg);
  }
  .hero__kicker {
    letter-spacing: 0.16em;
  }
  /* 小屏上“浏览文章 / 关于我”必须留在同一行：
     换行会在首屏正中多出一条横向割裂，构图立刻散掉。
     字号与内边距一起缩，320px 宽也塞得下两个胶囊。 */
  .hero__actions .btn {
    padding: 0.65em 1.3em;
    font-size: var(--fs-sm);
  }
  .col--left {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ---------- 矮屏兜底 ----------
   高度是硬性的整屏，撑不高，所以矮屏只能**缩内容**：
   把字阶和纵向间距一起压小，保证 kicker→按钮整块仍在视觉中心。
   阈值从 720px 下调到 680px：导航不再占位后首屏多出约 65px，
   矮屏的临界点随之降低，否则会在还很宽裕的高度就提前缩小。 */
@media (min-width: 641px) and (max-height: 680px) {
  .hero__title {
    /* 用 vh 兜底而不是固定 --fs-4xl：矮屏上标题也要跟着高度缩，
       固定值在 680 和 480 两种高度下表现差别太大 */
    font-size: clamp(2.5rem, 7vh, 4rem);
  }
  .hero__kicker {
    margin-bottom: var(--sp-4);
  }
  .hero__desc {
    margin-bottom: var(--sp-5);
  }
}
@media (min-width: 641px) and (max-height: 560px) {
  .hero__scroll {
    display: none;
  }
  .hero__desc {
    display: none;
  }
}
</style>
