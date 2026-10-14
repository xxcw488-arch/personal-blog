-- ============================================================
--  个人博客 D1 数据库结构
--  用法（本地）：npx wrangler d1 execute blog-db --local --file=./db/schema.sql
--  用法（线上）：npx wrangler d1 execute blog-db --remote --file=./db/schema.sql
--  说明：SQLite 语法，可重复执行（全部 IF NOT EXISTS）。
-- ============================================================

-- ---------- 账号 ----------
-- 同时承载三类身份：
--   1) 管理员（role='admin'，用账密登录后台）
--   2) GitHub OAuth 用户（provider='github'，无密码）
--   3) 邮箱验证码用户（provider='email'，无密码，靠 email_codes 登录）
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE,
  email          TEXT    UNIQUE,               -- 邮箱登录用户的唯一标识
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash  TEXT    NOT NULL DEFAULT '',  -- 仅管理员使用；pbkdf2$迭代$盐$哈希
  provider       TEXT    NOT NULL DEFAULT 'local', -- local | github | email
  provider_uid   TEXT    NOT NULL DEFAULT '',  -- 第三方稳定 ID（邮箱可改，UID 不变）
  nickname       TEXT    NOT NULL DEFAULT '',
  avatar         TEXT    NOT NULL DEFAULT '',
  role           TEXT    NOT NULL DEFAULT 'user', -- admin | user
  status         TEXT    NOT NULL DEFAULT 'active', -- active | pending | banned
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_uid);

-- ---------- 邮箱验证码 ----------
-- 只存哈希，不存明文验证码；靠「短期有效 + 限次尝试」保证安全。
-- 这样在 Workers 免费版 10ms CPU 限制下也能用（SHA-256 开销可忽略）。
CREATE TABLE IF NOT EXISTS email_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL,
  code_hash  TEXT    NOT NULL,               -- SHA-256(验证码 + 盐)
  purpose    TEXT    NOT NULL DEFAULT 'login', -- login | register | bind
  attempts   INTEGER NOT NULL DEFAULT 0,     -- 尝试次数，超限即作废
  used       INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes(email, purpose, created_at DESC);

-- ---------- 服务端会话 ----------
-- 用服务端会话而非纯 JWT，好处是登出/封禁可以立即生效。
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,             -- SHA-256(随机 token)
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT    NOT NULL DEFAULT '',
  ip_hash    TEXT    NOT NULL DEFAULT '',
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------- 接口限流 ----------
-- 用于 AI 聊天、验证码发送、评论等需要按 IP/用户限流的接口。
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket     TEXT    NOT NULL,               -- 如 chat:ip:2026-03-18
  key        TEXT    NOT NULL,               -- IP 哈希或用户 ID
  count      INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT    NOT NULL,
  PRIMARY KEY (bucket, key)
);

-- ---------- 分类 ----------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  slug        TEXT    NOT NULL UNIQUE,
  description TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ---------- 标签 ----------
CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL UNIQUE,
  slug TEXT    NOT NULL UNIQUE
);

-- ---------- 文章 ----------
CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  excerpt      TEXT    NOT NULL DEFAULT '',
  content      TEXT    NOT NULL DEFAULT '',     -- 正文（HTML 或 Markdown，前端按 content_format 渲染）
  content_format TEXT  NOT NULL DEFAULT 'markdown', -- markdown | html
  cover        TEXT    NOT NULL DEFAULT '',
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  status       TEXT    NOT NULL DEFAULT 'published', -- draft | published
  views        INTEGER NOT NULL DEFAULT 0,
  reading_time INTEGER NOT NULL DEFAULT 0,      -- 预估阅读分钟数
  is_top       INTEGER NOT NULL DEFAULT 0,
  allow_comment INTEGER NOT NULL DEFAULT 1,
  published_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT                              -- 软删除
);
CREATE INDEX IF NOT EXISTS idx_posts_status_time ON posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category    ON posts(category_id);

