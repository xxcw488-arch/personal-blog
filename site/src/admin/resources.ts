/**
 * 后台资源的字段声明
 * ------------------------------------------------------------
 * 与服务端 functions/_lib/resources.ts 一一对应。
 * 界面靠这份声明自动生成表格与表单，所以新增字段只要改两处
 * （服务端白名单 + 这里），不用写新的页面。
 */

export type Widget =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'number'
  | 'switch'
  | 'select'
  /** 多选（复选框列表），值是一个 id 数组 —— 用于文章标签 */
  | 'multiselect'
  | 'tags'
  | 'images'
  | 'datetime'

export interface AdminField {
  /** API 字段名（驼峰） */
  key: string
  label: string
  widget: Widget
  /** select / multiselect 的选项 */
  options?: { value: string; label: string }[]
  /**
   * 新建表单里的默认值。
   * 不写时：select 取第一个选项、switch 取 false、数组取 []、其余取 ''。
   *
   * 注意：对「决定内容是否公开」的字段一定要显式指定 ——
   * 否则会出现「我在后台发了文章，站点上看不到」这类困惑。
   */
  defaultValue?: unknown
  placeholder?: string
  help?: string
  required?: boolean
  /** 列表页显示这一列 */
  inList?: boolean
  /** 表单里占整行 */
  wide?: boolean
  /** 只读（如 views） */
  readonly?: boolean
  /**
   * select 选中「（未设置）」时提交 null 而不是空字符串。
   * 用于可空的外键（如文章的 category_id）—— 空字符串会被转成 0，
   * 那就写进了一个不存在的分类 id。
   */
  emptyAsNull?: boolean
}

export interface AdminResourceDef {
  /** API 路径段 */
  key: string
  title: string
  singular: string
  /** 列表主标题用哪个字段 */
  titleField: string
  fields: AdminField[]
  canCreate: boolean
  /** 支持新建/编辑（评论与留言只能审核/回复） */
  canEdit: boolean
  /** 软删除（提示文案不同） */
  softDelete?: boolean
  /** 列表页提示 */
  hint?: string
}

const POST_STATUS = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
]

const LINK_STATUS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

const MODERATION_STATUS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'spam', label: '垃圾内容' },
]

const PROJECT_STATUS = [
  { value: 'active', label: '维护中' },
  { value: 'wip', label: '开发中' },
  { value: 'archived', label: '已归档' },
]

/* ============================================================
   文章
   ============================================================ */

export const postsResource: AdminResourceDef = {
  key: 'posts',
  title: '文章',
  singular: '文章',
  titleField: 'title',
  canCreate: true,
  canEdit: true,
  softDelete: true,
  fields: [
    { key: 'title', label: '标题', widget: 'text', required: true, inList: true, wide: true },
    { key: 'slug', label: 'Slug', widget: 'text', required: true, inList: true,
      placeholder: 'url-friendly-name', help: '用于文章链接 /article/<slug>，建议只用小写字母、数字和连字符' },
    { key: 'status', label: '状态', widget: 'select', options: POST_STATUS, inList: true,
      defaultValue: 'published',
      help: '只有「已发布」才会出现在站点上；存草稿就先别发' },
    { key: 'excerpt', label: '摘要', widget: 'textarea', wide: true,
      help: '列表页与 SEO 描述用，建议 100 字以内' },
    { key: 'content', label: '正文', widget: 'markdown', wide: true,
      help: '支持 Markdown；保存后前端会渲染并消毒' },
    { key: 'cover', label: '封面图 URL', widget: 'text', wide: true,
      help: '留空会自动生成一张抽象封面；也可以点右边直接上传' },
    { key: 'categoryId', label: '分类', widget: 'select', emptyAsNull: true, defaultValue: '',
      help: '文章的归属分类（去「分类」里增删改）。与「类型」不是一回事：类型是文章自身的枚举' },
    { key: 'tags', label: '标签', widget: 'multiselect', wide: true,
      help: '一篇文章可以有多个标签，会显示在文章底部并可点进标签页；去「标签」里增删改' },
    { key: 'readingTime', label: '阅读时长（分钟）', widget: 'number' },
    { key: 'views', label: '阅读量', widget: 'number', readonly: true, inList: true },
    { key: 'isTop', label: '置顶', widget: 'switch' },
    { key: 'allowComment', label: '允许评论', widget: 'switch' },
    { key: 'publishedAt', label: '发布时间', widget: 'datetime',
      help: '格式 YYYY-MM-DD HH:MM:SS，留空用当前时间' },
  ],
}

