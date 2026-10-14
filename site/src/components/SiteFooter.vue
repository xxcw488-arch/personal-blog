<script setup lang="ts">
/**
 * SiteFooter —— 玻璃页脚
 * ------------------------------------------------------------
 * 结构（对齐参考站）：顶部分割线 → 5 栏栅格
 *   品牌（图标 + 渐变站名 + 简介 + GitHub / 邮箱玻璃按钮）/
 *   快速导航 / 关于 / 友情链接 / 最新文章
 *   → 热门标签行（无标签时整行不渲染）
 *   → 底栏（版权 | Powered by | 隐私政策·服务条款·RSS，有备案号时追加）
 * 最新文章与热门标签属于页面数据，页脚不自己取，由父级按需传入；
 * 不传时最新文章渲染「暂无文章」占位，热门标签整行省略。
 * 只有非空的社交链接才会渲染，避免出现空锚点。
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { SiteSettings } from '@/types'
import { safeExternalUrl, safeLinkUrl } from '@/utils'
import ContactDialog from '@/components/ContactDialog.vue'

const props = defineProps<{
  /** 站点设置 */
  settings: SiteSettings
  /** 最新文章（父级传入；缺省时显示占位） */
  latestPosts?: { slug: string; title: string }[]
  /** 热门标签（父级传入；缺省时不渲染标签行） */
  hotTags?: { name: string; slug: string }[]
}>()

interface FooterNavItem {
  label: string
  to: string
}

/** 第 2 栏：快速导航 */
const NAV_QUICK: FooterNavItem[] = [
  { label: '首页', to: '/' },
  { label: '文章', to: '/article' },
  { label: '时光集', to: '/album' },
  { label: '音域', to: '/music' },
]

/** 第 3 栏：关于 */
const NAV_ABOUT: FooterNavItem[] = [
  { label: '关于我', to: '/about' },
  { label: '友链', to: '/links' },
  { label: '项目', to: '/projects' },
  { label: '碎碎念', to: '/moment' },
]

/**
 * 第 4 栏：友情链接。全部指向站内 /links，
 * 不臆造外部地址（真实友链在友链页由接口提供）。
 */
const FRIEND_LINKS: FooterNavItem[] = [
  { label: '友情链接', to: '/links' },
  { label: '申请友链', to: '/links' },
  { label: '全部友链', to: '/links' },
]

/** 年份取运行时间，版权主体由后台配置 */
const year = new Date().getFullYear()

/** 最新文章：最多 5 条；缺省时用占位行凑 4 行 */
const posts = computed(() => (props.latestPosts ?? []).slice(0, 5))

/** 热门标签：全部项，缺省时整行不渲染 */
const tags = computed(() => props.hotTags ?? [])

/**
 * 邮箱：填 http(s) 网址（比如订阅页）→ 直接跳转；填地址 → 弹「复制」小窗。
 * ------------------------------------------------------------
 * 以前这里一律拼成 mailto:，机器上没配默认邮件客户端时点了**毫无反应**
 * （页脚那颗邮箱按钮被反馈过就是这个原因），填网址时还会拼出
 * mailto:https://… 这种死链。想走系统邮件客户端的，小窗里留了入口。
 */
