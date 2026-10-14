<script setup lang="ts">
/**
 * 友链 + 留言板（对齐参考站 /links）
 * ------------------------------------------------------------
 * 页面由四段组成：
 *   ① 页头（收录数量）
 *   ② 友链卡片网格（按 groupName 分组）
 *   ③ 申请友链（说明 + 三条规则 + 四步格式指引）
 *   ④ 留言板（发布表单 + 列表）
 *
 * 关于「申请友链」：参考站没有独立申请表单，而是**让大家在留言板按固定格式留言**。
 * 这里沿用同样的做法，并额外提供「填入格式模板」按钮降低门槛。
 * 含链接的留言会被标记为友链申请，阶段 4 后台可据此一键转为待审友链。
 *
 * 关于登录：参考站要求 GitHub 登录后才能留言。GitHub OAuth 属于阶段 5，
 * 所以当前用「昵称」作为临时身份；阶段 5 接入后昵称改为从会话读取，
 * 这里只需删掉昵称输入框，其余逻辑不变。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import type { FriendLink, GuestbookEntry } from '@/types'
import { getFriendLinks, getGuestbook, postGuestbook } from '@/api'
import { avatarImage } from '@/utils/cover'
import { formatDate, timeAgo } from '@/utils'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

/** 与 mock / 服务端保持一致的字数上限 */
const MAX_LENGTH = 500

/* ---------------- 友链 ---------------- */

const linksLoading = ref(true)
const links = ref<FriendLink[]>([])

/** 按分组归类，保持数据原有顺序 */
const groups = computed<[string, FriendLink[]][]>(() => {
  const map = new Map<string, FriendLink[]>()
  for (const l of links.value) {
    const arr = map.get(l.groupName)
    if (arr) arr.push(l)
    else map.set(l.groupName, [l])
  }
  return [...map.entries()]
})

/** 头像兜底：用站点地址（比名称更稳定）作为 seed */
function avatarSrc(l: FriendLink): string {
  if (l.avatar) return l.avatar
  return avatarImage(l.url || l.name, (l.name || '友').slice(0, 1))
}

/** 去掉协议前缀，展示更干净的域名 */
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/* ---------------- 留言板 ---------------- */

const gbLoading = ref(true)
const entries = ref<GuestbookEntry[]>([])
const nickname = ref('')
const content = ref('')
const submitting = ref(false)
const feedback = ref('')
const feedbackType = ref<'ok' | 'error'>('ok')
const textareaEl = ref<HTMLTextAreaElement | null>(null)

const remaining = computed(() => MAX_LENGTH - content.value.length)
const canSubmit = computed(() => content.value.trim().length > 0 && !submitting.value)

function setFeedback(text: string, type: 'ok' | 'error' = 'ok') {
  feedback.value = text
  feedbackType.value = type
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  setFeedback('')
  try {
    const created = await postGuestbook({
      nickname: nickname.value,
      content: content.value,
    })
    entries.value.unshift(created)
    content.value = ''
    setFeedback('发布成功，已显示在列表最上方。')
  } catch (e) {
    setFeedback(e instanceof Error ? e.message : '发布失败，请稍后重试。', 'error')
  } finally {
    submitting.value = false
  }
}

/** 一键填入友链申请格式，并聚焦到输入框 */
async function fillApplyTemplate() {
  const template = ['名称：', '链接：https://', '介绍：', '头像：'].join('\n')
  content.value = template
  setFeedback('已填入格式模板，补全后直接发布即可。')
  await nextTick()
  const el = textareaEl.value
  if (el) {
    el.focus()
    // 光标放到「名称：」后面，方便直接输入
    el.setSelectionRange(3, 3)
  }
}

function entryAvatar(e: GuestbookEntry): string {
  return avatarImage(e.nickname || 'guest', (e.nickname || '访').slice(0, 1), 96)
}

onMounted(async () => {
  // 两个请求互不依赖，并发拉取；任一失败不影响另一块
  const [linkRes, gbRes] = await Promise.allSettled([getFriendLinks(), getGuestbook()])
  if (linkRes.status === 'fulfilled') links.value = linkRes.value
  linksLoading.value = false
  if (gbRes.status === 'fulfilled') entries.value = gbRes.value
  gbLoading.value = false
})
</script>

