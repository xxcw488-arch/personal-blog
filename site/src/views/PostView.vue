<script setup lang="ts">
/**
 * 文章详情（对齐参考站 /article/:slug）
 * 玻璃卡片承载正文，**主体居中**（无侧栏目录）；底部上下篇与相关文章。
 * 顶部是「返回」按钮：优先回到来路，没有历史时退回文章列表。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Post } from '@/types'
import { getAdjacentPosts, getPost, getRelatedPosts } from '@/api'
import { renderContent } from '@/utils/markdown'
import { compactNumber, formatDate, timeAgo } from '@/utils'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'
import CommentSection from '@/components/CommentSection.vue'

const props = defineProps<{ slug: string }>()

const router = useRouter()

const loading = ref(true)
const notFound = ref(false)
const post = ref<Post | null>(null)
const prev = ref<Post | null>(null)
const next = ref<Post | null>(null)
const related = ref<Post[]>([])

/** 渲染后的正文 HTML（已消毒） */
const html = computed(() =>
  post.value ? renderContent(post.value.content, post.value.contentFormat) : '',
)

/**
 * 返回：优先回浏览器来路（从首页点进来就回首页，从列表进来就回列表）。
 * 直接用 router.back() 有个坑：用户是从外部链接直接打开这篇文章时，
 * 历史里没有本站的上一页，back() 会把人送出站。
 * 所以先看 history.length，太短就直接去文章列表兜底。
 */
function goBack(): void {
  if (window.history.length > 1) router.back()
  else void router.push('/article')
}

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    /* 忽略 */
  }
}

