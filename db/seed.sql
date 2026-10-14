-- ============================================================
--  示例数据（原创占位内容）
--  用法（本地）：npx wrangler d1 execute blog-db --local --file=./db/seed.sql
--  用法（线上）：npx wrangler d1 execute blog-db --remote --file=./db/seed.sql
--
--  说明：
--   1. 全部为原创示例文本，不复制任何第三方站点内容。
--   2. 除相册图片外，封面一律留空 —— 前端会按 slug 生成抽象占位封面，
--      不依赖任何外网图床（首屏因此不会被外部请求拖慢）。
--      相册图片仍用 picsum.photos 占位，方便演示灯箱；正式上线请换成自己的照片。
--   3. 可重复执行：先清空内容表再插入，避免主键冲突。
-- ============================================================

DELETE FROM post_tags;
DELETE FROM posts;
DELETE FROM tags;
DELETE FROM categories;
DELETE FROM albums;
DELETE FROM moments;
DELETE FROM music;
DELETE FROM projects;
DELETE FROM friend_links;

-- ---------- 分类 ----------
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
  (1, '技术', 'tech',   '工程实践、架构取舍与踩坑记录', 1),
  (2, '设计', 'design', '排版、界面与视觉观察',       2),
  (3, '生活', 'life',   '日常碎片与旅行笔记',         3),
  (4, '随笔', 'essay',  '想到哪写到哪',               4);

-- ---------- 标签 ----------
INSERT INTO tags (id, name, slug) VALUES
  (1, '前端',       'frontend'),
  (2, 'Vue',        'vue'),
  (3, 'Cloudflare', 'cloudflare'),
  (4, '排版',       'typography'),
  (5, '性能',       'performance'),
  (6, '数据库',     'database'),
  (7, '摄影',       'photography'),
  (8, '随想',       'thoughts');

-- ---------- 文章 ----------
-- content_format 用 markdown：正文以 Markdown 存储，前端渲染并消毒。
INSERT INTO posts
  (id, slug, title, excerpt, content, content_format, cover, category_id, status,
   views, reading_time, is_top, published_at, updated_at)