<template>
  <div class="links container">
    <!-- ============ ① 页头 ============ -->
    <header class="page-head">
      <p class="page-head__kicker">Friends &amp; Links</p>
      <h1 class="page-head__title">友情链接</h1>
      <p class="page-head__sub">遇见有趣的灵魂，记录值得一去的地方。</p>
      <p v-if="!linksLoading" class="page-head__count meta">
        共收录 {{ links.length }} 位朋友的站点
      </p>
      <hr class="grad-rule" />
    </header>

    <!-- ============ ② 友链网格 ============ -->
    <div v-if="linksLoading" class="grid">
      <SkeletonBlock v-for="i in 4" :key="i" variant="text" :lines="2" />
    </div>

    <template v-else-if="links.length">
      <section v-for="[name, items] in groups" :key="name" class="group">
        <div class="group__head">
          <h2 class="group__name">{{ name }}</h2>
          <span class="group__count meta">{{ items.length }} 个站点</span>
        </div>

        <div class="grid">
          <a
            v-for="l in items"
            :key="l.id"
            :href="l.url"
            class="friend glass-card glass-pad"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="friend__avatar">
              <img
                :src="avatarSrc(l)"
                :alt="l.name"
                loading="lazy"
                decoding="async"
                width="52"
                height="52"
              />
            </span>
            <span class="friend__body">
              <span class="friend__name clamp-1">{{ l.name }}</span>
              <span class="friend__url clamp-1 mono">{{ prettyUrl(l.url) }}</span>
              <span v-if="l.description" class="friend__desc clamp-2">{{ l.description }}</span>
            </span>
          </a>
        </div>
      </section>
    </template>

    <EmptyState v-else title="还没有友链" description="后台添加后会出现在这里。" />

    <!-- ============ ③ 申请友链 ============ -->
    <section class="apply glass-card glass-pad">
      <div class="apply__head">
        <h2 class="apply__title">申请友链</h2>
      </div>
      <p class="apply__lead">
        在下方「留言板」按以下格式留言，或通过联系方式告知我，收到后会添加。
      </p>

      <ul class="rules">
        <li>站点可正常访问，内容原创、长期更新</li>
        <li>不接受纯采集 / 营销 / 违规内容站点</li>
        <li>贵站添加本站后，留言告知即可互链</li>
      </ul>

      <ol class="steps">
        <li class="step">
          <span class="step__no mono">1</span>
          <span class="step__label">名称</span>
          <span class="step__hint">你的站点 / 昵称</span>
        </li>
        <li class="step">
          <span class="step__no mono">2</span>
          <span class="step__label">链接</span>
          <span class="step__hint">完整的博客 URL（带 https://）</span>
        </li>
        <li class="step">
          <span class="step__no mono">3</span>
          <span class="step__label">介绍</span>
          <span class="step__hint">一句话描述你的站点 / 方向</span>
        </li>
        <li class="step">
          <span class="step__no mono">4</span>
          <span class="step__label">头像</span>
          <span class="step__hint">方形 Logo / 头像图片 URL（可选）</span>
        </li>
      </ol>

      <button class="btn btn--sm" type="button" @click="fillApplyTemplate">
        填入格式模板
      </button>
    </section>

    <!-- ============ ④ 留言板 ============ -->
    <section class="guestbook glass-card glass-pad">
      <div class="gb__head">
        <h2 class="gb__title">留言板</h2>
        <span v-if="!gbLoading" class="gb__count meta">{{ entries.length }} 条</span>
      </div>

      <p class="gb__hint">
        最多 {{ MAX_LENGTH }} 字，也可在这里提出友链申请。
        <span class="gb__hint-note">（GitHub 登录将在后续阶段接入，当前先填写昵称）</span>
      </p>

      <form class="gb__form" @submit.prevent="submit">
        <input
          v-model="nickname"
          class="gb__nickname"
          type="text"
          maxlength="24"
          placeholder="你的昵称（可留空，默认匿名）"
          aria-label="你的昵称"
          autocomplete="nickname"
        />

        <textarea
          ref="textareaEl"
          v-model="content"
          class="gb__content"
          :maxlength="MAX_LENGTH"
          rows="4"
          placeholder="说点什么…"
          aria-label="留言内容"
        />

        <div class="gb__foot">
          <span class="gb__counter mono" :class="{ 'is-low': remaining <= 50 }">
            {{ content.length }} / {{ MAX_LENGTH }}
          </span>
          <button class="btn btn--primary" type="submit" :disabled="!canSubmit">
            {{ submitting ? '发布中…' : '发布' }}
          </button>
        </div>
      </form>

      <p
        v-if="feedback"
        class="gb__feedback"
        :class="`gb__feedback--${feedbackType}`"
        role="status"
        aria-live="polite"
      >
        {{ feedback }}
      </p>

      <div v-if="gbLoading" class="gb__list">
        <SkeletonBlock v-for="i in 2" :key="i" variant="text" :lines="2" />
      </div>

      <ul v-else-if="entries.length" class="gb__list">
        <li v-for="e in entries" :key="e.id" class="entry">
          <img
            class="entry__avatar"
            :src="entryAvatar(e)"
            :alt="e.nickname"
            width="40"
            height="40"
            loading="lazy"
            decoding="async"
          />
          <div class="entry__body">
            <div class="entry__head">
              <span class="entry__name">{{ e.nickname }}</span>
              <time class="entry__time meta" :datetime="e.createdAt" :title="formatDate(e.createdAt)">
                {{ timeAgo(e.createdAt) }}
              </time>
              <span v-if="e.isFriendLinkApply" class="entry__tag">友链申请</span>
            </div>
            <p class="entry__content">{{ e.content }}</p>
            <div v-if="e.reply" class="entry__reply">
              <span class="entry__reply-label">站长回复</span>
              <p class="entry__reply-text">{{ e.reply }}</p>
            </div>
          </div>
        </li>
      </ul>

      <EmptyState
        v-else
        title="还没有留言"
        description="成为第一个留言的人吧。"
      />
    </section>
  </div>
