/**
 * Pages Functions 环境与上下文类型
 * ------------------------------------------------------------
 * Env 里的字段必须和 wrangler.toml 的绑定一一对应，否则运行时会拿到 undefined。
 */

/** wrangler.toml 中声明的绑定 */
export interface Env {
  /** D1 数据库 */
  DB: D1Database
  /** R2 媒体桶（阶段 4 的后台上传用） */
  BUCKET: R2Bucket
  /** 站点对外域名，用于 RSS / sitemap 的绝对链接 */
  SITE_URL: string
  /** 媒体公开域名（R2 自定义域） */
  MEDIA_URL: string
  /**
   * 后台口令校验用的 pepper（**应当配置为 Secret**，不要写进 wrangler.toml）。
   * 未配置时 auth.ts 会退化成一个固定常量，并在文档里说明其影响。
   */
  ADMIN_PEPPER?: string
  /**
   * GitHub OAuth App 的 Client ID（**不是密钥**，可以写进 wrangler.toml 的 [vars]）。
   * 未配置时 /api/auth/me 会告诉前端「GitHub 登录不可用」，登录按钮随之隐藏。
   */
  GITHUB_CLIENT_ID?: string
  /**
   * GitHub OAuth App 的 Client Secret（**必须配成 Secret**，绝不能进 git）。
   * 只用于 /api/auth/github/callback 里换取 access_token。
   */
  GITHUB_CLIENT_SECRET?: string
}

/**
 * 统一的 handler 类型别名。
 * Pages 会自动把 functions/ 下的文件按路径挂到路由上，导出名必须是
 * onRequestGet / onRequestPost / onRequestOptions 等。
 */
export type Handler = PagesFunction<Env>
