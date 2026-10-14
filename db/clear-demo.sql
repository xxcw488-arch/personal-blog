-- ============================================================
--  清空「示例内容」，保留站点设置与管理员账号
-- ============================================================
--  什么时候用它：
--    `db/seed.sql` 会塞进 8 篇示例文章、3 个相册、2 首曲目等占位数据。
--    如果你部署时执行过 seed.sql，线上就会有这些示例内容。
--    跑一次本脚本即可把它们清掉，开始写你自己的东西。
--
--  用法（线上）：
--    npx wrangler d1 execute DB --remote --config site/wrangler.toml --file=./db/clear-demo.sql
--  用法（本地）：
--    npx wrangler d1 execute DB --local  --config site/wrangler.toml --file=./db/clear-demo.sql
--
--  保留什么：
--    · site_settings —— 站点名 / 简介 / 社交链接等配置，不用重新填
--    · users         —— 你的管理员账号
--  清掉什么：
--    · 文章、分类、标签、相册与图片、碎碎念、音乐、项目、友链、留言、评论
-- ============================================================

DELETE FROM post_tags;
DELETE FROM posts;
DELETE FROM tags;
DELETE FROM categories;

DELETE FROM album_images;
DELETE FROM albums;

DELETE FROM moments;
DELETE FROM music;
DELETE FROM projects;

DELETE FROM friend_links;
DELETE FROM guestbook;
DELETE FROM comments;

-- 访客统计也一并清掉，让计数从 0 开始
DELETE FROM visitor_daily;
DELETE FROM visitor_seen;
DELETE FROM visitor_online;

-- 限流计数清掉（否则刚部署时可能因为之前的测试记录被限流）
DELETE FROM rate_limits;

-- 重置自增 id，让新内容从 1 开始编号
DELETE FROM sqlite_sequence
 WHERE name IN (
   'posts', 'categories', 'tags', 'albums', 'album_images',
   'moments', 'music', 'projects', 'friend_links', 'guestbook', 'comments'
 );

-- ------------------------------------------------------------
--  可选：连站点设置也一起恢复成初始值
--  一般情况下不需要 —— 站点设置是你在后台改过的配置，清掉要重填。
--  真要重置的话，取消下面这一行的注释：
-- ------------------------------------------------------------
-- DELETE FROM site_settings;

-- ------------------------------------------------------------
--  可选：连管理员账号也删掉（会退回「初始化后台」状态）
--  ⚠️ 删掉后需要重新走一次初始化，确认清楚再用。
-- ------------------------------------------------------------
-- DELETE FROM users;
-- DELETE FROM sessions;