VALUES
  (1, 'why-i-built-a-magazine-style-blog',
   '我为什么把博客做成一本杂志',
   '博客不必长得像后台管理系统。当文字成为主角，排版就不再是装饰，而是阅读体验本身。',
   '## 从一个不舒服的感觉说起

我看了很多个人博客，它们大多长成同一个样子：顶部一个导航条，下面一片等宽的卡片流。

问题不在内容，在**排版的优先级**。卡片流把每篇文章压缩成同等重量的一格，于是所有文章都变得一样重要——也就一样不重要。

## 杂志是怎么解决这件事的

杂志编辑有一整套成熟的视觉等级制度：头条占最大版面，次级文章用中等卡片，短讯挤在侧栏。

> 排版不是把字放上去，而是决定读者的眼睛先落在哪里、停留多久、然后去哪。

## 落到实现上

1. 标题用衬线，正文用无衬线。
2. 正文行宽控制在 34em 左右。
3. 首字下沉只用在文章首段。',
   'markdown', '',
   2, 'published', 1284, 6, 1,
   '2026-03-18 09:20:00', '2026-03-19 14:02:00'),

  (2, 'cloudflare-pages-functions-d1-notes',
   '用 Cloudflare Pages + Functions + D1 搭后端的取舍笔记',
   '无服务器不等于没有约束。免费额度里的 CPU 时间、单次查询数、文件体积，会实打实地改写你的架构决策。',
   '## 先说结论

对个人博客这种体量，Cloudflare 这套组合几乎是最优解。但"免费"是有形状的。

## 三笔必须提前算的账

### 一、CPU 时间是 10 毫秒

免费版每个请求只有 10ms CPU 时间，且只算 CPU 真正执行的时间。

这意味着密码哈希这种故意很慢的操作，在这里是奢侈品。所以邮箱登录改用验证码方案。

### 二、单次调用最多 50 条查询

这条限制的实际含义是：**禁止 N+1。**

### 三、单个文件不能超过 25 MiB

所以音频和图片不要塞进 Pages，丢到 CDN 上。

## 数据库是单线程的

D1 每个库背后是单个 Durable Object，查询串行执行。平均查询 1ms 约等于 1000 QPS。

> 索引不是优化项，是生存项。',
   'markdown', '',
   1, 'published', 2031, 8, 1,
   '2026-03-15 11:05:00', '2026-03-16 08:40:00'),

  (3, 'typography-details-that-matter',
   '真正影响阅读体验的七个排版细节',
   '行高、行宽、字距、标点避头尾……这些词听起来枯燥，但它们决定了读者是读完还是划走。',
   '## 排版是阅读的物理层

内容再好，读起来累就是读不完。下面七个细节，是我改过很多遍之后稳定下来的值。

## 一、行高 1.7 ~ 1.85

中文没有词间空格，字块更密，行高要比西文排版更大。

## 二、行宽 34em 左右

一行超过 45 个汉字，回行时容易串行。

## 三、段落间距要大于行距

段间距至少是行距的 1.2 倍。

## 四、标点符号的视觉平衡

## 五、首字下沉只用在首段

## 六、链接要能一眼看出是链接

颜色 + 下划线才是稳妥组合。

## 七、暗色模式不是反色

> 暗色模式的目的是"夜间不刺眼"，不是"把浅色模式取反"。',
   'markdown', '',
   2, 'published', 876, 5, 0,
   '2026-03-12 16:30:00', '2026-03-12 16:30:00'),

  (4, 'vue3-composition-api-in-practice',
   'Vue 3 Composition API 里那些真正省事的写法',
   '组合式函数不是语法糖，它是一种把"有状态逻辑"当函数复用的思路。',
   '## 从"逻辑跟着组件走"到"逻辑随时可用"

Options API 里复用逻辑主要靠 mixin，问题是变量来源不明、命名冲突。

## 模式一：把状态和它的操作封在一起

## 模式二：模块级单例状态

## 模式三：用 computed 代替 watch

> 能推导出来的值就不要存。多存一份状态，就多一份不一致的可能。

## 模式四：显式声明副作用清理',
   'markdown', '',
   1, 'published', 1547, 7, 0,
   '2026-03-08 10:15:00', '2026-03-10 09:00:00'),

  (5, 'a-walk-in-the-old-town',
   '老城区的一下午',
   '没有目的地，只是沿着巷子往里走。拍了一些没什么意义的照片——大概正因为没有意义，才值得留下来。',
   '## 出门的理由

那天下午本来打算改 bug。代码写到一半，发现是个第三方库的边界问题，索性关了编辑器出门。

## 巷子

老城区的巷子有一种特别的尺度：宽不过两三米，两侧的墙把天空切成长长的一条。

## 拍了什么

> 有些照片不需要表达什么。它只是证明：**这个下午，我在这里。**

## 关于"记录"

它们没有信息量，甚至过几年自己都记不起当时在想什么。但也许这就是用处。',
   'markdown', '',
   3, 'published', 523, 4, 0,
   '2026-03-05 20:40:00', '2026-03-05 20:40:00'),

  (6, 'indexes-are-not-optional',
   '索引不是优化项，是生存项',
   '在单线程数据库上用 OFFSET 翻页、在全表扫描上做模糊搜索，都会在某一天突然变成灾难。',
   '## 一开始都很快

一千条数据的时候，什么查询都是"瞬间"。于是很容易得出一个错误结论：不用管索引。

## 坑一：深分页的 OFFSET

数据库必须先扫描并丢弃前 N 行。页码越深越慢。改用游标分页。

## 坑二：LIKE ''%关键词%''

前置通配符让索引彻底失效。而且 D1 对 LIKE 模式串还有 50 字节长度限制。

## 坑三：复合索引的列顺序

**最左前缀原则**：复合索引只能从最左列开始连续匹配。

## 小结

在单线程数据库上，查询耗时直接等于吞吐上限。',
   'markdown', '',
   1, 'published', 1673, 6, 0,
   '2026-02-28 14:20:00', '2026-03-01 10:00:00'),

  (7, 'on-writing-regularly',
   '写了半年之后，我对"坚持写作"的看法变了',
   '一开始我以为难点是灵感，后来发现是别的东西。这篇没什么方法论，只是一些不太体面的真实感受。',
   '## 最开始的想法

我以为写作的难点在于"没有灵感"。半年下来，我的感受是：**灵感从来不是问题，开始才是。**

## 真正卡住我的三件事

### 一、总想写得"值得发"

### 二、把"记录"和"创作"混在一起

### 三、追求"完成度"

> 完成度是个陷阱。它让"发布"这件事变得太贵，而太贵的事情最后就不会发生。

## 小结

**降低发布的门槛，提高放弃的门槛。**',
   'markdown', '',
   4, 'published', 934, 5, 0,
   '2026-02-22 21:10:00', '2026-02-22 21:10:00'),

  (8, 'building-a-serverless-comment-system',
   '从零做一个无服务器评论系统，我跳过了哪些坑',
   '评论是最容易被低估的功能：它涉及身份认证、内容安全、垃圾过滤和数据库写入。',
   '## 先明确要解决什么

身份、存储、安全、体验，缺一个都不完整。

## 身份：为什么不自己存密码

自己实现账号密码要处理密码哈希、找回密码、撞库防护、会话管理。对博客来说成本远超收益。

因为**邮箱可能被改，UID 不会**，所以用 UID 做唯一标识。

## 存储：一张表管三种评论

文章评论、碎碎念评论、留言板，本质是同一种东西，用一张表加类型字段。

嵌套用 parent_id 自关联，但只允许两层。

## 安全：三道闸

内容转义、写入限流、审核状态机。IP 不存明文，只存加盐哈希。

## 体验：乐观更新

发完评论立刻插到列表里，失败了再撤回。别让用户对着原地不动的列表等。',
   'markdown', '',
   1, 'published', 1102, 7, 0,
   '2026-02-18 13:00:00', '2026-02-20 11:30:00');

