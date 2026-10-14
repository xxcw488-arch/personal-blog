<script setup lang="ts">
/**
 * ProjectsWidget —— 我的项目
 * ------------------------------------------------------------
 * 最多 3 行：状态点 + 项目名 + 单行简介。
 * 整个挂件都指向 /projects（没有项目详情路由，所以不假装有）。
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Project } from '@/types'

const props = defineProps<{
  projects: Project[]
}>()

const MAX_PROJECTS = 3

type ProjectStatus = Project['status']

interface ProjectRow {
  key: string
  name: string
  description: string
  status: ProjectStatus
  statusLabel: string
}

/** 状态 → 文案（与类型里的 active / archived / wip 一一对应） */
const STATUS_LABELS: Record<ProjectStatus, string> = {
  wip: '开发中',
  active: '维护中',
  archived: '已归档',
}

function statusLabel(status: ProjectStatus): string {
  return STATUS_LABELS[status] ?? '未知'
}

const rows = computed<ProjectRow[]>(() =>
  props.projects
    .filter((project) => project && project.name)
    .slice(0, MAX_PROJECTS)
    .map((project) => ({
      key: `${project.id}-${project.name}`,
      name: project.name,
      description: project.description || '暂无简介',
      status: project.status,
      statusLabel: statusLabel(project.status),
    })),
)
</script>

<template>
  <section class="projects glass-card glass-pad">
    <div class="widget-head">
      <h2 class="widget-head__title">我的项目</h2>
      <RouterLink class="widget-head__more" to="/projects">查看全部</RouterLink>
    </div>

    <ul v-if="rows.length" class="projects__list">
      <li v-for="row in rows" :key="row.key" class="projects__item">
        <RouterLink class="projects__link" to="/projects">
          <span class="projects__top">
            <span
              class="projects__dot"
              :class="`projects__dot--${row.status}`"
              aria-hidden="true"
            />
            <span class="projects__name clamp-1">{{ row.name }}</span>
          </span>
          <span class="projects__desc clamp-1">{{ row.description }}</span>
          <span class="meta projects__status">{{ row.statusLabel }}</span>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="projects__empty">暂无项目</p>
  </section>
</template>

<style scoped>
.projects__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.projects__link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius);
  border: 1px solid transparent;
  transition: background var(--hover-dur) var(--ease), border-color var(--hover-dur) var(--ease),
    filter var(--hover-dur) var(--ease);
}

/* 卡片内的列表行：同一套配色，但不做位移（见 AlbumWidget 同款说明） */
.projects__link:hover {
  background: var(--glass-bg-hover);
  border-color: var(--hover-border);
  filter: brightness(var(--hover-brightness));
  color: inherit;
}

.projects__top {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}

/* 状态点：形状一致，仅颜色区分；同时有文字标签，不只靠颜色传达信息 */
.projects__dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--c-ink-4);
}

.projects__dot--wip {
  background: var(--c-gold);
  box-shadow: 0 0 6px var(--c-gold-soft);
}

.projects__dot--active {
  background: var(--c-sage);
}

.projects__dot--archived {
  background: var(--c-ink-4);
}

.projects__name {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink);
}

.projects__link:hover .projects__name {
  color: var(--c-gold);
}

.projects__desc {
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-ink-3);
}

.projects__status {
  margin-top: 2px;
}

.projects__empty {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}
</style>