/* ============================================================
   相册
   ============================================================ */

export const albumsResource: AdminResourceDef = {
  key: 'albums',
  title: '相册',
  singular: '相册',
  titleField: 'title',
  canCreate: true,
  canEdit: true,
  fields: [
    { key: 'title', label: '标题', widget: 'text', required: true, inList: true },
    { key: 'slug', label: 'Slug', widget: 'text', required: true, inList: true },
    { key: 'description', label: '描述', widget: 'textarea', wide: true },
    { key: 'cover', label: '封面图 URL', widget: 'text', wide: true },
    { key: 'location', label: '地点', widget: 'text', inList: true },
    { key: 'takenAt', label: '拍摄日期', widget: 'text', placeholder: '2026-03-05' },
    { key: 'isFeatured', label: '精选', widget: 'switch', inList: true },
    { key: 'sortOrder', label: '排序', widget: 'number', help: '数字越小越靠前' },
  ],
}

/** 相册图片是 albums 的子资源，列表按 albumId 过滤 */
export const albumImagesResource: AdminResourceDef = {
  key: 'album-images',
  title: '相册图片',
  singular: '图片',
  titleField: 'url',
  canCreate: true,
  canEdit: true,
  hint: '用 ?albumId=N 只看某个相册的图片',
  fields: [
    { key: 'albumId', label: '所属相册 ID', widget: 'number', required: true, inList: true },
    { key: 'url', label: '图片 URL', widget: 'text', required: true, inList: true, wide: true },
    { key: 'caption', label: '图注', widget: 'text', inList: true },
    { key: 'width', label: '宽', widget: 'number' },
    { key: 'height', label: '高', widget: 'number' },
    { key: 'sortOrder', label: '排序', widget: 'number' },
  ],
}

/* ============================================================
   碎碎念
   ============================================================ */

export const momentsResource: AdminResourceDef = {
  key: 'moments',
  title: '碎碎念',
  singular: '碎碎念',
  titleField: 'content',
  canCreate: true,
  canEdit: true,
  fields: [
    { key: 'content', label: '内容', widget: 'textarea', required: true, inList: true, wide: true },
    { key: 'images', label: '配图 URL 列表', widget: 'images', wide: true,
      help: '每行一个图片 URL' },
    { key: 'location', label: '地点', widget: 'text', inList: true },
    { key: 'mood', label: '心情', widget: 'text', inList: true },
    { key: 'likes', label: '点赞数', widget: 'number' },
  ],
}

/* ============================================================
   音乐
   ============================================================ */

export const musicResource: AdminResourceDef = {
  key: 'music',
  title: '音域',
  singular: '曲目',
  titleField: 'title',
  canCreate: true,
  canEdit: true,
  fields: [
    { key: 'title', label: '曲名', widget: 'text', required: true, inList: true },
    { key: 'artist', label: '歌手', widget: 'text', inList: true },
    { key: 'album', label: '专辑', widget: 'text', inList: true },
    { key: 'audio', label: '音频 URL', widget: 'text', required: true, wide: true,
      help: 'R2 上的直链，用上面的上传按钮拿到' },
    { key: 'cover', label: '封面 URL', widget: 'text', wide: true },
    { key: 'lyrics', label: 'LRC 歌词', widget: 'textarea', wide: true,
      help: '格式：[00:12.34]歌词内容' },
    { key: 'duration', label: '时长（秒）', widget: 'number' },
    { key: 'sortOrder', label: '排序', widget: 'number' },
  ],
}

