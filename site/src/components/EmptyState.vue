<script setup lang="ts">
/**
 * EmptyState —— 空状态
 * ------------------------------------------------------------
 * 安静的玻璃卡片空态：标题 + 弱化说明 + 可选操作插槽。
 * 用于搜索无结果、列表为空、相册为空等场景。
 */
defineProps<{
  /** 主标题，例如「没有找到相关的文章」 */
  title: string
  /** 补充说明，可省略 */
  description?: string
}>()
</script>

<template>
  <div class="empty glass-card glass-pad" role="status">
    <span class="empty__mark" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6" />
      </svg>
    </span>
    <h2 class="empty__title">{{ title }}</h2>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <div v-if="$slots.default" class="empty__action">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--sp-8) var(--sp-5);
}

.empty__mark {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  background: var(--c-gold-soft);
  color: var(--c-gold);
  margin-bottom: var(--sp-4);
}

.empty__title {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
  max-width: var(--measure);
}

.empty__desc {
  margin-top: var(--sp-3);
  max-width: var(--measure);
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink-3);
}

.empty__action {
  margin-top: var(--sp-5);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-3);
}

@media (max-width: 640px) {
  .empty {
    padding: var(--sp-7) var(--sp-4);
  }
  .empty__title {
    font-size: var(--fs-base);
  }
}
</style>
