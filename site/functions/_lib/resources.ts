/**
 * 各内容资源的 CRUD 声明
 * ------------------------------------------------------------
 * 每类资源只声明「API 字段名 → 数据库列 + 类型 + 约束」，
 * 具体行为由 _lib/crud.ts 的工厂统一实现。
 */

import type { CrudConfig } from './crud'

const POST_STATUS = ['draft', 'published']
const LINK_STATUS = ['pending', 'approved', 'rejected']
const COMMENT_STATUS = ['pending', 'approved', 'spam']
const PROJECT_STATUS = ['active', 'archived', 'wip']

/* ---------- 文章 ---------- */
export const postsConfig: CrudConfig = {
  table: 'posts',
  orderBy: 'is_top DESC, published_at DESC',
  softDeleteColumn: 'deleted_at',
  touchColumn: 'updated_at',
  fields: {
    slug: { column: 'slug', required: true, maxLength: 200 },
    title: { column: 'title', required: true, maxLength: 200 },
    excerpt: { column: 'excerpt', maxLength: 500 },
    content: { column: 'content' },
    contentFormat: { column: 'content_format', enum: ['markdown', 'html'] },
    cover: { column: 'cover', maxLength: 500 },
    categoryId: { column: 'category_id', type: 'number' },
    status: { column: 'status', enum: POST_STATUS },
    // 阅读量由系统在读取时自增，后台不该手改 —— 设成只读
    views: { column: 'views', type: 'number', writable: false },
    readingTime: { column: 'reading_time', type: 'number' },
    isTop: { column: 'is_top', type: 'boolean' },
    allowComment: { column: 'allow_comment', type: 'boolean' },
    publishedAt: { column: 'published_at', maxLength: 30, ignoreEmpty: true },
    // 由 touchColumn 在更新时自动刷新，不接受前端传入
    updatedAt: { column: 'updated_at', maxLength: 30, writable: false },
  },
  /**
   * 文章 ↔ 标签是多对多，存在 post_tags 中间表里，不是 posts 的一列。
   * 配了 relations 之后：读接口回填 tags（id 数组），写接口「先删后插」同步中间表。
   */
  relations: {
    tags: { table: 'post_tags', ownerColumn: 'post_id', targetColumn: 'tag_id' },
  },
}

/* ---------- 相册 ---------- */
export const albumsConfig: CrudConfig = {
  table: 'albums',
  orderBy: 'is_featured DESC, sort_order ASC, id ASC',
  fields: {
    slug: { column: 'slug', required: true, maxLength: 200 },
    title: { column: 'title', required: true, maxLength: 200 },
    description: { column: 'description', maxLength: 500 },
    cover: { column: 'cover', maxLength: 500 },
    location: { column: 'location', maxLength: 100 },
    takenAt: { column: 'taken_at', maxLength: 30 },
    isFeatured: { column: 'is_featured', type: 'boolean' },
    sortOrder: { column: 'sort_order', type: 'number' },
  },
}

/* ---------- 相册图片（作为 albums 的子资源单独管理）---------- */
export const albumImagesConfig: CrudConfig = {
  table: 'album_images',
  orderBy: 'sort_order ASC, id ASC',
  fields: {
    albumId: { column: 'album_id', type: 'number', required: true },
    url: { column: 'url', required: true, maxLength: 500 },
    caption: { column: 'caption', maxLength: 300 },
    width: { column: 'width', type: 'number' },
    height: { column: 'height', type: 'number' },
    sortOrder: { column: 'sort_order', type: 'number' },
  },
}

/* ---------- 碎碎念 ---------- */
export const momentsConfig: CrudConfig = {
  table: 'moments',
  orderBy: 'created_at DESC',
  fields: {
    content: { column: 'content', required: true },
    images: { column: 'images', type: 'json' },
    location: { column: 'location', maxLength: 100 },
    mood: { column: 'mood', maxLength: 50 },
    likes: { column: 'likes', type: 'number' },
  },
}

/* ---------- 音乐 ---------- */
export const musicConfig: CrudConfig = {
  table: 'music',
  orderBy: 'sort_order ASC, id ASC',
  fields: {
    title: { column: 'title', required: true, maxLength: 200 },
    artist: { column: 'artist', maxLength: 200 },
    album: { column: 'album', maxLength: 200 },
    audio: { column: 'audio', required: true, maxLength: 500 },
    cover: { column: 'cover', maxLength: 500 },
    lyrics: { column: 'lyrics' },
    duration: { column: 'duration', type: 'number' },
    sortOrder: { column: 'sort_order', type: 'number' },
  },
}