const mailValue = computed(() => {
  const v = (props.settings.social?.email ?? '').trim()
  // 与站长卡片同一套：true / 1 / yes 这类「已开启」写法不算地址
  return /^(true|1|yes|on)$/i.test(v) ? '' : v
})
const mailIsUrl = computed(() => /^https?:\/\//i.test(mailValue.value))
/** 有值 = 外链地址 */
const mailUrl = computed(() => (mailIsUrl.value ? mailValue.value : ''))
/** 有值 = 邮箱地址（去掉可能存在的 mailto: 前缀） */
const mailAddress = computed(() =>
  mailIsUrl.value ? '' : mailValue.value.replace(/^mailto:/i, ''),
)
const hasMail = computed(() => mailValue.value !== '')

/** 「复制邮箱」小窗 */
const contact = ref<{ kind: 'email'; value: string } | null>(null)

function openMail(): void {
  if (mailAddress.value) contact.value = { kind: 'email', value: mailAddress.value }
}

/** GitHub 只接受绝对地址，防止把裸用户名塞进 href */
const githubHref = computed(() => safeExternalUrl(props.settings.social?.github))

/** RSS 兜底到站内 feed；同样只放行 http(s) 与站内相对路径 */
const rssHref = computed(() => safeLinkUrl(props.settings.social?.rss) || '/feed.xml')
</script>

<template>
  <footer class="ft">
    <div class="container ft__inner">
      <!-- 1 栏：品牌 -->
      <div class="ft__col ft__col--brand">
        <RouterLink class="brand" to="/">
          <span class="brand__tile">
            <svg class="brand__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <rect x="3.2" y="3.2" width="13.2" height="13.2" rx="3.6" stroke="currentColor" stroke-width="1.7" />
              <rect x="7.6" y="7.6" width="13.2" height="13.2" rx="3.6" stroke="currentColor" stroke-width="1.7" opacity="0.62" />
            </svg>
          </span>
          <span class="brand__name gradient-text">{{ settings.siteName }}</span>
        </RouterLink>

        <p class="ft__desc">{{ settings.tagline }}</p>

        <div v-if="githubHref || hasMail" class="ft__socials">
          <a
            v-if="githubHref"
            class="ft__social"
            :href="githubHref"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1.05-.33-3.5 1.3a10.5 10.5 0 0 0-5.5 0C7.1 3.3 6.05 3.63 6.05 3.63a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.6 10c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
              />
            </svg>
            <span>GitHub</span>
          </a>

          <!-- 邮箱：填网址就是一条外链，填地址就弹复制小窗（mailto 收在小窗里） -->
          <component
            :is="mailUrl ? 'a' : 'button'"
            v-if="hasMail"
            class="ft__social"
            :type="mailUrl ? undefined : 'button'"
            :href="mailUrl || undefined"
            :target="mailUrl ? '_blank' : undefined"
            :rel="mailUrl ? 'noopener noreferrer' : undefined"
            :aria-label="mailAddress ? `邮箱：${mailAddress}（点击查看）` : '邮箱'"
            @click="openMail()"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="m3.8 7 7.3 5.4a1.5 1.5 0 0 0 1.8 0L20.2 7" />
            </svg>
            <span>邮箱</span>
          </component>
        </div>
      </div>

      <!-- 2 栏：快速导航 -->
      <nav class="ft__col" aria-labelledby="ft-nav-quick">
        <h2 id="ft-nav-quick" class="ft__col-title">快速导航</h2>
        <ul class="ft__list">
          <li v-for="item in NAV_QUICK" :key="item.to">
            <RouterLink class="ft__link" :to="item.to">{{ item.label }}</RouterLink>
          </li>
        </ul>
      </nav>

      <!-- 3 栏：关于 -->
      <nav class="ft__col" aria-labelledby="ft-nav-about">
        <h2 id="ft-nav-about" class="ft__col-title">关于</h2>
        <ul class="ft__list">
          <li v-for="item in NAV_ABOUT" :key="item.to">
            <RouterLink class="ft__link" :to="item.to">{{ item.label }}</RouterLink>
          </li>
        </ul>
      </nav>

      <!-- 4 栏：友情链接 -->
      <nav class="ft__col" aria-labelledby="ft-nav-friends">
        <h2 id="ft-nav-friends" class="ft__col-title">友情链接</h2>
        <ul class="ft__list">
          <li v-for="item in FRIEND_LINKS" :key="item.label">
            <RouterLink class="ft__link" :to="item.to">{{ item.label }}</RouterLink>
          </li>
        </ul>
      </nav>

      <!-- 5 栏：最新文章 -->
      <div class="ft__col">
        <h2 class="ft__col-title">最新文章</h2>
        <ul v-if="posts.length" class="ft__list">
          <li v-for="post in posts" :key="post.slug">
            <RouterLink class="ft__link clamp-1" :to="`/article/${post.slug}`">
              {{ post.title }}
            </RouterLink>
          </li>
        </ul>
        <ul v-else class="ft__list ft__list--empty">
          <li v-for="n in 4" :key="n" class="ft__empty">暂无文章</li>
        </ul>
      </div>
    </div>

    <!-- 热门标签行：无标签时整行省略 -->
    <div v-if="tags.length" class="container ft__tags">
      <span class="ft__tags-label">热门标签：</span>
      <RouterLink
        v-for="tag in tags"
        :key="tag.slug"
        class="tag-pill"
        :to="`/article?tag=${tag.slug}`"
      >
        {{ tag.name }}
      </RouterLink>
    </div>

    <!-- 底栏 -->
    <div class="container ft__bar">
      <p>© {{ year }} {{ settings.copyright }} 保留所有权利.</p>
      <p>Powered by Vue 3 · Cloudflare Pages · Cloudflare</p>
      <p class="ft__bar-links">
        <RouterLink class="ft__link" to="/privacy">隐私政策</RouterLink>
        <span class="ft__dot" aria-hidden="true">·</span>
        <RouterLink class="ft__link" to="/terms">服务条款</RouterLink>
        <span class="ft__dot" aria-hidden="true">·</span>
        <a class="ft__link" :href="rssHref">RSS</a>
      </p>
      <p v-if="settings.icp">
        <a
          class="ft__link"
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ settings.icp }}
        </a>
      </p>
    </div>

    <!-- 邮箱的「复制地址」小窗（与首页站长卡片同一个组件） -->
    <ContactDialog
      :open="contact !== null"
      kind="email"
      :value="contact?.value ?? ''"
      :avatar="settings.authorAvatar"
      :author-name="settings.author"
      @close="contact = null"
    />
  </footer>
