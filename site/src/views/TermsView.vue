<script setup lang="ts">
/**
 * 服务条款
 * 用平实的语言说明本站的使用约定，不堆砌法律套话。
 */
const updated = new Date()
const updatedText = `${updated.getFullYear()} 年 ${updated.getMonth() + 1} 月 ${updated.getDate()} 日`
</script>

<template>
  <div class="terms container">
    <header class="page-head">
      <h1 class="page-head__title">服务条款</h1>
      <p class="page-head__sub">使用本站前，请花几分钟了解以下约定。</p>
      <hr class="grad-rule" />
    </header>

    <div class="glass-card glass-pad">
      <div class="prose">
        <h2>关于内容</h2>
        <p>
          本站的文章、照片与音乐推荐由站长本人撰写或整理，版权归原作者所有。
          欢迎引用与链接，但请注明出处，不要整篇转载或用于商业用途。
        </p>
        <p>
          站内出现的第三方商标、产品名称仅用于说明与评论目的，归各自所有者所有。
        </p>

        <h2>关于评论与留言</h2>
        <p>
          评论功能面向愿意为自己的言论负责的访客。请勿发布违法、攻击性、广告推广或与主题无关的内容。
          站长保留在无预告的情况下删除任何内容、以及限制特定账号发言的权利。
        </p>
        <p>发表评论即表示你同意本站按隐私政策所述方式保存你的昵称、头像与评论内容。</p>

        <h2>关于可用性</h2>
        <p>
          本站是个人项目，不提供任何可用性承诺。内容可能随时修改、迁移或删除，
          链接也可能失效。请不要把这里当作唯一的信息来源。
        </p>
        <p>
          如果某个链接指向了第三方站点，那部分内容的准确性与安全性由该站点负责，本站不作担保。
        </p>

        <h2>条款变更</h2>
        <p>
          条款如有调整会直接更新本页，不另行通知。继续使用本站即视为接受更新后的条款。
          如有疑问，可通过关于页的联系方式与我沟通。
        </p>

        <p class="updated">最后更新：{{ updatedText }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terms {
  padding-top: var(--sp-6);
  max-width: 860px;
}
.page-head {
  margin-bottom: var(--sp-5);
}
.page-head__title {
  font-size: var(--fs-3xl);
}
.page-head__sub {
  margin-top: var(--sp-3);
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}
.updated {
  margin-top: var(--sp-6);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-line);
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
}
</style>