async function load(slug: string) {
  loading.value = true
  notFound.value = false
  post.value = null
  related.value = []
  prev.value = null
  next.value = null

  try {
    const p = await getPost(slug)
    post.value = p

    const [adj, rel] = await Promise.allSettled([
      getAdjacentPosts(slug),
      getRelatedPosts(slug, 3),
    ])
    if (adj.status === 'fulfilled') {
      prev.value = adj.value.prev
      next.value = adj.value.next
    }
    if (rel.status === 'fulfilled') related.value = rel.value
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => void load(props.slug))
watch(
  () => props.slug,
  (s) => void load(s),
)
</script>

<template>
  <div class="post-page container">
    <div v-if="loading" class="loading">
      <SkeletonBlock variant="feature" />
      <SkeletonBlock variant="text" :lines="8" />
    </div>

    <EmptyState
      v-else-if="notFound || !post"
      title="找不到这篇文章"
      description="它可能已被删除，或者链接输入有误。"
    >
      <RouterLink to="/article" class="btn" style="margin-top: var(--sp-4)">
        回到文章列表
      </RouterLink>
    </EmptyState>

    <template v-else>
      <article class="glass-card glass-card--lg article">
        <header class="article__head">
          <!-- 返回：替代原来的分类胶囊。分类信息移到下面的 meta 行，不丢 -->
          <button class="btn btn--sm article__back" type="button" @click="goBack">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回
          </button>

          <h1 class="article__title">{{ post.title }}</h1>

          <div class="article__meta meta">
            <RouterLink
              v-if="post.category"
              :to="`/article?category=${post.category.slug}`"
              class="chip"
            >
              {{ post.category.name }}
            </RouterLink>
            <span v-if="post.category" class="meta__sep">·</span>
            <span>{{ formatDate(post.publishedAt) }}</span>
            <span class="meta__sep">·</span>
            <span>{{ post.readingTime }} 分钟阅读</span>
            <span class="meta__sep">·</span>
            <span>{{ compactNumber(post.views) }} 次阅读</span>
            <template v-if="post.updatedAt !== post.publishedAt">
              <span class="meta__sep">·</span>
              <span>{{ timeAgo(post.updatedAt) }}更新</span>
            </template>
          </div>

          <p v-if="post.excerpt" class="article__lede">{{ post.excerpt }}</p>
        </header>

        <figure v-if="post.cover" class="article__cover">
          <img :src="post.cover" :alt="post.title" loading="eager" decoding="async" />
          <figcaption v-if="post.coverCaption">{{ post.coverCaption }}</figcaption>
        </figure>

        <div class="prose" v-html="html" />

        <footer class="article__foot">
          <div v-if="post.tags.length" class="article__tags">
            <RouterLink
              v-for="t in post.tags"
              :key="t.slug"
              :to="`/article?tag=${t.slug}`"
              class="tag-pill"
            >
              {{ t.name }}
            </RouterLink>
          </div>
          <button class="btn btn--sm article__copy" @click="copyLink">
            {{ copied ? '已复制链接' : '复制链接' }}
          </button>
        </footer>
      </article>

      <!-- 上下篇 -->
      <nav v-if="prev || next" class="adjacent" aria-label="相邻文章">
        <RouterLink
          v-if="prev"
          :to="`/article/${prev.slug}`"
          class="adjacent__item glass-card glass-card--hover"
        >
          <span class="adjacent__label meta">← 上一篇</span>
          <span class="adjacent__title clamp-1">{{ prev.title }}</span>
        </RouterLink>
        <span v-else class="adjacent__item adjacent__item--empty" />
        <RouterLink
          v-if="next"
          :to="`/article/${next.slug}`"
          class="adjacent__item adjacent__item--next glass-card glass-card--hover"
        >
          <span class="adjacent__label meta">下一篇 →</span>
          <span class="adjacent__title clamp-1">{{ next.title }}</span>
        </RouterLink>
      </nav>

      <!-- 相关文章 -->
      <section v-if="related.length" class="related">
        <div class="section-head">
          <h2 class="section-head__title">相关文章</h2>
        </div>
        <div class="related__grid">
          <RouterLink
            v-for="r in related"
            :key="r.slug"
            :to="`/article/${r.slug}`"
            class="related__item glass-card glass-card--hover glass-pad"
          >
            <h3 class="related__title clamp-2">{{ r.title }}</h3>
            <p class="meta">{{ formatDate(r.publishedAt) }}</p>
          </RouterLink>
        </div>
      </section>

      <!-- 评论：后台可以把某篇文章的评论关掉（allowComment）——
           关掉后旧评论仍然显示，只是不再提供发表入口 -->
      <CommentSection
        target-type="post"
        :target-id="post.id"
        :allow-comment="post.allowComment"
      />
    </template>
  </div>
</template>

<style scoped>
/* 主体居中：整页收窄到易读宽度后水平居中。
   去掉侧栏目录后不再需要两栏栅格，正文卡片自己撑满这个居中容器。
   52rem ≈ 832px，扣掉卡片左右 padding 后正文约 75 字符/行，
   是长文比较舒服的阅读尺度。 */
.post-page {
  padding-top: var(--sp-6);
  max-width: 52rem;
  margin-inline: auto;
}
.loading {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

/* ---------- 正文卡片 ---------- */
.article {
  padding: var(--sp-7) var(--sp-7) var(--sp-6);
  min-width: 0;
}
/* 返回按钮：靠左、弱化处理（次要操作不该抢标题的注意力） */
.article__back {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
  color: var(--c-ink-3);
}
.article__back:hover {
  color: var(--c-ink);
}
.article__title {
  font-size: var(--fs-4xl);
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -0.02em;
  margin-bottom: var(--sp-3);
}
.article__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  padding-bottom: var(--sp-5);
  border-bottom: 1px solid var(--c-line);
}
.article__lede {
  margin-top: var(--sp-5);
  font-size: var(--fs-lg);
  line-height: 1.8;
  color: var(--c-ink-2);
  padding-left: var(--sp-4);
  border-left: 3px solid var(--c-gold);
}

.article__cover {
  margin: var(--sp-6) 0 0;
}
.article__cover img {
  width: 100%;
  border-radius: var(--radius-lg);
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: 1px solid var(--c-line);
}
.article__cover figcaption {
  margin-top: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
  text-align: center;
}

.prose {
  margin-top: var(--sp-6);
}

.article__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
  margin-top: var(--sp-7);
  padding-top: var(--sp-5);
  border-top: 1px solid var(--c-line);
}
.article__tags {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
/* 没有标签时（v-if 让标签区整个不渲染），按钮要自己靠右 ——
   否则它作为唯一子元素会被 space-between 推到左边 */
.article__copy {
  margin-left: auto;
}

/* ---------- 上下篇 ---------- */
.adjacent {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
  margin-top: var(--sp-6);
}
.adjacent__item {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4);
  min-width: 0;
}
.adjacent__item--next {
  text-align: right;
}
.adjacent__item--empty {
  border: none;
  background: none;
  box-shadow: none;
}
.adjacent__title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink);
}

/* ---------- 相关文章 ---------- */
.related {
  margin-top: var(--sp-7);
}
.related__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-4);
}
.related__title {
  font-size: var(--fs-base);
  line-height: 1.5;
  margin-bottom: var(--sp-2);
  color: var(--c-ink);
}
.related__item:hover .related__title {
  color: var(--c-gold);
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .article {
    padding: var(--sp-5) var(--sp-4);
  }
  .article__title {
    font-size: var(--fs-2xl);
  }
  .article__lede {
    font-size: var(--fs-md);
  }
  .adjacent,
  .related__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .adjacent__item--next {
    text-align: left;
  }
}
</style>
