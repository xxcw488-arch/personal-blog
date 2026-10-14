<script setup lang="ts">
/**
 * 404
 * 巨大的渐变数字 + 一句说明 + 回声里的尝试路径 + 三个去处。
 */
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="nf container">
    <p class="nf__no gradient-text" aria-hidden="true">404</p>
    <h1 class="nf__title">这一页走丢了</h1>
    <p class="nf__desc">
      没有找到
      <code class="nf__path mono">{{ route.fullPath }}</code>
      对应的内容。
    </p>
    <div class="nf__actions">
      <RouterLink to="/" class="btn btn--primary">回首页</RouterLink>
      <RouterLink to="/article" class="btn">看全部文章</RouterLink>
      <RouterLink to="/article" class="btn btn--ghost">搜一下</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.nf {
  padding-top: var(--sp-8);
  padding-bottom: var(--sp-8);
  text-align: center;
  max-width: 680px;
}

/* ---------- 巨大的 404 ---------- */
.nf__no {
  font-size: clamp(4rem, 14vw, 9rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  margin: 0;
}

.nf__title {
  font-size: var(--fs-2xl);
  font-weight: 700;
  margin: var(--sp-5) 0 var(--sp-3);
}

.nf__desc {
  font-size: var(--fs-sm);
  line-height: 1.9;
  color: var(--c-ink-3);
}
.nf__path {
  display: inline-block;
  max-width: 100%;
  padding: 0.15em 0.5em;
  border-radius: var(--radius-sm);
  background: var(--c-code-bg);
  border: 1px solid var(--c-line-soft);
  color: var(--c-cyan);
  font-size: 0.92em;
  word-break: break-all;
}

.nf__actions {
  display: flex;
  gap: var(--sp-3);
  justify-content: center;
  flex-wrap: wrap;
  margin-top: var(--sp-7);
}

@media (max-width: 640px) {
  .nf {
    padding-top: var(--sp-7);
    padding-bottom: var(--sp-7);
  }
  .nf__title {
    font-size: var(--fs-xl);
  }
  .nf__actions {
    margin-top: var(--sp-6);
  }
}
</style>