</template>

<style scoped>
.links {
  padding-top: var(--sp-6);
  max-width: 1000px;
}

/* ---------- ① 页头 ---------- */
.page-head {
  margin-bottom: var(--sp-6);
}
.page-head__kicker {
  font-size: var(--fs-xs);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--c-ink-4);
  margin-bottom: var(--sp-2);
}
.page-head__title {
  font-size: var(--fs-3xl);
  font-weight: 800;
}
.page-head__sub {
  margin-top: var(--sp-3);
  font-size: var(--fs-md);
  color: var(--c-ink-2);
}
.page-head__count {
  margin-top: var(--sp-2);
}

/* ---------- ② 友链网格 ---------- */
.group + .group {
  margin-top: var(--sp-6);
}
.group__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}
.group__name {
  font-size: var(--fs-base);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.group__name::before {
  content: '';
  width: 3px;
  height: 1em;
  border-radius: var(--radius-full);
  background: var(--grad-brand-no);
}
.group__count {
  flex-shrink: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--sp-4);
}

.friend {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  min-width: 0;
}
.friend__avatar {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--c-code-bg);
  border: 1px solid var(--c-line);
}
.friend__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.friend__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.friend__name {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--c-ink);
  transition: color var(--dur-fast) var(--ease);
}
.friend:hover .friend__name {
  color: var(--c-gold);
}
.friend__url {
  font-size: var(--fs-xs);
  color: var(--c-gold);
  opacity: 0.85;
}
.friend__desc {
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-ink-3);
}

/* ---------- ③ 申请友链 ---------- */
.apply {
  margin-top: var(--sp-7);
}
.apply__head {
  margin-bottom: var(--sp-3);
}
.apply__title {
  font-size: var(--fs-lg);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.apply__title::before {
  content: '';
  width: 3px;
  height: 1em;
  border-radius: var(--radius-full);
  background: var(--grad-brand-no);
}
.apply__lead {
  font-size: var(--fs-sm);
  line-height: 1.85;
  color: var(--c-ink-2);
}

.rules {
  margin: var(--sp-4) 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.rules li {
  position: relative;
  padding-left: var(--sp-5);
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-3);
}
.rules li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-gold);
}

.steps {
  margin: var(--sp-5) 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
}
.step {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
  min-width: 0;
}
.step__no {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--c-gold-soft);
  color: var(--c-gold);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.step__label {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink);
  flex-shrink: 0;
}
.step__hint {
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- ④ 留言板 ---------- */
.guestbook {
  margin-top: var(--sp-5);
}
.gb__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}
.gb__title {
  font-size: var(--fs-lg);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.gb__title::before {
  content: '';
  width: 3px;
  height: 1em;
  border-radius: var(--radius-full);
  background: var(--grad-brand-no);
}
.gb__count {
  flex-shrink: 0;
}
.gb__hint {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-3);
  margin-bottom: var(--sp-4);
}
.gb__hint-note {
  color: var(--c-ink-4);
}

.gb__form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.gb__nickname,
.gb__content {
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  line-height: 1.7;
  outline: none;
  transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}
.gb__nickname:focus,
.gb__content:focus {
  border-color: var(--c-gold);
  background: var(--glass-bg-hover);
}
.gb__content {
  resize: vertical;
  min-height: 96px;
  font-family: inherit;
}
.gb__nickname::placeholder,
.gb__content::placeholder {
  color: var(--c-ink-4);
}

.gb__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.gb__counter {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
.gb__counter.is-low {
  color: var(--c-gold);
}

.gb__feedback {
  margin-top: var(--sp-3);
  font-size: var(--fs-xs);
  line-height: 1.7;
}
.gb__feedback--ok {
  color: var(--c-gold);
}
.gb__feedback--error {
  color: var(--c-pink);
}

.gb__list {
  list-style: none;
  margin: var(--sp-5) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.entry {
  display: flex;
  gap: var(--sp-3);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-line);
}
.entry:first-child {
  padding-top: 0;
  border-top: none;
}
.entry__avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  border: 1px solid var(--c-line);
  background: var(--c-code-bg);
  object-fit: cover;
}
.entry__body {
  min-width: 0;
  flex: 1;
}
.entry__head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.entry__name {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink);
}
.entry__tag {
  font-size: var(--fs-xs);
  padding: 0.1em 0.55em;
  border-radius: var(--radius-full);
  background: var(--c-gold-soft);
  color: var(--c-gold);
  border: 1px solid var(--c-line);
}
.entry__content {
  margin-top: var(--sp-2);
  font-size: var(--fs-sm);
  line-height: 1.85;
  color: var(--c-ink-2);
  /* 保留用户输入的换行（友链申请是多行格式） */
  white-space: pre-wrap;
  word-break: break-word;
}
.entry__reply {
  margin-top: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-left: 2px solid var(--c-gold);
  border-radius: 0 var(--radius) var(--radius) 0;
  background: var(--glass-bg);
}
.entry__reply-label {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-gold);
}
.entry__reply-text {
  margin-top: var(--sp-1);
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-2);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
  .grid,
  .steps {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
