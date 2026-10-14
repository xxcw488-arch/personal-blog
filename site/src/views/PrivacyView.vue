<script setup lang="ts">
/**
 * 隐私政策
 * ------------------------------------------------------------
 * 按「这个站实际做了什么」来写，不抄模板、不加法律套话：
 * 统计只存 IP 哈希、评论走 GitHub 或邮箱、其余数据都留在浏览器本地。
 */

import { formatDate } from '@/utils'

/** 「最后更新」取渲染当天，避免写死一个会过期的日期 */
const updatedAt = formatDate(new Date())
</script>

<template>
  <div class="privacy container">
    <header class="page-head">
      <div class="kicker">Privacy</div>
      <h1 class="page-head__title">隐私政策</h1>
      <p class="page-head__lead">
        这是个很小的个人博客，能收集到的东西也很少。下面把「到底存了什么、存在哪里」一次说清楚。
      </p>
      <hr class="grad-rule" />
    </header>

    <div class="glass-card glass-pad privacy__card">
      <div class="prose privacy__body">
        <h2>一、访客统计</h2>
        <p>
          为了知道哪些文章真的有人看，站点会记录几个数字：访问量、访客数、当前在线人数。
          记录时不会保存你的明文 IP 地址——IP 会先经过一次不可逆的哈希运算，
          数据库里只留下这串哈希和一个日期。
        </p>
        <p>
          哈希值只用来做去重：同一天里同一个 IP 只算一个访客。
          它不能被还原成 IP，也不会和站外的任何数据做比对，更不会用来给你贴标签。
        </p>

        <h2>二、评论</h2>
        <p>
          发表评论需要先用 GitHub 登录（邮箱登录还没上线）。
          授权时站点只申请读取公开资料的权限，拿到的是你的公开用户名、昵称和头像地址——
          用来在评论旁边显示「这是谁说的」。站点接触不到你的 GitHub 密码，也读不到你的仓库。
        </p>
        <p>
          评论内容与上面这些信息会一直留在站点上，直到你要求删除。
          想删掉自己的评论，写信告诉我即可，我会连同相关记录一起清掉。
        </p>

        <h2>三、登录状态与浏览器存储</h2>
        <p>
          登录后会下发一个会话 Cookie（<code>mb_user</code>），这是站点唯一使用的 Cookie。
          它只用来在你发评论时识别身份，带有 <code>HttpOnly</code> 标记——
          意味着页面上的脚本读不到它，退出登录后立即失效。
          后台管理另有一个独立的 Cookie（<code>mb_admin</code>），与评论身份互不影响。
        </p>
        <p>
          除此之外，只有几项偏好被放在浏览器的 localStorage 里，它们不会上传到服务器：
        </p>
        <ul>
          <li><strong>主题偏好</strong>（<code>blog-theme</code>）：记住你选的是浅色还是深色。</li>
          <li>
            <strong>播放器状态</strong>（<code>blog-player</code>）：记住音量、播放模式和上次听到第几首，
            下次打开时接着放。
          </li>
        </ul>
        <p>清空浏览器数据，这几项就一起没了，站点会回到默认状态。</p>

        <h2>四、广告与第三方请求</h2>
        <p>
          站内没有第三方广告，也没有埋任何统计或跟踪脚本——没有 Google Analytics，也没有百度统计。
          页面上没有需要你同意的追踪器，所以也就没有弹窗。
        </p>
        <p>
          与站外有关的请求只有两处：图片和音频托管在 jsDelivr CDN 上，评论的头像与登录按钮来自 GitHub。
          加载这些资源时，对方服务器会看到你的 IP——这是使用任何 CDN 都会发生的事，不是本站额外做的记录。
        </p>

        <p class="privacy__contact">
          如果对上面的任何一条有疑问，或者想删除自己的评论与相关数据，可以通过<strong>关于</strong>页的联系方式找我。
        </p>
        <p class="privacy__updated">最后更新：{{ updatedAt }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.privacy {
  padding-top: var(--sp-6);
}

.page-head {
  margin-bottom: var(--sp-6);
}
.page-head__title {
  font-size: var(--fs-4xl);
  margin-top: var(--sp-2);
}
.page-head__lead {
  margin-top: var(--sp-3);
  font-size: var(--fs-md);
  color: var(--c-ink-3);
  max-width: var(--measure);
}

.privacy__card {
  border-radius: var(--radius-xl);
}
.privacy__body {
  max-width: var(--measure);
}

.privacy__contact {
  color: var(--c-ink-2);
}
.privacy__updated {
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-line);
  font-size: var(--fs-sm);
  color: var(--c-ink-4);
}

@media (max-width: 640px) {
  .page-head__title {
    font-size: var(--fs-2xl);
  }
}
</style>
