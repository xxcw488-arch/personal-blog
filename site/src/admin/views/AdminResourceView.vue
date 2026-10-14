<script setup lang="ts">
/**
 * 通用资源管理页
 * ------------------------------------------------------------
 * 一份声明（src/admin/resources.ts）同时驱动「表格列」与「编辑表单」，
 * 所以 9 类内容不用写 9 个页面。特殊逻辑只有两处：
 *   · 留言板：含链接的留言可以「转成友链」
 *   · 评论/留言：不允许新建（由公开接口产生）
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminCrud, adminGuestbook, AdminApiError } from '@/admin/api'
import { ADMIN_RESOURCES, type AdminField, type AdminResourceDef } from '@/admin/resources'
import AdminFieldInput from '@/admin/components/AdminField.vue'

const route = useRoute()
const router = useRouter()

const resourceKey = computed(() => String(route.params.resource ?? ''))
const def = computed<AdminResourceDef | undefined>(() => ADMIN_RESOURCES[resourceKey.value])

const items = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref('')
const notice = ref('')

/** 列表列：声明里标了 inList 的字段 */
const columns = computed<AdminField[]>(
  () => def.value?.fields.filter((f) => f.inList) ?? [],
)

/* ============================================================
   加载列表
   ============================================================ */

async function load() {
  if (!def.value) return
  loading.value = true
  error.value = ''
  try {
    const [res] = await Promise.all([
      adminCrud.list(resourceKey.value, { limit: 200 }),
      loadTaxonomies(),
    ])
    items.value = res.items
  } catch (e) {
    error.value = e instanceof AdminApiError ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

/* ============================================================
   分类 / 标签的候选项
   ------------------------------------------------------------
   categoryId 和 tags 的可选项来自数据库，没法写死在字段声明里，
   所以在打开「文章」时把它们拉下来，临时替换掉字段的控件：
     · categoryId → select（下拉选分类）
     · tags       → multiselect（勾选标签）
   拉不到就退回字段原本的控件，页面不会因此打不开。
   ============================================================ */

const taxonomyOptions = ref<Record<string, { value: string; label: string }[]>>({})

async function loadTaxonomies(): Promise<void> {
  if (resourceKey.value !== 'posts') return
  try {
    const [cats, tags] = await Promise.all([
      adminCrud.list<{ id: number; name: string }>('categories', { limit: 200 }),
      adminCrud.list<{ id: number; name: string }>('tags', { limit: 200 }),
    ])
    taxonomyOptions.value = {
      categoryId: cats.items.map((c) => ({ value: String(c.id), label: c.name })),
      tags: tags.items.map((t) => ({ value: String(t.id), label: t.name })),
    }
  } catch {
    // 分类/标签接口挂了不该让文章列表打不开，退回原始控件即可
    taxonomyOptions.value = {}
  }
}

/** 把字段声明换成带真实候选项的版本 */
function fieldFor(f: AdminField): AdminField {
  const opts = taxonomyOptions.value[f.key]
  if (!opts) return f
  if (f.key === 'categoryId') return { ...f, widget: 'select', options: opts }
  if (f.key === 'tags') return { ...f, widget: 'multiselect', options: opts }
  return f
}

/** 表单里实际渲染的字段（已注入候选项） */
const formFields = computed<AdminField[]>(() => (def.value?.fields ?? []).map(fieldFor))

watch(resourceKey, () => {
  editing.value = null
  notice.value = ''
  void load().then(maybeOpenCreate)
})

onMounted(async () => {
  await load()
  await maybeOpenCreate()
})

/**
 * 支持从别处带着 ?new=1 跳进来直接打开新建抽屉
 * （概览页的「写新文章」就是这么用的）。
 * 打开后把 query 清掉，否则刷新会又弹一次。
 */
async function maybeOpenCreate() {
  if (route.query.new !== '1') return
  if (def.value?.canCreate) openCreate()
  await router.replace({ name: 'admin-resource', params: { resource: resourceKey.value } })
}

/* ============================================================
   编辑表单
   ============================================================ */

interface EditingState {
  mode: 'create' | 'edit'
  id: number | null
  values: Record<string, unknown>
}

const editing = ref<EditingState | null>(null)
const saving = ref(false)
const formError = ref('')

/** 按 widget 给字段一个合理的空值；声明里写了 defaultValue 就优先用它 */
function emptyFor(f: AdminField): unknown {
  if (f.defaultValue !== undefined) return f.defaultValue
  switch (f.widget) {
    case 'switch':
      return false
    case 'number':
      return 0
    case 'tags':
    case 'images':
    case 'multiselect':
      return []
    case 'select':
      return f.options?.[0]?.value ?? ''
    default:
      return ''
  }
}

function emptyValues(d: AdminResourceDef): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of d.fields) {
    if (f.readonly) continue
    out[f.key] = emptyFor(f)
  }
  return out
}

