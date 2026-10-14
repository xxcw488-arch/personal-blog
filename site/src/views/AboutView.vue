<script setup lang="ts">
/**
 * 关于
 * 左：作者名片（头像 / 昵称 / 简介 / 事实清单）；右：正文散文。
 * 头像与文案全部来自站点设置，缺省时回落到构建期默认值并用生成的占位头像。
 */
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { defaultSettings } from '@/data/settings'
import { avatarImage } from '@/utils/cover'
import { safeExternalUrl } from '@/utils'
import ContactDialog from '@/components/ContactDialog.vue'

const store = useSettingsStore()
const s = defaultSettings

/** 设置项为空时回落默认值 */
const author = computed(() => store.settings.author || s.author)
const authorBio = computed(() => store.settings.authorBio || s.authorBio)
const avatarSrc = computed(
  () => store.settings.authorAvatar || avatarImage(author.value, author.value.slice(0, 1)),
)
const siteName = computed(() => store.settings.siteName || s.siteName)
const tagline = computed(() => store.settings.tagline || s.tagline)
const github = computed(() => safeExternalUrl(store.settings.social.github))

/**
 * 邮箱：填 http(s) 网址就跳转，填地址则弹「复制」小窗。
 * ------------------------------------------------------------
 * 名片上原本是 `<a href="mailto:…">` —— 机器上没配默认邮件客户端时点了
 * 毫无反应（页脚那颗邮箱按钮就是这么被反馈的），所以这里统一成同一套。
 */
