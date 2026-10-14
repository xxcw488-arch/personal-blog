/**
 * 路由表
 * ------------------------------------------------------------
 * 路由路径对齐参考站（注意是**单数**：/article、/album、/moment）。
 * 旧的复数路径保留重定向，避免已有链接失效。
 * 全部懒加载，配合 Vite 自动代码分割。
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页', description: '记录技术折腾、生活碎片与喜欢的音乐的小站' },
  },
  {
    path: '/article',
    name: 'posts',
    component: () => import('@/views/PostsView.vue'),
    meta: { title: '文章', description: '全部文章，支持按标签筛选与搜索' },
  },
  {
    path: '/article/:slug',
    name: 'post',
    component: () => import('@/views/PostView.vue'),
    props: true,
  },
  {
    path: '/album',
    name: 'albums',
    component: () => import('@/views/AlbumsView.vue'),
    meta: { title: '时光集', description: '旅行与日常的影像记录' },
  },
  {
    path: '/album/:slug',
    name: 'album',
    component: () => import('@/views/AlbumView.vue'),
    props: true,
  },
  {
    path: '/moment',
    name: 'moments',
    component: () => import('@/views/MomentsView.vue'),
    meta: { title: '碎碎念', description: '生活里的小事也值得记下' },
  },
  {
    path: '/music',
    name: 'music',
    component: () => import('@/views/MusicView.vue'),
    meta: { title: '音域', description: '在听的歌' },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/ProjectsView.vue'),
    meta: { title: '项目', description: '我做过的东西' },
  },
  {
    path: '/links',
    name: 'links',
    component: () => import('@/views/LinksView.vue'),
    meta: { title: '友链', description: '朋友的站点' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于', description: '关于这个站点和它的作者' },
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/views/TagsView.vue'),
    meta: { title: '标签', description: '按标签浏览文章' },
  },
  {
    path: '/tags/:slug',
    name: 'tag',
    component: () => import('@/views/TagView.vue'),
    props: true,
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    meta: { title: '站内搜索' },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue'),
    meta: { title: '隐私政策' },
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('@/views/TermsView.vue'),
    meta: { title: '服务条款' },
  },

  /* ---------- 后台（独立版式，不带公开站的报头/页脚/背景）---------- */
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/admin/views/AdminLoginView.vue'),
    meta: { title: '后台登录', layout: 'admin' },
  },
  {
    path: '/admin',
    component: () => import('@/admin/components/AdminLayout.vue'),
    meta: { layout: 'admin', requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('@/admin/views/AdminDashboardView.vue'),
        meta: { title: '后台概览', layout: 'admin', requiresAdmin: true },
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: () => import('@/admin/views/AdminSettingsView.vue'),
        meta: { title: '站点设置', layout: 'admin', requiresAdmin: true },
      },
      {
        path: ':resource',
        name: 'admin-resource',
        component: () => import('@/admin/views/AdminResourceView.vue'),
        props: true,
        meta: { title: '内容管理', layout: 'admin', requiresAdmin: true },
      },
    ],
  },

  /* ---------- 旧路径重定向（保持向后兼容）---------- */
  { path: '/posts', redirect: { name: 'posts' } },
  { path: '/post/:slug', redirect: (to) => ({ name: 'post', params: { slug: to.params.slug } }) },
  { path: '/albums', redirect: { name: 'albums' } },
  { path: '/albums/:slug', redirect: (to) => ({ name: 'album', params: { slug: to.params.slug } }) },
  { path: '/moments', redirect: { name: 'moments' } },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, behavior: 'smooth' }
  },
})

/**
 * 后台路由守卫。
 * 只探测一次登录态（admin.checked），避免每次跳转都打一次 /me。
 * 未登录时带上 redirect，登录后能跳回原来想去的页面。
 */
router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) return true

  const admin = useAdminStore()
  if (!admin.checked) {
    await admin.refreshMe()
  }
  if (!admin.isLoggedIn) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to) => {
  // 标签页标题由 App.vue 统一维护：它要跟着「站点设置」里的站点名走，
  // 而设置是异步加载的，守卫这里拿不到最新值（见 App.vue 的 watch）
  const desc = to.meta.description as string | undefined
  if (desc) {
    let tag = document.querySelector('meta[name="description"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('name', 'description')
      document.head.appendChild(tag)
    }
    tag.setAttribute('content', desc)
  }
})
