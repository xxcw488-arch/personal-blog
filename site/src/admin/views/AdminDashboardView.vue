<script setup lang="ts">
/**
 * 后台概览
 * ------------------------------------------------------------
 * 只做两件事：① 各内容类型的数量 ② 需要处理的待办（待审友链 / 待审评论）。
 * 计数是客户端按列表长度算的 —— 个人博客的数据量下这样最简单，
 * 不值得为它加一个专门的统计接口。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminCrud } from '@/admin/api'
import { ADMIN_NAV } from '@/admin/resources'

const router = useRouter()

interface Row {
  id: number
  status?: string
}

const loading = ref(true)
const error = ref('')
const counts = ref<Record<string, number>>({})
const pendingLinks = ref(0)
const pendingComments = ref(0)
const pendingGuestbook = ref(0)

const stats = computed(() =>
  ADMIN_NAV.map((n) => ({ ...n, count: counts.value[n.key] ?? 0 })),
)

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const keys = ADMIN_NAV.map((n) => n.key)
    const results = await Promise.allSettled(
      keys.map((k) => adminCrud.list<Row>(k, { limit: 200 })),
    )

    const next: Record<string, number> = {}
    results.forEach((r, i) => {
      const key = keys[i] ?? ''
      if (r.status === 'fulfilled') {
        next[key] = r.value.items.length
        if (key === 'links') {
          pendingLinks.value = r.value.items.filter((x) => x.status === 'pending').length
        }
        if (key === 'comments') {
          pendingComments.value = r.value.items.filter((x) => x.status === 'pending').length
        }
        if (key === 'guestbook') {
          pendingGuestbook.value = r.value.items.filter((x) => x.status === 'pending').length
        }
      } else {
        next[key] = 0
      }
    })
    counts.value = next
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

const todos = computed(() => [
  { label: '待审核友链', count: pendingLinks.value, to: 'links' },
  { label: '待审核评论', count: pendingComments.value, to: 'comments' },
  { label: '待审核留言', count: pendingGuestbook.value, to: 'guestbook' },
])

const hasTodo = computed(() => todos.value.some((t) => t.count > 0))

/** 「写新文章」= 跳到文章列表并让编辑抽屉自动打开 */
function openNewPost() {
  void router.push({
    name: 'admin-resource',
    params: { resource: 'posts' },
    query: { new: '1' },
  })
}
</script>

<template>
  <div class="dash">
    <p v-if="error" class="dash__error" role="alert">{{ error }}</p>

    <!-- 待办 -->
    <section class="dash__block">
      <h2 class="dash__h">待处理</h2>
      <p v-if="loading" class="dash__muted">加载中…</p>
      <p v-else-if="!hasTodo" class="dash__muted">没有待处理事项 🎉</p>
      <div v-else class="dash__todos">
        <RouterLink
          v-for="t in todos.filter((x) => x.count > 0)"
          :key="t.to"
          class="todo"
          :to="{ name: 'admin-resource', params: { resource: t.to } }"
        >
          <span class="todo__count">{{ t.count }}</span>
          <span class="todo__label">{{ t.label }}</span>
        </RouterLink>
      </div>
    </section>

    <!-- 数量统计 -->
    <section class="dash__block">
      <h2 class="dash__h">内容数量</h2>
      <div class="grid">
        <RouterLink
          v-for="s in stats"
          :key="s.key"
          class="card"
          :to="{ name: 'admin-resource', params: { resource: s.key } }"
        >
          <span class="card__num">{{ loading ? '—' : s.count }}</span>
          <span class="card__label">{{ s.label }}</span>
        </RouterLink>
      </div>
    </section>

    <!-- 快捷入口 -->
    <section class="dash__block">
      <h2 class="dash__h">快捷操作</h2>
      <div class="quick">
        <button class="adm-btn adm-btn--primary" type="button" @click="openNewPost">
          写新文章
        </button>
        <RouterLink class="adm-btn" :to="{ name: 'admin-settings' }">站点设置</RouterLink>
        <RouterLink class="adm-btn" :to="{ name: 'home' }">查看站点</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}
.dash__error {
  color: var(--c-pink);
  font-size: var(--fs-sm);
}
.dash__block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.dash__h {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--c-ink);
}
.dash__muted {
  font-size: var(--fs-sm);
  color: var(--c-ink-4);
}

.dash__todos {
  display: flex;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.todo {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-lg);
  background: var(--c-bg);
  transition: border-color var(--dur-fast) var(--ease);
}
.todo:hover {
  border-color: var(--c-gold);
}
.todo__count {
  font-size: var(--fs-2xl);
  font-weight: 800;
  color: var(--c-gold);
  font-family: var(--font-mono);
  line-height: 1;
}
.todo__label {
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--sp-3);
}
.card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-4);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-lg);
  background: var(--c-bg);
  transition: border-color var(--dur-fast) var(--ease);
}
.card:hover {
  border-color: var(--c-gold);
}
.card__num {
  font-size: var(--fs-2xl);
  font-weight: 800;
  color: var(--c-ink);
  font-family: var(--font-mono);
  line-height: 1.1;
}
.card__label {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

.quick {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
</style>
