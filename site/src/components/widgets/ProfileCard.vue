<script setup lang="ts">
/**
 * ProfileCard —— 左栏作者卡片
 * ------------------------------------------------------------
 * 结构：圆形头像（暖金细环）→ 作者名 → 简介 → 三栏计数 → 社交图标。
 *
 * 数据全部来自 props，卡片本身不取数：
 *   - 头像：settings.authorAvatar 为空时，用本地确定性 SVG 占位（零请求、不破图）
 *   - 计数：Stats 里没有「文章 / 碎碎念 / 照片」这类内容计数，
 *          所以另接一个可选的 counts；counts 缺省时诚实显示「暂无统计」，不猜数字。
 *   - stats（访客统计）非空时，只在底部补一行弱化提示；不占用三栏计数位。
 *   - 社交：填网址（http/https）的项直接跳转；只填号码的微信 / QQ
 *          点开是「复制号码」小窗（ContactDialog），方便访客去客户端里搜。
 */
import { computed, ref } from 'vue'
import type { SiteSettings, Stats } from '@/types'
import { avatarImage } from '@/utils/cover'
import { compactNumber, safeExternalUrl, safeLinkUrl } from '@/utils'
import ContactDialog from '@/components/ContactDialog.vue'

const props = defineProps<{
  settings: SiteSettings
  /** 站点访客统计，可选 */
  stats?: Stats
  /** 内容计数，可选；缺省时渲染「暂无统计」 */
  counts?: { posts: number; moments: number; photos: number }
}>()

/** 头像视觉直径（px）；固定尺寸 + 固定宽高比，避免布局位移 */
const AVATAR_PX = 76

const authorName = computed(
  () => (props.settings.author || '').trim() || (props.settings.siteName || '').trim() || '匿名作者',
)

const initial = computed(() => authorName.value.slice(0, 1) || 'A')

const avatarSrc = computed(() => {
  const custom = (props.settings.authorAvatar || '').trim()
  if (custom) return custom
  return avatarImage(authorName.value || 'author', initial.value)
})

interface CountItem {
  key: 'posts' | 'moments' | 'photos'
  label: string
  value: number
}

const countItems = computed<CountItem[]>(() => {
  const c = props.counts
  return [
    { key: 'posts', label: '文章', value: c?.posts ?? 0 },
    { key: 'moments', label: '碎碎念', value: c?.moments ?? 0 },
    { key: 'photos', label: '照片', value: c?.photos ?? 0 },
  ]
})

/** 社交链接里常见「true / 1 / yes」这类「已开启」写法，统一折算成真实地址 */
function resolveHref(value: string | undefined, fallback: string): string {
  const v = (value || '').trim()
  if (!v) return ''
  if (/^(true|1|yes|on)$/i.test(v)) return fallback
  return v
}

/** 只有 http(s) 才算「填的是网址」；其余（号码、用户名）一律当号码处理 */
function isWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

type SocialKind = 'github' | 'email' | 'wechat' | 'qq' | 'rss'

interface SocialItem {
  kind: SocialKind
  label: string
  /** 有值 = 外链，点击跳转 */
  href: string
  /** 有值 = 号码，点击弹复制框 */
  value: string
}

const socials = computed<SocialItem[]>(() => {
  const social = props.settings.social
  const list: SocialItem[] = []

  /* GitHub 必须是绝对地址：白名单挡住 javascript: / data:（见 utils/safeExternalUrl） */
  const github = safeExternalUrl(social?.github)
  if (github) list.push({ kind: 'github', label: 'GitHub', href: github, value: '' })

  /* 邮箱：填 http(s) 网址（比如订阅页）就跳转；填地址则弹「复制」小窗。
     以前这里一律拼成 mailto: —— 机器上没配默认邮件客户端时点了毫无反应
     （用户会以为按钮坏了）；填网址时更会拼出 mailto:https://… 这种死链。
     小窗里另给一个「用邮件客户端打开」，想走 mailto 的仍然点得到。 */
  const email = resolveHref(social?.email, '')
  if (email) {
    list.push(
      isWebUrl(email)
        ? { kind: 'email', label: '邮箱', href: email, value: '' }
        : { kind: 'email', label: '邮箱', href: '', value: email.replace(/^mailto:/i, '') },
    )
  }

  /* 微信 / QQ：填网址就跳转，填号码就弹复制框 —— 二选一由这里定 */
  const wechat = (social?.wechat || '').trim()
  if (wechat) {
    list.push(
      isWebUrl(wechat)
        ? { kind: 'wechat', label: '微信', href: wechat, value: '' }
        : { kind: 'wechat', label: '微信', href: '', value: wechat },
    )
  }

  const qq = (social?.qq || '').trim()
  if (qq) {
    list.push(
      isWebUrl(qq)
        ? { kind: 'qq', label: 'QQ', href: qq, value: '' }
        : { kind: 'qq', label: 'QQ', href: '', value: qq },
    )
  }

  /* RSS 允许站内相对路径（/feed.xml），同样挡住 javascript: 与 //host。
     兜底必须是 /feed.xml：站上只有这个路由，/rss.xml 会被 SPA 回退成 index.html（点了等于没反应） */
  const rss = safeLinkUrl(social?.rss) || '/feed.xml'
  if (rss) list.push({ kind: 'rss', label: 'RSS', href: rss, value: '' })

  return list
})