function openCreate() {
  if (!def.value) return
  formError.value = ''
  editing.value = { mode: 'create', id: null, values: emptyValues(def.value) }
}

function openEdit(item: Record<string, unknown>) {
  if (!def.value) return
  formError.value = ''
  const values: Record<string, unknown> = {}
  for (const f of def.value.fields) {
    values[f.key] = item[f.key] ?? emptyFor(f)
  }
  editing.value = { mode: 'edit', id: Number(item.id), values }
}

function closeEditor() {
  editing.value = null
  formError.value = ''
}

/**
 * 判断一个字段值算不算「没填」。
 *
 * 为什么新建时要跳过空值：空字符串会被如实写进数据库，
 * 而 `published_at` 这种参与排序的列一旦变成 `''`，新内容会被排到最后 ——
 * 表现就是「后台发了文章，首页看不到」。跳过空值让数据库的 DEFAULT 生效。
 *
 * 注意 0 只对数字字段算「没填」：布尔 false 是有效值，不能当成空。
 */
function isEmptyValue(f: AdminField, v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (f.widget === 'number') return v === 0
  return false
}

async function save() {
  if (!editing.value || !def.value) return
  saving.value = true
  formError.value = ''
  try {
    const { mode, id, values } = editing.value
    const payload: Record<string, unknown> = {}
    for (const f of def.value.fields) {
      if (f.readonly) continue
      const v = values[f.key]
      // 新建时跳过空值，交给数据库默认值；编辑时如实提交（用户可能是想清空）
      if (mode === 'create' && isEmptyValue(f, v)) continue
      payload[f.key] = v
    }

    if (mode === 'create') {
      await adminCrud.create(resourceKey.value, payload)
      notice.value = `已创建${def.value.singular}`
    } else if (id !== null) {
      await adminCrud.update(resourceKey.value, id, payload)
      notice.value = `已保存${def.value.singular}`
    }
    closeEditor()
    await load()
  } catch (e) {
    formError.value = e instanceof AdminApiError ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

/* ============================================================
   删除
   ============================================================ */

const deletingId = ref<number | null>(null)

async function remove(item: Record<string, unknown>) {
  if (!def.value) return
  const id = Number(item.id)
  const label = String(item[def.value.titleField] ?? id)
  const tip = def.value.softDelete
    ? `确定删除「${label}」吗？（软删除，数据仍保留在数据库里）`
    : `确定删除「${label}」吗？此操作不可撤销。`
  if (!window.confirm(tip)) return

  deletingId.value = id
  try {
    await adminCrud.remove(resourceKey.value, id)
    notice.value = '已删除'
    await load()
  } catch (e) {
    error.value = e instanceof AdminApiError ? e.message : '删除失败'
  } finally {
    deletingId.value = null
  }
}

/* ============================================================
   留言 → 友链
   ============================================================ */

const convertingId = ref<number | null>(null)

/** 只有留言板、且内容含链接时才显示转换按钮 */
function canConvert(item: Record<string, unknown>): boolean {
  if (resourceKey.value !== 'guestbook') return false
  return /https?:\/\//i.test(String(item.content ?? ''))
}

async function convertToLink(item: Record<string, unknown>) {
  const id = Number(item.id)
  convertingId.value = id
  notice.value = ''
  try {
    const res = await adminGuestbook.toLink(id)
    const missing = Object.entries(res.parsed)
      .filter(([, ok]) => !ok)
      .map(([k]) => k)
    notice.value = missing.length
      ? `已转为待审友链，但以下字段没解析出来，请到「友链」里补全：${missing.join('、')}`
      : '已转为待审友链，去「友链」里审核通过即可显示'
  } catch (e) {
    error.value = e instanceof AdminApiError ? e.message : '转换失败'
  } finally {
    convertingId.value = null
  }
}

/* ============================================================
   展示
   ============================================================ */

/** 表格里怎么显示一个值 */
function display(field: AdminField, item: Record<string, unknown>): string {
  const v = item[field.key]
  if (v === null || v === undefined || v === '') return '—'
  if (field.widget === 'switch') return v ? '是' : '否'
  if (field.widget === 'select') {
    return field.options?.find((o) => o.value === String(v))?.label ?? String(v)
  }
  if (Array.isArray(v)) return v.length ? `${v.length} 项` : '—'
  const s = String(v)
  return s.length > 60 ? `${s.slice(0, 60)}…` : s
}

/** 状态类的值给个颜色，便于一眼扫出待审项 */
function statusClass(field: AdminField, item: Record<string, unknown>): string {
  if (field.widget !== 'select') return ''
  const v = String(item[field.key] ?? '')
  if (v === 'pending' || v === 'draft') return 'is-pending'
  if (v === 'approved' || v === 'published' || v === 'active') return 'is-ok'
  if (v === 'rejected' || v === 'spam' || v === 'archived') return 'is-bad'
  return ''
}

/* ---------- 抽屉：ESC 关闭 + 锁滚动 ---------- */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && editing.value) closeEditor()
}

