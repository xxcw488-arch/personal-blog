<script setup lang="ts">
/**
 * 评论区
 * ============================================================
 * 身份用 GitHub OAuth（阶段 5）。三种状态：
 *   ① 未配置 OAuth  → 只显示一句「还没开启」，不显示登录按钮
 *   ② 未登录        → 显示登录引导
 *   ③ 已登录        → 显示发表框 + 退出
 *
 * 安全：评论内容一律用 `{{ }}` 插值渲染，**不用 v-html** ——
 * 评论是访客输入，绝不能当 HTML 解析。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Comment } from '@/types'
import { getComments, postComment } from '@/api'
import { useUserStore } from '@/stores/user'
import { avatarImage } from '@/utils/cover'
import { formatDate, timeAgo } from '@/utils'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const props = withDefaults(
  defineProps<{
    targetType: 'post' | 'moment'
    targetId: number
    /**
     * 站长是否允许评论（后台「允许评论」开关）。
     * 关掉之后：旧评论照样显示，但不再提供发表入口，后端也会拒收。
     */
    allowComment?: boolean
  }>(),
  { allowComment: true },
)

/** 与后端 MAX_LENGTH 保持一致 */
const MAX_LENGTH = 1000

const userStore = useUserStore()

const comments = ref<Comment[]>([])
const loading = ref(true)
const submitting = ref(false)
const content = ref('')
const replyTo = ref<Comment | null>(null)
const feedback = ref('')
const feedbackType = ref<'ok' | 'err'>('ok')
const textareaEl = ref<HTMLTextAreaElement | null>(null)

/** 顶层评论 + 一层回复拉平成一个列表，模板里就不用写两套标记了 */
const threads = computed(() => {
  const out: { comment: Comment; depth: number }[] = []
  for (const c of comments.value) {
    out.push({ comment: c, depth: 0 })
    for (const r of c.replies ?? []) out.push({ comment: r, depth: 1 })
  }
  return out
})

const total = computed(() => threads.value.length)
const remaining = computed(() => MAX_LENGTH - content.value.length)
const canSubmit = computed(() => content.value.trim().length > 0 && !submitting.value)

function avatarOf(c: Comment): string {
  if (c.userAvatar) return c.userAvatar
  const name = c.userName || c.userLogin || '读者'
  return avatarImage(c.userLogin || name, name.slice(0, 1), 96)
}

function profileUrl(c: Comment): string {
  return c.userLogin ? `https://github.com/${c.userLogin}` : ''
}

function setFeedback(type: 'ok' | 'err', text: string): void {
  feedbackType.value = type
  feedback.value = text
}