/* ============================================================
   项目
   ============================================================ */

export const projectsResource: AdminResourceDef = {
  key: 'projects',
  title: '项目',
  singular: '项目',
  titleField: 'name',
  canCreate: true,
  canEdit: true,
  fields: [
    { key: 'name', label: '名称', widget: 'text', required: true, inList: true },
    { key: 'description', label: '描述', widget: 'textarea', wide: true },
    { key: 'cover', label: '封面 URL', widget: 'text', wide: true },
    { key: 'repoUrl', label: '仓库地址', widget: 'text', wide: true },
    { key: 'demoUrl', label: '演示地址', widget: 'text', wide: true },
    { key: 'techStack', label: '技术栈', widget: 'tags', wide: true,
      help: '每行一个，或逗号分隔' },
    { key: 'language', label: '主语言', widget: 'text', inList: true },
    { key: 'stars', label: 'Star 数', widget: 'number' },
    { key: 'status', label: '状态', widget: 'select', options: PROJECT_STATUS, inList: true },
    { key: 'isFeatured', label: '精选', widget: 'switch', inList: true },
    { key: 'sortOrder', label: '排序', widget: 'number' },
  ],
}

/* ============================================================
   友链
   ============================================================ */

export const linksResource: AdminResourceDef = {
  key: 'links',
  title: '友链',
  singular: '友链',
  titleField: 'name',
  canCreate: true,
  canEdit: true,
  hint: '待审核的友链不会出现在公开页面，改状态为「已通过」后才会显示',
  fields: [
    { key: 'name', label: '站点名', widget: 'text', required: true, inList: true },
    { key: 'url', label: '链接', widget: 'text', required: true, inList: true, wide: true },
    { key: 'avatar', label: '头像 URL', widget: 'text', wide: true },
    { key: 'description', label: '描述', widget: 'textarea', wide: true },
    { key: 'groupName', label: '分组', widget: 'text', inList: true, placeholder: '朋友' },
    { key: 'status', label: '状态', widget: 'select', options: LINK_STATUS, inList: true,
      defaultValue: 'approved',
      help: '手动添加的友链默认直接通过；「转成友链」生成的是待审核' },
    { key: 'sortOrder', label: '排序', widget: 'number' },
  ],
}

/* ============================================================
   评论 / 留言（只能审核与回复）
   ============================================================ */

export const commentsResource: AdminResourceDef = {
  key: 'comments',
  title: '评论',
  singular: '评论',
  titleField: 'content',
  canCreate: false,
  canEdit: true,
  hint: '评论由访客产生，这里只能审核状态或删除',
  fields: [
    { key: 'userName', label: '评论者', widget: 'text', inList: true },
    { key: 'content', label: '内容', widget: 'textarea', wide: true, inList: true },
    { key: 'status', label: '状态', widget: 'select', options: MODERATION_STATUS, inList: true },
    { key: 'targetType', label: '目标类型', widget: 'select', inList: true,
      options: [
        { value: 'post', label: '文章' },
        { value: 'moment', label: '碎碎念' },
        { value: 'guestbook', label: '留言板' },
      ] },
    { key: 'targetId', label: '目标 ID', widget: 'number' },
    { key: 'userLogin', label: '登录名', widget: 'text', readonly: true },
  ],
}