-- ---------- 文章 ↔ 标签 ----------
INSERT INTO post_tags (post_id, tag_id) VALUES
  (1, 4), (1, 1),
  (2, 3), (2, 6), (2, 5),
  (3, 4),
  (4, 2), (4, 1),
  (5, 7), (5, 8),
  (6, 6), (6, 5),
  (7, 8),
  (8, 3), (8, 6), (8, 1);

-- ---------- 相册 ----------
INSERT INTO albums (id, slug, title, description, cover, location, taken_at, is_featured, sort_order) VALUES
  (1, 'old-town',    '老城区的一下午', '没有目的地，只是沿着巷子往里走。', '',  '老城区', '2026-03-05', 1, 1),
  (2, 'coastline',   '海岸线',         '风很大，浪一直没停。',             '',  '东海岸', '2026-02-14', 1, 2),
  (3, 'night-market','夜市',           '灯亮起来之后，整条街都活了。',     '', '城南',   '2026-01-20', 0, 3);

-- ---------- 相册图片 ----------
INSERT INTO album_images (album_id, url, caption, width, height, sort_order) VALUES
  (1, 'https://picsum.photos/seed/alley-1/1600/1067', '墙上的年代层', 1600, 1067, 1),
  (1, 'https://picsum.photos/seed/alley-2/1600/1067', '抬头只有一条天', 1600, 1067, 2),
  (1, 'https://picsum.photos/seed/alley-3/1600/1067', '骑楼下的阴影', 1600, 1067, 3),
  (2, 'https://picsum.photos/seed/coast-1/1600/1067', '退潮之后', 1600, 1067, 1),
  (2, 'https://picsum.photos/seed/coast-2/1600/1067', '风把云推平了', 1600, 1067, 2),
  (3, 'https://picsum.photos/seed/market-1/1600/1067', '摊前的灯', 1600, 1067, 1),
  (3, 'https://picsum.photos/seed/market-2/1600/1067', '热气', 1600, 1067, 2);