async function load(): Promise<void> {
  loading.value = true
  try {
    comments.value = await getComments(props.targetType, props.targetId)
  } catch {
    comments.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 处理 OAuth 回跳带来的 ?login=denied。
 * 处理完把参数从地址栏擦掉，避免用户刷新时又看到一次提示。
 */
function handleLoginFlag(): void {
  const params = new URLSearchParams(window.location.search)
  const flag = params.get('login')
  if (!flag) return
  if (flag === 'denied') setFeedback('err', '你取消了 GitHub 授权，登录没有完成。')
  params.delete('login')
  const qs = params.toString()
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
  )
}

onMounted(async () => {
  handleLoginFlag()
  await userStore.load()
  await load()
})

watch(
  () => props.targetId,
  () => void load(),
)

async function startReply(c: Comment): Promise<void> {
  replyTo.value = c
  await nextTick()
  textareaEl.value?.focus()
  textareaEl.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function cancelReply(): void {
  replyTo.value = null
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  submitting.value = true
  feedback.value = ''
  try {
    await postComment({
      targetType: props.targetType,
      targetId: props.targetId,
      parentId: replyTo.value?.id ?? 0,
      content: content.value.trim(),
    })
    content.value = ''
    replyTo.value = null
    setFeedback('ok', '发布成功')
    await load()
  } catch (e) {
    setFeedback('err', e instanceof Error ? e.message : '发布失败，请稍后再试')
  } finally {
    submitting.value = false
  }
}

async function logout(): Promise<void> {
  await userStore.logout()
  setFeedback('ok', '已退出登录')
}
</script>

<template>
  <section class="comments" aria-labelledby="comments-title">
    <div class="section-head">
      <h2 id="comments-title" class="section-head__title">评论</h2>
      <span v-if="total" class="comments__count">{{ total }}</span>
    </div>

    <!-- ① / ② / ③ 身份区 -->
    <div class="comments__auth glass-card glass-pad">
      <!-- 站长关掉了评论：不提供发表入口，旧评论仍然展示 -->
      <p v-if="!allowComment" class="meta comments__off">这篇的评论已关闭。</p>

      <template v-else-if="userStore.isLoggedIn && userStore.user">
        <img
          class="comments__avatar"
          :src="userStore.user.avatar || avatarImage(userStore.user.login, userStore.user.name.slice(0, 1), 96)"
          :alt="userStore.user.name"
          width="40"
          height="40"
          loading="lazy"
          decoding="async"
        />
        <div class="comments__who">
          <p class="comments__who-name">{{ userStore.user.name }}</p>
          <p class="meta">已用 GitHub 登录，可以发表评论</p>
        </div>
        <button class="btn btn--sm btn--ghost" type="button" @click="logout">退出</button>
      </template>

      <template v-else-if="userStore.githubEnabled">
        <div class="comments__who">
          <p class="comments__who-name">登录后参与讨论</p>
          <p class="meta">用 GitHub 账号登录即可，本站不会接触你的密码。</p>
        </div>
        <a class="btn btn--primary" :href="userStore.loginHref()">用 GitHub 登录</a>
      </template>

      <p v-else class="meta comments__off">
        评论还没开启：站长还没有配置 GitHub 登录。
      </p>
    </div>

    <!-- 发表框：登录后且评论没被关掉时才出现 -->
    <form
      v-if="userStore.isLoggedIn && allowComment"
      class="comments__form glass-card glass-pad"
      @submit.prevent="submit"
    >
      <p v-if="replyTo" class="comments__reply-to meta">
        正在回复 <strong>@{{ replyTo.userName }}</strong>
        <button class="comments__cancel" type="button" @click="cancelReply">取消</button>
      </p>

      <textarea
        ref="textareaEl"
        v-model="content"
        class="comments__input"
        :maxlength="MAX_LENGTH"
        rows="4"
        placeholder="说点什么…"
        aria-label="评论内容"
      />

      <div class="comments__foot">
        <span class="comments__counter mono" :class="{ 'is-low': remaining <= 50 }">
          {{ content.length }} / {{ MAX_LENGTH }}
        </span>
        <button class="btn btn--primary" type="submit" :disabled="!canSubmit">
          {{ submitting ? '发布中…' : '发布' }}
        </button>
      </div>
    </form>

    <p
      v-if="feedback"
      class="comments__feedback"
      :class="`comments__feedback--${feedbackType}`"
      role="status"
      aria-live="polite"
    >
      {{ feedback }}
    </p>

    <!-- 列表 -->
    <div v-if="loading" class="comments__skeleton">
      <SkeletonBlock v-for="i in 2" :key="i" variant="text" :lines="2" />
    </div>

    <p v-else-if="!threads.length" class="comments__empty meta">还没有评论，来说第一句吧。</p>

    <ul v-else class="comments__list">
      <li
        v-for="t in threads"
        :key="t.comment.id"
        class="comment"
        :class="{ 'comment--reply': t.depth > 0 }"
      >
        <img
          class="comment__avatar"
          :src="avatarOf(t.comment)"
          :alt="t.comment.userName"
          width="40"
          height="40"
          loading="lazy"
          decoding="async"
        />
        <div class="comment__body">
          <div class="comment__head">
            <a
              v-if="profileUrl(t.comment)"
              class="comment__name"
              :href="profileUrl(t.comment)"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {{ t.comment.userName }}
            </a>
            <span v-else class="comment__name">{{ t.comment.userName }}</span>
            <time
              class="comment__time meta"
              :datetime="t.comment.createdAt"
              :title="formatDate(t.comment.createdAt)"
            >
              {{ timeAgo(t.comment.createdAt) }}
            </time>
          </div>

          <p class="comment__text">{{ t.comment.content }}</p>

          <button
            v-if="userStore.isLoggedIn && allowComment"
            class="comment__reply"
            type="button"
            @click="startReply(t.comment)"
          >
            回复
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.comments {
  margin-top: var(--sp-8);
}

/* ---------- 标题右侧的条数 ---------- */
.comments__count {
  font-size: var(--fs-sm);
  color: var(--c-gold);
  background: var(--c-gold-soft);
  border-radius: var(--radius-full);
  padding: 0.1rem 0.5rem;
}

/* ---------- 身份区 ---------- */
.comments__auth {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  flex-wrap: wrap;
  margin-bottom: var(--sp-5);
}

.comments__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  object-fit: cover;
  flex-shrink: 0;
}

.comments__who {
  flex: 1;
  min-width: 12rem;
}

.comments__who-name {
  font-weight: 600;
}

.comments__off {
  margin: 0;
}

/* ---------- 发表框 ---------- */
.comments__form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}

.comments__reply-to {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.comments__cancel {
  color: var(--c-gold);
  font-size: var(--fs-sm);
  text-decoration: underline;
}

.comments__input {
  width: 100%;
  background: var(--glass-bg);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-4);
  color: var(--c-ink);
  resize: vertical;
  min-height: 5.5rem;
  transition: border-color var(--dur-fast) var(--ease);
}

.comments__input:focus {
  border-color: var(--c-gold);
}

.comments__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
}

.comments__counter {
  font-size: var(--fs-xs);
  color: var(--c-line);
}

.comments__counter.is-low {
  color: var(--c-gold);
}

/* ---------- 提示 ---------- */
.comments__feedback {
  margin-bottom: var(--sp-4);
  font-size: var(--fs-sm);
}

.comments__feedback--ok {
  color: var(--c-sage);
}

.comments__feedback--err {
  color: var(--c-rose);
}

/* ---------- 列表 ---------- */
.comments__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.comments__empty {
  padding: var(--sp-5) 0;
}

.comments__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.comment {
  display: flex;
  gap: var(--sp-3);
  min-width: 0;
}

/* 回复缩进 + 左侧细线，视觉上从属父评论 */
.comment--reply {
  margin-left: calc(var(--sp-3) + 40px);
  padding-left: var(--sp-4);
  border-left: 2px solid var(--c-line-soft);
}

.comment__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  object-fit: cover;
  flex-shrink: 0;
}

.comment__body {
  flex: 1;
  min-width: 0;
}

.comment__head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  flex-wrap: wrap;
}

.comment__name {
  font-weight: 600;
  font-size: var(--fs-sm);
}

.comment__time {
  font-size: var(--fs-xs);
}

/* 评论是纯文本：保留换行，长链接要能断行 */
.comment__text {
  margin: var(--sp-2) 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment__reply {
  margin-top: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-gold);
}

.comment__reply:hover {
  text-decoration: underline;
}
</style>