/** 当前打开的「复制」小窗；null = 关着 */
const contact = ref<{ kind: 'wechat' | 'qq' | 'email'; value: string } | null>(null)

function onSocialClick(item: SocialItem): void {
  // 外链走浏览器默认行为，不拦
  if (item.href) return
  // GitHub / RSS 不会走到这里（它们一定是链接），留个兜底
  if (item.kind === 'github' || item.kind === 'rss') return
  contact.value = { kind: item.kind, value: item.value }
}
</script>

<template>
  <section class="profile glass-card glass-pad">
    <div class="profile__id">
      <div class="profile__avatar">
        <img
          class="profile__avatar-img"
          :src="avatarSrc"
          :alt="`${authorName} 的头像`"
          :width="AVATAR_PX"
          :height="AVATAR_PX"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div class="profile__text">
        <h2 class="profile__name">{{ authorName }}</h2>
        <p v-if="settings.authorBio" class="profile__bio">{{ settings.authorBio }}</p>
        <p v-else class="profile__bio profile__bio--empty">暂无简介</p>
      </div>
    </div>

    <dl v-if="counts" class="profile__counts">
      <div v-for="item in countItems" :key="item.key" class="profile__count">
        <dt class="profile__count-label">{{ item.label }}</dt>
        <dd class="profile__count-value">{{ compactNumber(item.value) }}</dd>
      </div>
    </dl>
    <p v-else class="profile__empty">暂无统计</p>

    <ul v-if="socials.length" class="profile__socials">
      <li v-for="item in socials" :key="item.kind">
        <!-- 一个位置两种语义：填了网址就是 <a>（跳转），只有号码（微信 / QQ）就是 <button>（弹复制框） -->
        <component
          :is="item.href ? 'a' : 'button'"
          class="profile__social"
          :type="item.href ? undefined : 'button'"
          :href="item.href || undefined"
          :target="item.href && item.kind !== 'email' ? '_blank' : undefined"
          :rel="item.href && item.kind !== 'email' ? 'noopener noreferrer' : undefined"
          :aria-label="item.href ? item.label : `${item.label}：${item.value}（点击查看）`"
          :title="item.href ? item.label : `${item.label}：${item.value}（点击查看）`"
          @click="onSocialClick(item)"
        >
          <!-- GitHub -->
          <svg
            v-if="item.kind === 'github'"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M12 .5C5.73.5.9 5.33.9 11.6c0 4.9 3.17 9.05 7.57 10.52.55.1.75-.24.75-.53v-1.87c-3.08.67-3.73-1.48-3.73-1.48-.5-1.28-1.23-1.62-1.23-1.62-1-.69.08-.67.08-.67 1.11.08 1.7 1.14 1.7 1.14.98 1.68 2.57 1.2 3.2.92.1-.72.38-1.2.7-1.48-2.46-.28-5.05-1.23-5.05-5.48 0-1.21.43-2.2 1.14-2.97-.11-.28-.49-1.4.11-2.92 0 0 .93-.3 3.05 1.13a10.5 10.5 0 0 1 5.55 0c2.12-1.43 3.05-1.13 3.05-1.13.6 1.52.22 2.64.11 2.92.71.77 1.14 1.76 1.14 2.97 0 4.26-2.6 5.2-5.07 5.47.4.35.75 1.03.75 2.08v3.08c0 .29.2.64.76.53 4.4-1.47 7.56-5.62 7.56-10.52C23.1 5.33 18.27.5 12 .5Z"
            />
          </svg>

          <!-- 邮箱 -->
          <svg
            v-else-if="item.kind === 'email'"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="m3.6 7.2 8.4 5.8 8.4-5.8" />
          </svg>

          <!-- 微信：两个实心对话气泡 + 挖空的「眼睛」。
               用 fill-rule="evenodd" 把眼睛做成洞，而不是描边 + 实心点：
               之前那版是两条**未闭合**的描边路径，气泡轮廓缺一段、
               尾巴翘在外面，放大看就是个断掉的「C」形（16px 下也发糊）。 -->
          <svg
            v-else-if="item.kind === 'wechat'"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            fill-rule="evenodd"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M9.3 3.5C5.3 3.5 2.1 6.1 2.1 9.3c0 1.85 1.05 3.5 2.7 4.5l-.8 2.4 2.75-1.4c.78.2 1.6.32 2.45.32.16 0 .32 0 .48-.02a5.9 5.9 0 0 1-.2-1.5c0-3.1 2.95-5.6 6.6-5.6.2 0 .4 0 .6.03-.72-2.66-3.5-4.53-7.1-4.53Zm-3.1 3.4a1.02 1.02 0 1 1 0 2.04 1.02 1.02 0 0 1 0-2.04Zm4.5 0a1.02 1.02 0 1 1 0 2.04 1.02 1.02 0 0 1 0-2.04Z"
            />
            <path
              d="M16.9 9.6c-3.4 0-6.1 2.25-6.1 5.03 0 2.78 2.73 5.03 6.1 5.03.72 0 1.42-.1 2.06-.3l2.35 1.2-.66-2.03c1.43-.87 2.35-2.2 2.35-3.9 0-2.78-2.73-5.03-6.1-5.03Zm-2.2 2.75a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Zm4.4 0a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Z"
            />
          </svg>

          <!-- QQ：腾讯企鹅剪影，眼睛用 fill-rule="evenodd" 挖空。
               路径取自 Simple Icons 的 tencentqq 图标（CC0 1.0，可自由使用）。
               上一版是「圆头 + 椭圆身子 + 两条腿」的描边拼装，实机看着像雪人。 -->
          <svg
            v-else-if="item.kind === 'qq'"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            fill-rule="evenodd"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673ZM10.2 5.05a.92.92 0 1 0 0 1.84.92.92 0 0 0 0-1.84Zm3.6 0a.92.92 0 1 0 0 1.84.92.92 0 0 0 0-1.84Z"
            />
          </svg>

          <!-- RSS -->
          <svg
            v-else
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="5.6" cy="18.4" r="1.8" fill="currentColor" stroke="none" />
            <path d="M3.8 9.4a10.8 10.8 0 0 1 10.8 10.8" />
            <path d="M3.8 3.9C12.8 3.9 20 11.1 20 20" />
          </svg>
        </component>
      </li>
    </ul>

    <!-- 微信 / QQ 的「复制号码」小窗 -->
    <ContactDialog
      :open="contact !== null"
      :kind="contact?.kind ?? 'wechat'"
      :value="contact?.value ?? ''"
      :avatar="avatarSrc"
      :author-name="authorName"
      @close="contact = null"
    />

    <p v-if="stats" class="meta profile__stats">
      <span>此刻 {{ stats.online }} 人在线</span>
      <span class="meta__sep" aria-hidden="true">·</span>
      <span>累计 {{ compactNumber(stats.totalPv) }} 次阅读</span>
    </p>
  </section>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