-- ---------- 文章 ↔ 标签 ----------
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- ---------- 相册 ----------
CREATE TABLE IF NOT EXISTS albums (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  cover       TEXT    NOT NULL DEFAULT '',
  location    TEXT    NOT NULL DEFAULT '',
  taken_at    TEXT    NOT NULL DEFAULT '',
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS album_images (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id  INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  url       TEXT    NOT NULL,
  caption   TEXT    NOT NULL DEFAULT '',
  width     INTEGER NOT NULL DEFAULT 0,
  height    INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_album_images_album ON album_images(album_id, sort_order);

-- ---------- 碎碎念 ----------
CREATE TABLE IF NOT EXISTS moments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content    TEXT    NOT NULL DEFAULT '',
  images     TEXT    NOT NULL DEFAULT '[]',     -- JSON 数组：["url1","url2"]
  location   TEXT    NOT NULL DEFAULT '',
  mood       TEXT    NOT NULL DEFAULT '',
  likes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_moments_time ON moments(created_at DESC);

-- ---------- 音乐 ----------
CREATE TABLE IF NOT EXISTS music (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  artist     TEXT    NOT NULL DEFAULT '未知艺术家',
  album      TEXT    NOT NULL DEFAULT '',
  audio      TEXT    NOT NULL,                  -- 音频直链（CDN）
  cover      TEXT    NOT NULL DEFAULT '',
  lyrics     TEXT    NOT NULL DEFAULT '',       -- LRC 文本
  duration   INTEGER NOT NULL DEFAULT 0,        -- 秒
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- 项目 ----------
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  cover       TEXT    NOT NULL DEFAULT '',
  repo_url    TEXT    NOT NULL DEFAULT '',
  demo_url    TEXT    NOT NULL DEFAULT '',
  tech_stack  TEXT    NOT NULL DEFAULT '[]',    -- JSON 数组：["Vue","TypeScript"]
  language    TEXT    NOT NULL DEFAULT '',
  stars       INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'active',-- active | archived | wip
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- 友链 ----------
CREATE TABLE IF NOT EXISTS friend_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  avatar      TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  group_name  TEXT    NOT NULL DEFAULT '朋友',
  status      TEXT    NOT NULL DEFAULT 'approved', -- pending | approved | rejected
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- 评论（文章 / 碎碎念通用） ----------
CREATE TABLE IF NOT EXISTS comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type  TEXT    NOT NULL DEFAULT 'post',  -- post | moment | guestbook
  target_id    INTEGER NOT NULL DEFAULT 0,
  parent_id    INTEGER NOT NULL DEFAULT 0,
  provider     TEXT    NOT NULL DEFAULT 'github',-- github | guest
  provider_uid TEXT    NOT NULL DEFAULT '',
  user_login   TEXT    NOT NULL DEFAULT '',
  user_name    TEXT    NOT NULL DEFAULT '',
  user_avatar  TEXT    NOT NULL DEFAULT '',
  content      TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'approved', -- pending | approved | spam
  ip_hash      TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, created_at DESC);

-- ---------- 留言板 ----------
CREATE TABLE IF NOT EXISTS guestbook (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname   TEXT    NOT NULL,
  email      TEXT    NOT NULL DEFAULT '',
  content    TEXT    NOT NULL,
  reply      TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'approved',
  ip_hash    TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- 访客统计 ----------
CREATE TABLE IF NOT EXISTS visitor_daily (
  day  TEXT    PRIMARY KEY,   -- YYYY-MM-DD
  pv   INTEGER NOT NULL DEFAULT 0,
  uv   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visitor_seen (
  day      TEXT    NOT NULL,
  ip_hash  TEXT    NOT NULL,
  path     TEXT    NOT NULL DEFAULT '/',
  PRIMARY KEY (day, ip_hash)
);

CREATE TABLE IF NOT EXISTS visitor_online (
  ip_hash   TEXT    PRIMARY KEY,
  last_seen INTEGER NOT NULL   -- Unix 秒
);
CREATE INDEX IF NOT EXISTS idx_visitor_online_seen ON visitor_online(last_seen);

-- ---------- 全站设置（键值对） ----------
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