-- ---------- 碎碎念 ----------
INSERT INTO moments (content, images, location, mood, likes, created_at) VALUES
  ('改了一晚上的 bug，最后发现是自己写错了变量名。这种时候既想笑又想砸键盘。', '[]', '', '无奈', 12, '2026-03-18 23:40:00'),
  ('楼下的糖水摊今天出摊了，芋圆还是那个味道。', '[]', '城南', '满足', 28, '2026-03-16 19:20:00'),
  ('连续下了三天雨，终于放晴。窗台上的绿萝好像又长高了一点。', '[]', '', '平静', 19, '2026-03-13 08:05:00');

-- ---------- 音乐 ----------
-- audio 字段填你自己的 CDN 直链（GitHub 仓库 + jsDelivr）。
-- 这里用的是公开的空音频占位，仅为让播放器能跑通。
INSERT INTO music (title, artist, album, audio, cover, lyrics, duration, sort_order) VALUES
  ('示例曲目 · 一', '示例音乐人', '演示专辑',
   'https://cdn.jsdelivr.net/gh/anars/blank-audio@master/2-seconds-of-silence.mp3',
   '',
   '[00:00.00]这是示例歌词
[00:02.00]请替换成你自己的曲目
[00:04.00]音频放到 CDN 上', 4, 1),
  ('示例曲目 · 二', '示例音乐人', '演示专辑',
   'https://cdn.jsdelivr.net/gh/anars/blank-audio@master/5-seconds-of-silence.mp3',
   '',
   '[00:00.00]示例歌词第二首
[00:03.00]支持 LRC 时间轴', 5, 2);

-- ---------- 项目 ----------
INSERT INTO projects (name, description, cover, repo_url, demo_url, tech_stack, language, stars, status, is_featured, sort_order) VALUES
  ('个人博客', '你现在看到的这个站点：Vue 3 + Cloudflare Pages Functions + D1，杂志排版，自带管理后台。',
   '', '', '',
   '["Vue 3","TypeScript","Vite","Cloudflare D1"]', 'TypeScript', 0, 'active', 1, 1),
  ('排版工具箱', '一组用于中文网页排版的小工具：行宽计算、标点挤压、字阶生成。',
   '', '', '',
   '["TypeScript","CSS"]', 'TypeScript', 0, 'wip', 1, 2);

-- ---------- 友链 ----------
INSERT INTO friend_links (name, url, avatar, description, group_name, status, sort_order) VALUES
  ('示例友链', 'https://example.com', '',
   '这里放朋友的站点，把 url 换成真实地址即可。', '朋友', 'approved', 1);

-- ---------- 留言板 ----------
-- 部署后留言板不是空的，访客能立刻看到格式示例（也顺带演示「站长回复」的样子）
INSERT INTO guestbook (nickname, email, content, reply, status, ip_hash, created_at) VALUES
  ('第一位访客', '',
   '这里是示例留言。留言板支持最多 500 字，也可以按上面的四步格式在这里申请友链。',
   '欢迎，随便坐。', 'approved', '', datetime('now', '-1 day'));

-- ---------- 站点设置 ----------
-- 后台「站点设置」页面对应的键值对；这里给出初始值。
INSERT OR REPLACE INTO site_settings (key, value) VALUES
  ('siteName',    '纸上'),
  ('tagline',     '一个人的杂志 · 技术、设计与生活'),
  ('kicker',      'Personal Magazine'),
  ('author',      '站长'),
  ('authorAvatar',''),
  ('authorBio',   '写代码，也写字。在这里记录技术笔记、设计观察和生活碎片。'),
  ('copyright',   '纸上'),
  ('icp',         ''),
  ('accentColor', ''),
  ('chatEnabled', '1'),
  ('social',      '{"github":"","email":"","wechat":"","qq":"","rss":"/feed.xml"}');
