/**
 * 站点默认设置（构建期兜底）
 * 阶段 3 起，前端启动会请求 /api/wp/settings 覆盖这里的值；
 * 后台「站点设置」改动后无需重新构建即可生效。
 */
import type { SiteSettings } from '@/types'

export const defaultSettings: SiteSettings = {
  siteName: '纸上',
  tagline: '一个人的杂志 · 技术、设计与生活',
  kicker: 'Personal Magazine',
  author: '站长',
  authorAvatar: '',
  authorBio: '写代码，也写字。在这里记录技术笔记、设计观察和生活碎片。',
  copyright: '纸上',
  icp: '',
  accentColor: '',
  social: {
    github: '',
    email: '',
    rss: '/feed.xml',
  },
  chatEnabled: true,
}
