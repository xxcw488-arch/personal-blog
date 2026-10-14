<script setup lang="ts">
/**
 * 项目（对齐参考站 /projects）
 * 页头 + 自适应玻璃卡片网格；状态徽章、技术栈胶囊、源码 / 演示按钮。
 */
import { computed, onMounted, ref } from 'vue'
import type { Project } from '@/types'
import { getProjects } from '@/api'
import { coverImage } from '@/utils/cover'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import EmptyState from '@/components/EmptyState.vue'

const loading = ref(true)
const projects = ref<Project[]>([])

/** 状态徽章文案 */
const STATUS_LABEL: Record<Project['status'], string> = {
  active: '维护中',
  wip: '开发中',
  archived: '已归档',
}

const brokenCovers = ref<Set<number>>(new Set())

function coverFor(p: Project): string {
  if (p.cover && !brokenCovers.value.has(p.id)) return p.cover
  return coverImage(p.name, 1200, 675)
}

function onCoverError(id: number) {
  const next = new Set(brokenCovers.value)
  next.add(id)
  brokenCovers.value = next
}

const total = computed(() => projects.value.length)

onMounted(async () => {
  try {
    projects.value = await getProjects()
  } catch {
    projects.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="projects container">
    <!-- 页头 -->
    <header class="page-head">
      <h1 class="page-head__title">项目</h1>
      <p class="page-head__sub">共 {{ total }} 个，有些还在维护，有些已经归档。</p>
      <hr class="grad-rule" />
    </header>

    <div v-if="loading" class="grid">
      <SkeletonBlock v-for="i in 2" :key="i" variant="feature" />
    </div>

    <div v-else-if="projects.length" class="grid">
      <article
        v-for="(p, i) in projects"
        :key="p.id"
        class="project glass-card glass-card--hover glass-card--lg"
        v-reveal="i * 60"
      >
        <div class="project__media">
          <img
            :src="coverFor(p)"
            :alt="p.name"
            loading="lazy"
            decoding="async"
            @error="onCoverError(p.id)"
          />
        </div>

        <div class="project__body">
          <div class="project__head">
            <h2 class="project__name clamp-1">{{ p.name }}</h2>
            <span class="project__status" :class="`project__status--${p.status}`">
              <i class="project__dot" aria-hidden="true" />
              {{ STATUS_LABEL[p.status] }}
            </span>
          </div>

          <p v-if="p.description" class="project__desc clamp-2">{{ p.description }}</p>

          <div v-if="p.techStack.length" class="project__tech">
            <span v-for="t in p.techStack" :key="t" class="tag-pill">{{ t }}</span>
          </div>

          <div v-if="p.repoUrl || p.demoUrl" class="project__links">
            <a
              v-if="p.repoUrl"
              :href="p.repoUrl"
              class="btn btn--sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
              </svg>
              源码
            </a>
            <a
              v-if="p.demoUrl"
              :href="p.demoUrl"
              class="btn btn--sm btn--primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
              演示
            </a>
          </div>
        </div>
      </article>
    </div>

    <EmptyState v-else title="还没有项目" description="做过的东西，回头补上。" />
  </div>
</template>

<style scoped>
.projects {
  padding-top: var(--sp-6);
}

/* ---------- 页头 ---------- */
.page-head {
  margin-bottom: var(--sp-6);
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

/* ---------- 网格 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--sp-5);
}

/* ---------- 卡片 ---------- */
.project {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.project__media {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--c-bg-deep);
}
.project__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter var(--hover-dur) var(--ease);
}
/* 悬停只提亮封面，不缩放（全站统一：位移 / 边框 / 亮度，禁止缩放） */
.project:hover .project__media img {
  filter: brightness(1.08);
}

.project__body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  flex: 1;
}

.project__head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.project__name {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
  flex: 1;
  min-width: 0;
}

/* 状态徽章：彩色圆点 + 描边胶囊 */
.project__status {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  flex-shrink: 0;
  font-size: var(--fs-xs);
  padding: 0.2em 0.7em;
  border-radius: var(--radius-full);
  border: 1px solid var(--c-line);
  background: var(--glass-bg);
  color: var(--c-ink-3);
  white-space: nowrap;
}
.project__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.project__status--active {
  border-color: var(--c-gold);
  color: var(--c-gold);
  background: var(--c-gold-soft);
}
.project__status--wip {
  border-color: var(--c-cyan);
  color: var(--c-cyan);
  background: var(--glass-bg-strong);
}
.project__status--archived {
  color: var(--c-ink-4);
}

.project__desc {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-3);
  flex: 1;
}
.project__tech {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.project__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
  margin-top: var(--sp-1);
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