</template>

<style scoped>
/* ---------- 外壳：比页面更深一档，保证底部收得住 ---------- */
.ft {
  margin-top: var(--sp-8);
  border-top: 1px solid var(--c-line);
  background: linear-gradient(to bottom, var(--glass-bg-strong), var(--c-bg-deep));
  color: var(--c-ink-3);
}

/* .container 自带 z-index，这里只是栅格容器 */
.ft__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) repeat(4, minmax(0, 1fr));
  gap: var(--sp-5) var(--sp-5);
  padding-block: var(--sp-7) var(--sp-6);
}

.ft__col {
  min-width: 0;
}

/* ---------- 品牌列 ---------- */
.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
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
  /* 与 SiteHeader 同一套品牌标记：描边 SVG 收到 20px 留出呼吸，
     color 供 SVG 的 currentColor 取色。 */
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

.ft__desc {
  margin-top: var(--sp-3);
  max-width: 26em;
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-3);
}

.ft__socials {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-top: var(--sp-4);
}

.ft__social {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0.35em 0.9em;
  border-radius: var(--radius-full);
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
  box-shadow: var(--glass-highlight);
  font-size: var(--fs-xs);
  /* 邮箱那颗现在是 <button>（点开复制小窗），要把按钮的默认字体/光标对齐 <a> */
  font-family: inherit;
  cursor: pointer;
  color: var(--c-ink-2);
  transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease);
}

.ft__social:hover {
  border-color: var(--c-gold);
  background: var(--c-gold-soft);
  color: var(--c-gold);
}

.ft__social svg {
  display: block;
  width: 1rem;
  height: 1rem;
}

/* ---------- 栏目列表 ---------- */
.ft__col-title {
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--c-ink);
  margin-bottom: var(--sp-3);
}

.ft__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ft__link {
  display: inline-block;
  max-width: 100%;
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}

.ft__link:hover {
  color: var(--c-gold);
}

/* 占位行：弱到不抢视线 */
.ft__empty {
  font-size: var(--fs-sm);
  color: var(--c-ink-4);
}

/* ---------- 热门标签行 ---------- */
.ft__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  padding-block: var(--sp-4);
  border-top: 1px solid var(--c-line-soft);
}

.ft__tags-label {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
  margin-right: var(--sp-1);
}

/* ---------- 底栏 ---------- */
.ft__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-4);
  padding-block: var(--sp-4);
  border-top: 1px solid var(--c-line-soft);
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

.ft__bar-links {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}

/* 底栏里的链接继承底栏字色，只在下划线时变金 */
.ft__bar .ft__link {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

.ft__bar .ft__link:hover {
  color: var(--c-gold);
}

.ft__dot {
  opacity: 0.5;
}

/* ---------- 响应式 ---------- */
@media (max-width: 1080px) {
  .ft__inner {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ft__col--brand {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .ft__inner {
    grid-template-columns: minmax(0, 1fr);
  }

  .ft__bar {
    justify-content: flex-start;
  }
}
</style>