watch(editing, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div v-if="!def" class="empty">
    <p>未知的资源：{{ resourceKey }}</p>
  </div>

  <div v-else class="res">
    <!-- 顶部操作条 -->
    <div class="res__bar">
      <p class="res__hint">{{ def.hint }}</p>
      <div class="res__actions">
        <button class="adm-btn adm-btn--sm" type="button" :disabled="loading" @click="load">
          刷新
        </button>
        <button
          v-if="def.canCreate"
          class="adm-btn adm-btn--primary adm-btn--sm"
          type="button"
          @click="openCreate"
        >
          新建{{ def.singular }}
        </button>
      </div>
    </div>

    <p v-if="notice" class="res__notice" role="status">{{ notice }}</p>
    <p v-if="error" class="res__error" role="alert">{{ error }}</p>

    <!-- 列表 -->
    <div v-if="loading" class="res__loading">加载中…</div>

    <div v-else-if="items.length === 0" class="res__empty">
      还没有{{ def.title }}数据
    </div>

    <div v-else class="res__tablewrap">
      <table class="res__table">
        <thead>
          <tr>
            <th class="res__th-id">ID</th>
            <th v-for="c in columns" :key="c.key">{{ c.label }}</th>
            <th class="res__th-act">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="String(item.id)">
            <td class="res__td-id">{{ item.id }}</td>
            <td v-for="c in columns" :key="c.key" :class="statusClass(c, item)">
              {{ display(c, item) }}
            </td>
            <td class="res__td-act">
              <button
                v-if="def.canEdit"
                class="adm-btn adm-btn--sm"
                type="button"
                @click="openEdit(item)"
              >
                {{ def.canCreate ? '编辑' : '处理' }}
              </button>
              <button
                v-if="canConvert(item)"
                class="adm-btn adm-btn--sm"
                type="button"
                :disabled="convertingId === Number(item.id)"
                @click="convertToLink(item)"
              >
                {{ convertingId === Number(item.id) ? '转换中…' : '转成友链' }}
              </button>
              <button
                class="adm-btn adm-btn--sm adm-btn--danger"
                type="button"
                :disabled="deletingId === Number(item.id)"
                @click="remove(item)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑抽屉 -->
    <div v-if="editing" class="drawer">
      <div class="drawer__scrim" @click="closeEditor" />
      <div class="drawer__panel" role="dialog" aria-modal="true">
        <header class="drawer__head">
          <h2 class="drawer__title">
            {{ editing.mode === 'create' ? `新建${def.singular}` : `编辑${def.singular}` }}
            <span v-if="editing.id !== null" class="drawer__id">#{{ editing.id }}</span>
          </h2>
          <button class="adm-btn adm-btn--sm" type="button" @click="closeEditor">关闭</button>
        </header>

        <div class="drawer__body">
          <div class="drawer__grid">
            <AdminFieldInput
              v-for="f in formFields"
              :key="f.key"
              :field="f"
              :model-value="editing.values[f.key]"
              :disabled="f.readonly"
              @update:model-value="(v) => { if (editing) editing.values[f.key] = v }"
            />
          </div>
        </div>

        <footer class="drawer__foot">
          <p v-if="formError" class="drawer__error" role="alert">{{ formError }}</p>
          <div class="drawer__foot-actions">
            <button class="adm-btn" type="button" @click="closeEditor">取消</button>
            <button
              class="adm-btn adm-btn--primary"
              type="button"
              :disabled="saving"
              @click="save"
            >
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.res {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.res__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.res__hint {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
  line-height: 1.7;
  max-width: 60em;
}
.res__actions {
  display: flex;
  gap: var(--sp-2);
}
.res__notice {
  font-size: var(--fs-sm);
  color: var(--c-gold);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--c-gold-soft);
}
.res__error {
  font-size: var(--fs-sm);
  color: var(--c-pink);
}
.res__loading,
.res__empty {
  padding: var(--sp-7);
  text-align: center;
  color: var(--c-ink-4);
  font-size: var(--fs-sm);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-lg);
  background: var(--c-bg);
}