/* ---------- 项目 ---------- */
export const projectsConfig: CrudConfig = {
  table: 'projects',
  orderBy: 'is_featured DESC, sort_order ASC, id ASC',
  fields: {
    name: { column: 'name', required: true, maxLength: 200 },
    description: { column: 'description', maxLength: 1000 },
    cover: { column: 'cover', maxLength: 500 },
    repoUrl: { column: 'repo_url', maxLength: 500 },
    demoUrl: { column: 'demo_url', maxLength: 500 },
    techStack: { column: 'tech_stack', type: 'json' },
    language: { column: 'language', maxLength: 50 },
    stars: { column: 'stars', type: 'number' },
    status: { column: 'status', enum: PROJECT_STATUS },
    isFeatured: { column: 'is_featured', type: 'boolean' },
    sortOrder: { column: 'sort_order', type: 'number' },
  },
}

/* ---------- 友链 ---------- */
export const linksConfig: CrudConfig = {
  table: 'friend_links',
  orderBy: 'sort_order ASC, id ASC',
  fields: {
    name: { column: 'name', required: true, maxLength: 100 },
    url: { column: 'url', required: true, maxLength: 500 },
    avatar: { column: 'avatar', maxLength: 500 },
    description: { column: 'description', maxLength: 500 },
    groupName: { column: 'group_name', maxLength: 50 },
    status: { column: 'status', enum: LINK_STATUS },
    sortOrder: { column: 'sort_order', type: 'number' },
  },
}

/* ---------- 评论 ---------- */
/** 评论由公开接口产生，后台只做审核与删除，不手工创建 */
export const commentsConfig: CrudConfig = {
  table: 'comments',
  orderBy: 'created_at DESC',
  allowCreate: false,
  fields: {
    targetType: { column: 'target_type', enum: ['post', 'moment', 'guestbook'] },
    targetId: { column: 'target_id', type: 'number' },
    parentId: { column: 'parent_id', type: 'number' },
    provider: { column: 'provider', maxLength: 30 },
    providerUid: { column: 'provider_uid', maxLength: 100 },
    userLogin: { column: 'user_login', maxLength: 100 },
    userName: { column: 'user_name', maxLength: 100 },
    userAvatar: { column: 'user_avatar', maxLength: 500 },
    content: { column: 'content', maxLength: 2000 },
    status: { column: 'status', enum: COMMENT_STATUS },
  },
}

/* ---------- 留言板 ---------- */
/** 留言由公开接口产生，后台只做回复 / 审核 / 删除 */
export const guestbookConfig: CrudConfig = {
  table: 'guestbook',
  orderBy: 'created_at DESC',
  allowCreate: false,
  fields: {
    nickname: { column: 'nickname', maxLength: 50 },
    email: { column: 'email', maxLength: 200 },
    content: { column: 'content', maxLength: 2000 },
    reply: { column: 'reply', maxLength: 2000 },
    status: { column: 'status', enum: COMMENT_STATUS },
  },
}

/* ---------- 分类 ---------- */
/**
 * 分类是文章的归属（一个文章一个分类），有 slug 和文章数统计，前端按它筛选。
 * 与「类型」（posts.type 枚举：技术/生活/摄影/随笔）不是一回事。
 */
export const categoriesConfig: CrudConfig = {
  table: 'categories',
  orderBy: 'sort_order ASC, id ASC',
  fields: {
    name: { column: 'name', required: true, maxLength: 50 },
    slug: { column: 'slug', required: true, maxLength: 50 },
    description: { column: 'description', maxLength: 200 },
    sortOrder: { column: 'sort_order', type: 'number' },
  },
  // 删分类要把文章上的引用置空（不能指望外键的 ON DELETE SET NULL，见 crud.ts）
  beforeDelete: ['UPDATE posts SET category_id = NULL WHERE category_id = ?'],
}

/* ---------- 标签 ---------- */
/** 标签是多对多，一篇文章可以有多个；中间表见 postsConfig.relations */
export const tagsConfig: CrudConfig = {
  table: 'tags',
  orderBy: 'name ASC',
  fields: {
    name: { column: 'name', required: true, maxLength: 50 },
    slug: { column: 'slug', required: true, maxLength: 50 },
  },
  // 删标签要清掉中间表里指向它的行（不能指望外键级联，见 crud.ts）
  beforeDelete: ['DELETE FROM post_tags WHERE tag_id = ?'],
}