export const guestbookResource: AdminResourceDef = {
  key: 'guestbook',
  title: '留言板',
  singular: '留言',
  titleField: 'content',
  canCreate: false,
  canEdit: true,
  hint: '含链接的留言多半是友链申请，可以用「转成友链」一键处理',
  fields: [
    { key: 'nickname', label: '昵称', widget: 'text', inList: true },
    { key: 'content', label: '内容', widget: 'textarea', wide: true, inList: true },
    { key: 'reply', label: '站长回复', widget: 'textarea', wide: true,
      help: '填了就会显示在留言下方' },
    { key: 'status', label: '状态', widget: 'select', options: MODERATION_STATUS, inList: true },
    { key: 'email', label: '邮箱', widget: 'text', readonly: true },
  ],
}

/* ============================================================
   分类与标签
   ------------------------------------------------------------
   这两个是「文章的分类法」，和 posts.type（文章类型枚举）不是一回事：
     · 分类：一篇文章属于一个分类，有 slug 与文章数统计，前端可按它筛选
     · 标签：多对多，一篇文章可以打多个，显示在文章底部
   ============================================================ */

export const categoriesResource: AdminResourceDef = {
  key: 'categories',
  title: '分类',
  singular: '分类',
  titleField: 'name',
  canCreate: true,
  canEdit: true,
  hint: '一篇文章属于一个分类。改完名称/slug 后，文章编辑页的下拉框会自动跟着变',
  fields: [
    { key: 'name', label: '名称', widget: 'text', required: true, inList: true },
    { key: 'slug', label: 'Slug（网址里的名字）', widget: 'text', required: true, inList: true,
      placeholder: 'tech',
      help: '就是分类在网址里的名字，例如 slug 填 tech → 链接是 /article?category=tech。中文名放不进网址（会变成一长串 %E6%8A%80…），所以这里要手填一个英文短名。只能用大小写字母、数字和连字符；⚠️ 上线后改它会让旧链接失效，定下来就别改' },
    { key: 'description', label: '描述', widget: 'textarea', wide: true },
    { key: 'sortOrder', label: '排序', widget: 'number', inList: true,
      help: '数字越小越靠前' },
  ],
}

export const tagsResource: AdminResourceDef = {
  key: 'tags',
  title: '标签',
  singular: '标签',
  titleField: 'name',
  canCreate: true,
  canEdit: true,
  hint: '标签是多对多：一篇文章可以打多个。在这里增删改，然后在「文章」编辑页里勾选',
  fields: [
    { key: 'name', label: '名称', widget: 'text', required: true, inList: true },
    { key: 'slug', label: 'Slug（网址里的名字）', widget: 'text', required: true, inList: true,
      placeholder: 'frontend',
      help: '标签在网址里的名字，例如 slug 填 vue → 链接是 /tags/vue 和 /article?tag=vue。中文名放不进网址，所以手填一个英文短名；⚠️ 改它会让旧链接失效' },
  ],
}

/* ============================================================
   汇总
   ============================================================ */

export const ADMIN_RESOURCES: Record<string, AdminResourceDef> = {
  posts: postsResource,
  categories: categoriesResource,
  tags: tagsResource,
  albums: albumsResource,
  'album-images': albumImagesResource,
  moments: momentsResource,
  music: musicResource,
  projects: projectsResource,
  links: linksResource,
  comments: commentsResource,
  guestbook: guestbookResource,
}

/** 侧栏导航（按内容组织的顺序） */
export const ADMIN_NAV: { key: string; label: string; icon: string }[] = [
  { key: 'posts', label: '文章', icon: 'doc' },
  { key: 'categories', label: '分类', icon: 'tag' },
  { key: 'tags', label: '标签', icon: 'tag' },
  { key: 'albums', label: '相册', icon: 'image' },
  { key: 'album-images', label: '相册图片', icon: 'image' },
  { key: 'moments', label: '碎碎念', icon: 'chat' },
  { key: 'music', label: '音域', icon: 'music' },
  { key: 'projects', label: '项目', icon: 'box' },
  { key: 'links', label: '友链', icon: 'link' },
  { key: 'comments', label: '评论', icon: 'comment' },
  { key: 'guestbook', label: '留言板', icon: 'mail' },
]
