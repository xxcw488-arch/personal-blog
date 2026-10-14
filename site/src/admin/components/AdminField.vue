<script setup lang="ts">
/**
 * 通用字段渲染器
 * ------------------------------------------------------------
 * 按声明里的 widget 渲染对应控件，并给媒体类字段附带「上传到 R2」按钮。
 * 上传按钮是这里最有价值的部分：不用离开后台、不用碰命令行就能传图。
 */
import { computed, ref } from 'vue'
import type { AdminField } from '@/admin/resources'
import { adminUpload } from '@/admin/api'

const props = withDefaults(
  defineProps<{
    field: AdminField
    modelValue: unknown
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const uploading = ref(false)
const uploadError = ref('')

/* ---------- 值 ↔ 字符串 ---------- */

/** tags / images 这类数组字段在界面上用「每行一项」的文本编辑 */
const asLines = computed(() => {
  const v = props.modelValue
  if (Array.isArray(v)) return v.join('\n')
  return typeof v === 'string' ? v : ''
})

function onLinesInput(e: Event) {
  const raw = (e.target as HTMLTextAreaElement).value
  const items = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  emit('update:modelValue', items)
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

/**
 * select 的取值。
 * 对配了 emptyAsNull 的字段（可空外键，如文章的 category_id），
 * 选「（未设置）」要提交 null —— 空字符串会被服务端转成数字 0，
 * 那就等于写进了一个不存在的分类 id。
 */
function onSelect(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  emit('update:modelValue', value === '' && props.field.emptyAsNull ? null : value)
}

/* ---------- 多选（文章标签） ---------- */

/** 当前选中的 id 集合（统一转成字符串比较，避免 number/string 混用） */
const selectedValues = computed(
  () => new Set((Array.isArray(props.modelValue) ? props.modelValue : []).map(String)),
)

function onToggleOption(value: string, e: Event): void {
  const checked = (e.target as HTMLInputElement).checked
  const current = new Set(selectedValues.value)
  if (checked) current.add(value)
  else current.delete(value)
  emit('update:modelValue', [...current].map(Number).filter((n) => Number.isFinite(n)))
}

function onNumber(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  emit('update:modelValue', raw === '' ? 0 : Number(raw))
}

function onSwitch(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}

/** 普通文本字段也可以按逗号切分成数组（给 tags 用） */
function onTextOrComma(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

/* ---------- 上传 ---------- */

/** 该字段是否是媒体 URL（决定要不要显示上传按钮） */
const isMediaField = computed(() =>
  ['cover', 'audio', 'avatar', 'url'].some((k) => props.field.key.toLowerCase().includes(k)),
)

/** 按字段语义选上传目录（服务端还会再做一次白名单校验） */
const uploadDir = computed(() => {
  const k = props.field.key.toLowerCase()
  if (k.includes('cover')) return 'covers'
  if (k.includes('audio')) return 'audio'
  if (k.includes('avatar')) return 'avatars'
  return 'photos'
})

const showUpload = computed(
  () => isMediaField.value && !props.disabled && !props.field.readonly,
)

async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  uploadError.value = ''
  try {
    const res = await adminUpload.file(file, uploadDir.value)
    if (props.field.widget === 'images') {
      const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
      current.push(res.url)
      emit('update:modelValue', current)
    } else {
      emit('update:modelValue', res.url)
    }
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    uploading.value = false
    input.value = '' // 允许重复选同一个文件
  }
}

/** 图片类字段给个缩略图预览，方便确认传对了 */
const previewUrl = computed(() => {
  if (!isMediaField.value) return ''
  const v = props.modelValue
  if (typeof v === 'string' && /^https?:\/\//.test(v)) return v
  return ''
})
</script>

<template>
  <div class="fld" :class="{ 'fld--wide': field.wide }">
    <label class="fld__label" :for="`f-${field.key}`">
      {{ field.label }}
      <span v-if="field.required" class="fld__req" aria-hidden="true">*</span>
    </label>

    <div class="fld__control">
      <!-- switch -->
      <label v-if="field.widget === 'switch'" class="fld__switch">
        <input
          :id="`f-${field.key}`"
          type="checkbox"
          :checked="Boolean(modelValue)"
          :disabled="disabled"
          @change="onSwitch"
        />
        <span>{{ modelValue ? '开启' : '关闭' }}</span>
      </label>

      <!-- select -->
      <select
        v-else-if="field.widget === 'select'"
        :id="`f-${field.key}`"
        class="fld__input"
        :value="modelValue === null || modelValue === undefined ? '' : String(modelValue)"
        :disabled="disabled"
        @change="onSelect"
      >
        <option value="">（未设置）</option>
        <option v-for="o in field.options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>

      <!-- multiselect：复选框列表，值是 id 数组（文章标签） -->
      <div v-else-if="field.widget === 'multiselect'" class="fld__multi">
        <label v-for="o in field.options" :key="o.value" class="fld__check">
          <input
            type="checkbox"
            :value="o.value"
            :checked="selectedValues.has(o.value)"
            :disabled="disabled"
            @change="onToggleOption(o.value, $event)"
          />
          <span>{{ o.label }}</span>
        </label>
        <p v-if="!field.options?.length" class="fld__help">
          还没有可选项 —— 先去左侧对应的管理页里添加。
        </p>
      </div>

      <!-- number -->
      <input
        v-else-if="field.widget === 'number'"
        :id="`f-${field.key}`"
        class="fld__input"
        type="number"
        :value="modelValue === null || modelValue === undefined ? '' : Number(modelValue)"
        :disabled="disabled || field.readonly"
        @input="onNumber"
      />

      <!-- tags / images：每行一项 -->
      <textarea
        v-else-if="field.widget === 'tags' || field.widget === 'images'"
        :id="`f-${field.key}`"
        class="fld__input fld__input--area"
        rows="3"
        :value="asLines"
        :disabled="disabled"
        placeholder="每行一个"
        @input="onLinesInput"
      />

      <!-- markdown / textarea -->
      <textarea
        v-else-if="field.widget === 'markdown' || field.widget === 'textarea'"
        :id="`f-${field.key}`"
        class="fld__input fld__input--area"
        :class="{ 'fld__input--mono': field.widget === 'markdown' }"
        :rows="field.widget === 'markdown' ? 16 : 3"
        :value="String(modelValue ?? '')"
        :disabled="disabled"
        :placeholder="field.placeholder"
        @input="onInput"
      />

      <!-- text / datetime -->
      <input
        v-else
        :id="`f-${field.key}`"
        class="fld__input"
        type="text"
        :value="String(modelValue ?? '')"
        :disabled="disabled || field.readonly"
        :placeholder="field.placeholder"
        @input="onTextOrComma"
      />

      <!-- 上传按钮 -->
      <div v-if="showUpload" class="fld__upload">
        <label class="adm-btn adm-btn--sm" :class="{ 'is-busy': uploading }">
          {{ uploading ? '上传中…' : '上传到 R2' }}
          <input type="file" accept="image/*,audio/*" hidden :disabled="uploading" @change="onPickFile" />
        </label>
      </div>
    </div>

    <!-- 缩略图预览 -->
    <img v-if="previewUrl" class="fld__preview" :src="previewUrl" alt="预览" loading="lazy" />

    <p v-if="field.help" class="fld__help">{{ field.help }}</p>
    <p v-if="uploadError" class="fld__err">{{ uploadError }}</p>
  </div>
</template>

<style scoped>
.fld {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 0;
}
.fld--wide {
  grid-column: 1 / -1;
}
.fld__label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink);
}
.fld__req {
  color: var(--c-pink);
  margin-left: 2px;
}
.fld__control {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
}
.fld__input {
  flex: 1;
  min-width: 0;
  padding: 0.5em 0.75em;
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  outline: none;
  transition: border-color var(--dur-fast) var(--ease);
}
.fld__input:focus {
  border-color: var(--c-gold);
}
.fld__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.fld__input--area {
  resize: vertical;
  line-height: 1.7;
  font-family: inherit;
}
.fld__input--mono {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.fld__switch {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
  cursor: pointer;
}
/* 多选：标签勾选列表 */
.fld__multi {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-4);
  padding: var(--sp-3);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
}
.fld__check {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
  cursor: pointer;
}
.fld__multi .fld__help {
  flex-basis: 100%;
}
.fld__upload {
  flex-shrink: 0;
}
.fld__upload .adm-btn.is-busy {
  opacity: 0.6;
  pointer-events: none;
}
.fld__preview {
  max-width: 200px;
  max-height: 120px;
  border-radius: var(--radius);
  border: 1px solid var(--c-line);
  object-fit: cover;
}
.fld__help {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
  line-height: 1.6;
}
.fld__err {
  font-size: var(--fs-xs);
  color: var(--c-pink);
}
</style>