.res__tablewrap {
  overflow-x: auto;
  border: 1px solid var(--c-line);
  border-radius: var(--radius-lg);
  background: var(--c-bg);
}
.res__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
  min-width: 720px;
}
.res__table th,
.res__table td {
  text-align: left;
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--c-line);
  vertical-align: top;
}
.res__table th {
  font-weight: 600;
  color: var(--c-ink-3);
  font-size: var(--fs-xs);
  white-space: nowrap;
  background: var(--c-bg-deep);
}
.res__table tbody tr:last-child td {
  border-bottom: none;
}
.res__table tbody tr:hover {
  background: var(--glass-bg);
}
.res__th-id,
.res__td-id {
  width: 56px;
  color: var(--c-ink-4);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.res__th-act,
.res__td-act {
  white-space: nowrap;
  width: 1%;
}
.res__td-act {
  display: flex;
  gap: var(--sp-2);
}

/* 状态着色 */
.res__table td.is-pending {
  color: var(--c-gold);
}
.res__table td.is-ok {
  color: var(--c-sage);
}
.res__table td.is-bad {
  color: var(--c-pink);
}

.empty {
  padding: var(--sp-7);
  text-align: center;
  color: var(--c-ink-4);
}

/* ---------- 抽屉 ---------- */
.drawer {
  position: fixed;
  inset: 0;
  z-index: 60;
}
.drawer__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
}
.drawer__panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: min(680px, 100vw);
  display: flex;
  flex-direction: column;
  background: var(--c-bg);
  border-left: 1px solid var(--c-line);
  box-shadow: var(--glass-shadow-lg);
}
.drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--c-line);
}
.drawer__title {
  font-size: var(--fs-lg);
  font-weight: 700;
}
.drawer__id {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
  margin-left: var(--sp-2);
}
.drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-5);
}
.drawer__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-5) var(--sp-4);
}
.drawer__foot {
  padding: var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--c-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.drawer__error {
  font-size: var(--fs-xs);
  color: var(--c-pink);
  flex: 1;
  min-width: 0;
}
.drawer__foot-actions {
  display: flex;
  gap: var(--sp-2);
}

@media (max-width: 640px) {
  .drawer__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