/* ---------- 头像 + 名字 ---------- */
.profile__id {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  min-width: 0;
}

.profile__avatar {
  flex: 0 0 auto;
  width: 76px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  /* 暖金细环：用描边而不是背景，浅色主题下同样成立 */
  border: 1px solid var(--c-gold);
  box-shadow: var(--glow-gold);
}

.profile__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile__text {
  min-width: 0;
}

.profile__name {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
  line-height: 1.35;
}

.profile__bio {
  margin-top: var(--sp-1);
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-ink-3);
}

.profile__bio--empty {
  color: var(--c-ink-4);
}

/* ---------- 三栏计数 ---------- */
.profile__counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-2);
  margin: 0;
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--c-line-soft);
  border-bottom: 1px solid var(--c-line-soft);
}

.profile__count {
  display: flex;
  flex-direction: column-reverse; /* dd 显示在上、dt 标签在下 */
  align-items: center;
  gap: var(--sp-1);
  text-align: center;
}

.profile__count-value {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: 700;
  line-height: 1.2;
  color: var(--c-gold);
  font-variant-numeric: tabular-nums;
}

.profile__count-label {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

.profile__empty {
  padding: var(--sp-3) 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
  text-align: center;
  border-top: 1px solid var(--c-line-soft);
  border-bottom: 1px solid var(--c-line-soft);
}

/* ---------- 社交图标 ---------- */
.profile__socials {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile__social {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  /* 同一个类也用在 <button>（微信 / QQ 的复制小窗入口）上，
     所以要把按钮的默认内边距清掉，两种标签才长得一模一样 */
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
  color: var(--c-ink-3);
  transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease),
    background var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}

.profile__social:hover {
  color: var(--c-gold);
  border-color: var(--c-gold);
  background: var(--c-gold-soft);
  transform: translateY(-1px);
}

.profile__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
</style>