const email = computed(() => {
  const v = (store.settings.social.email ?? '').trim()
  return /^(true|1|yes|on)$/i.test(v) ? '' : v.replace(/^mailto:/i, '')
})
const emailIsUrl = computed(() => /^https?:\/\//i.test(email.value))
/** 「复制邮箱」小窗 */
const contact = ref<{ kind: 'email'; value: string } | null>(null)
</script>

<template>
  <div class="about container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">关于</h1>
      <p class="page-head__sub">这个站点，和写它的人</p>
      <hr class="grad-rule" />
    </header>

    <div class="about__grid">
      <!-- 作者名片 -->
      <aside class="author glass-card glass-card--lg glass-pad">
        <div class="author__avatar">
          <img
            :src="avatarSrc"
            :alt="author"
            width="88"
            height="88"
            loading="lazy"
            decoding="async"
          />
        </div>
        <h2 class="author__name">{{ author }}</h2>
        <p class="author__bio">{{ authorBio }}</p>

        <dl class="facts">
          <div v-if="siteName" class="facts__row">
            <dt>站点</dt>
            <dd>{{ siteName }}</dd>
          </div>
          <div v-if="tagline" class="facts__row">
            <dt>简介</dt>
            <dd>{{ tagline }}</dd>
          </div>
          <div v-if="github" class="facts__row">
            <dt>GitHub</dt>
            <dd>
              <a :href="github" target="_blank" rel="noopener noreferrer">{{ github }}</a>
            </dd>
          </div>
          <div v-if="email" class="facts__row">
            <dt>邮箱</dt>
            <dd>
              <a v-if="emailIsUrl" :href="email" target="_blank" rel="noopener noreferrer">
                {{ email }}
              </a>
              <button
                v-else
                class="facts__link"
                type="button"
                :aria-label="`邮箱：${email}（点击查看）`"
                @click="contact = { kind: 'email', value: email }"
              >
                {{ email }}
              </button>
            </dd>
          </div>
        </dl>
      </aside>

      <!-- 正文 -->
      <div class="about__body glass-card glass-card--lg glass-pad">
        <div class="prose">
          <h2>这个站点是什么</h2>
          <p>
            一个用 Vue 3 写的个人博客，前端托管在 Cloudflare Pages，数据和接口跑在 Pages Functions +
            D1 上——没有自己的服务器，也没有需要维护的运维负担。
          </p>

          <h2>为什么做成这样</h2>
          <p>
            大部分个人博客长得像后台管理系统：等宽的卡片、一样的字号、一样的重量。那样很整齐，但读完之后记不住任何一篇。
          </p>
          <p>
            这里用一套深色的版式语言来做区分：<strong>暖褐底色、极光光斑、玻璃质感的卡片</strong>，
            以及克制的霓虹强调色；标题与正文全部无衬线，视线路径靠字重和间距而不是花哨的装饰来引导。
            另外保留了一个允许为空的封面字段——没有合适的图，比放一张不合适的图更好。
          </p>

          <blockquote>
            排版不是把字放上去，而是决定读者的眼睛先落在哪里、停留多久、然后去哪。
          </blockquote>

          <h2>技术构成</h2>
          <ul>
            <li><strong>前端</strong>：Vue 3 + TypeScript + Vite + Pinia + Vue Router</li>
            <li><strong>后端</strong>：Cloudflare Pages Functions（无服务器）</li>
            <li><strong>数据库</strong>：Cloudflare D1（SQLite）</li>
            <li><strong>样式</strong>：原生 CSS 变量 + 设计令牌，无 UI 框架</li>
            <li><strong>媒体</strong>：图片与音频托管在自有仓库，走 jsDelivr CDN</li>
          </ul>

          <h2>内容说明</h2>
          <p>
            本站的文章、相册与碎碎念均为原创或已获授权的内容。如果某个链接失效、或者你对某处内容有异议，欢迎通过
            关于页的邮箱联系。
          </p>

          <h2>接下来</h2>
          <p>
            这个站点还在持续搭建：相册浏览、音乐播放器、评论、留言板与访客统计会陆续上线，
            配套的后台管理系统也在计划中。
          </p>
        </div>
      </div>
    </div>

    <!-- 邮箱的「复制地址」小窗（与首页站长卡片、页脚同一个组件） -->
    <ContactDialog
      :open="contact !== null"
      kind="email"
      :value="contact?.value ?? ''"
      :avatar="avatarSrc"
      :author-name="author"
      @close="contact = null"
    />
  </div>
</template>

<style scoped>
.about {
  padding-top: var(--sp-6);
  max-width: 1180px;
}

/* ---------- 页头 ---------- */
.page-head {
  margin-bottom: var(--sp-5);
}
.page-head__title {
  font-size: var(--fs-3xl);
  font-weight: 800;
}
.page-head__sub {
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}

/* ---------- 两栏 ---------- */
.about__grid {
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(0, 8fr);
  gap: var(--sp-5);
  align-items: start;
}

/* ---------- 作者名片 ----------
   和首页左右侧栏同一套做法：往下滑时名片钉在导航下方，不跟着正文滚出屏幕。
   钉的是网格项本身——网格的 align-items: start 让它保持内容高度，
   才能在「整行（= 正文高度）」范围内 sticky；一旦被拉伸成整行高，
   sticky 就没有可移动的空间了。 */
.author {
  position: sticky;
  top: calc(var(--header-h) + 1rem);
  /* 视口很矮时名片自身可滚，否则底部的事实清单永远够不着 */
  max-height: calc(100dvh - var(--header-h) - 2rem);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--c-line) transparent;
  padding: var(--sp-6) var(--sp-5);
}
.author__avatar {
  width: 88px;
  height: 88px;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--c-code-bg);
  border: 1px solid var(--c-line);
  margin-bottom: var(--sp-4);
}
.author__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.author__name {
  font-size: var(--fs-xl);
  font-weight: 700;
  margin-bottom: var(--sp-2);
}
.author__bio {
  font-size: var(--fs-sm);
  line-height: 1.85;
  color: var(--c-ink-3);
  padding-bottom: var(--sp-4);
  border-bottom: 1px solid var(--c-line);
  margin-bottom: var(--sp-4);
}

/* ---------- 事实清单 ---------- */
.facts {
  margin: 0;
  font-size: var(--fs-xs);
}
.facts__row {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
}
.facts__row + .facts__row {
  border-top: 1px solid var(--c-line-soft);
}
.facts__row dt {
  flex-shrink: 0;
  width: 3.8em;
  color: var(--c-ink-4);
}
.facts__row dd {
  margin: 0;
  min-width: 0;
  color: var(--c-ink-2);
  word-break: break-all;
  line-height: 1.7;
}
.facts__row a {
  color: var(--c-gold);
}
.facts__row a:hover {
  color: var(--c-pink);
}
/* 邮箱现在是个 <button>（点开复制小窗）：抹掉按钮默认样式，长得和链接一样 */
.facts__link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--c-gold);
  text-align: left;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease);
}
.facts__link:hover {
  color: var(--c-pink);
}

/* ---------- 正文 ---------- */
.about__body {
  padding: var(--sp-6) var(--sp-7);
  min-width: 0;
}

@media (max-width: 900px) {
  .about__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  /* 单栏时名片排在正文上方，钉住只会盖住正文，恢复普通流式布局 */
  .author {
    position: static;
    max-height: none;
    overflow: visible;
  }
}
@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
  .about__body {
    padding: var(--sp-5) var(--sp-4);
  }
}
</style>
