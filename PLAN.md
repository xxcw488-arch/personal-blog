# 个人博客实施方案

> 架构复刻 [zhici.cc.cd](https://zhici.cc.cd/)，视觉风格对齐该站。
> 本文档为**当前有效版本**；沿革与已作废的早期决定见 §0。

---

## §0 变更记录（本文档的沿革）

早期版本的本方案里，有几条决定**已经作废**。为免误解，集中列在这里：

| 早期决定 | 现状 | 原因 |
|---|---|---|
| 视觉走**杂志排版**（衬线标题 + 纸质感米白底） | ❌ 作废 | 我最初把参考站误判成"浅色清爽卡通风"，实际渲染后发现是**暖调深色 + 极光光斑 + 霓虹渐变 + 玻璃拟态**。已按实际样式重做 |
| 媒体放 **GitHub + jsDelivr** | ❌ 作废 | 改为 **Cloudflare R2**（站长可用，且只用免费额度），见 [media-r2.md](media-r2.md) |
| **保留水豚吉祥物「噜噜」** | 🕓 **延后** | 设计重构期间被移除（提交 `dfebd27`）。站长确认**先不做，等整体功能做完再单独加**，见 §6 |
| 邮箱登录走**密码 + PBKDF2** | ❌ 作废 | 保持 Workers Free 套餐 → CPU 上限 10 ms，标准强度哈希会超限。改为**验证码 OTP** |
| 部署到 Cloudflare Pages + 免费二级域名 | ✅ 仍然有效 | — |

**其余历史细节**（例如早期噜噜的三层人格设计、杂志版式的具体参数）已不再适用，
如需回溯可查 git 历史：`git log --oneline` 与 `git show <commit>:<file>`。

---

## 一、已锁定的决定

| 项 | 决定 |
|---|---|
| 架构 | Vue 3 SPA + Cloudflare Pages Functions + D1 + 独立 admin 后台 |
| 视觉 | **深色暖调底 + 霓虹渐变 + 玻璃拟态卡片 + 程序化水面背景**（已实现） |
| 站点信息 | 不写死，后台「站点设置」可改（站名/昵称/简介/主题色/社交链接…） |
| 媒体存储 | **Cloudflare R2，只用免费额度**（见 [media-r2.md](media-r2.md)） |
| 计费立场 | **R2 用免费额度；Workers 保持 Free 套餐，不订阅 Paid** |
| 域名 | 免费二级域名 + Cloudflare 托管解析 |
| 评论 | GitHub OAuth + 邮箱验证码（**不做密码登录**，原因见 §3①） |
| AI 聊天 | 后台留空，站长自选服务商/模型/Key；统一走 OpenAI 兼容格式 |
| **噜噜（水豚吉祥物）** | **延后到阶段 7 收尾时再加**（见 §6） |

### 版权边界

只复刻**设计语言与架构思路**（配色、渐变、卡片规范、栅格、交互模式）。
品牌名、吉祥物图片、照片、文章正文全部是自有内容，由后台设置控制。

---

## 二、当前进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | 骨架 + 设计系统 + 全部页面（mock 数据） | ✅ |
| 2 | 相册灯箱、音乐播放器、碎碎念、项目、友链 | ✅ |
| 2b | 友链页重构（申请指引 + 四步格式）+ 留言板 | ✅ |
| 3 | Pages Functions 全部读接口 + RSS + sitemap + `_routes.json` + wrangler 配置 + 验证脚手架 | ✅ |
| **4a** | **后台 API**：初始化 / 登录 / 登出 / 会话、8 类内容 CRUD、站点设置、R2 上传、友链申请转友链 | ✅ |
| 4b | 后台**界面**（admin SPA：登录页 + 各内容管理页） | ⬜ |
| 5 | 评论（GitHub OAuth + 邮箱验证码）、访客统计、AI 聊天 | ⬜ |
| 6 | 部署上线 + 域名接入 | ⬜ |
| **7** | **收尾：加回水豚吉祥物「噜噜」** | ⬜ |

> 部署清单见 [docs/deployment.md](docs/deployment.md)（照着点即可）。
> 早期的 [docs/SETUP.md](docs/SETUP.md) 已合并进那份文档，只保留一个指路链接。

---

## 三、免费额度与设计约束（核心）

**总目标：$0/月。** 下面这些是硬约束，不是"建议"。

### ① Workers Free：CPU 10 ms / 请求

| 登录方式 | 可行性 |
|---|---|
| 邮箱验证码 OTP（SHA-256 比对） | ✅ 采用 |
| GitHub OAuth | ✅ 采用 |
| 邮箱 + 密码（PBKDF2 600k ≈ 75 ms） | ❌ **撞上限，不采用** |

> 实测 PBKDF2-SHA256：10 万次迭代 14.8 ms、21 万次 26.7 ms、60 万次 75.3 ms，全部远超 10 ms。
>
> 若将来愿意付 Workers Paid（**$5/月固定，不是免费档**），CPU 上限变 30 秒，密码登录可随时加回。

### ② D1 Free：单次调用最多 50 条查询

**禁止 N+1。** 现有实现：文章列表固定 **3 条查询**（总数 / 当前页 / 当前页标签），与页大小无关。

其他 D1 免费额度：单库 500 MB、账号共 5 GB、**行读 500 万/天、行写 10 万/天**。

### ③ 行写入 10 万/天：访客统计要省着写

- `visitor_seen` 按「天 + IP 哈希」做主键，**同一人一天只写一次**
- `visitor_online` 用 UPSERT 覆盖，不追加
- 写入放进 `ctx.waitUntil()`，不阻塞响应

### ④ R2 Free：10 GB 存储 / 1000 万次读 / 100 万次写

四条硬规则（详见 [media-r2.md](media-r2.md)）：

1. **媒体走自定义域 + Cache Everything** —— 让边缘缓存吸收重复读，否则读操作会爆
2. **运行时绝不列举桶** —— `ListObjects` 属 Class A（贵档），文件路径存在 D1 里
3. **上传前压缩** —— 照片 ≤ 300 KB/张，音频 128–192 kbps，尽量别放视频
4. **设 $1 的 Budget alert** —— 但官方说明它只提醒、不封顶，真正保护靠前三条

### ⑤ Pages Free：单文件 25 MiB（**与套餐无关**）

付费也不放宽，所以大文件本就必须走 R2 —— 这个结论跟花不花钱无关。
另外：500 次构建/月、20,000 个文件。

---

## 四、架构

```
浏览器
  │
  ├─ 静态资源 ──→ Cloudflare Pages（免费、带宽不限）
  │
  ├─ /api/* ────→ Pages Functions（Workers Free）
  │                  │
  │                  └──→ D1（SQLite）
  │
  └─ 图片/音频 ─→ R2 自定义域（走 Cloudflare Cache）
```

**单个 Pages 项目**（公开站与后台 API 同域），共享同一个 D1 与 R2。

> **与原计划的差异**：早期方案写的是「公开站 / admin 两个独立 Pages 项目」，
> 理由是「后台写接口不暴露在公开域名上」。实际实现改成单项目，原因：
>
> 1. **共享 `_lib`**：`auth` / `db` / `crud` 这些模块两边都要用。分项目就得复制一份
>    或搞同步脚本，长期必然漂移。
> 2. **隔离收益有限**：后台接口本来就有鉴权 + 限流；同域并不会让绕过鉴权变容易。
>    真正有用的隔离手段是「在 `/api/admin/*` 前面加 Cloudflare Access 或 IP 规则」，
>    而这个**在单项目里同样能做**（按路径匹配），不需要拆项目。
> 3. **部署复杂度减半**：对个人博客来说，一次部署比两次更不容易出错。
>
> 想要更强隔离时，在 Cloudflare 控制台给 `/api/admin/*` 加一条
> WAF 规则（限制来源 IP）或套上 Cloudflare Access 即可，无需改代码。

### 目录结构

```
<仓库根>\
├── PLAN.md  README.md
├── db\schema.sql（20 张表）  db\seed.sql
├── docs\  design-spec.md  media-r2.md  screenshots\
├── site\                      ← Pages 项目 #1：公开站
│   ├── wrangler.toml          D1 + R2 绑定
│   ├── public\                _routes.json / _redirects / robots.txt
│   ├── functions\             ← 后端
│   │   ├── _lib\              http.ts / db.ts / context.ts
│   │   └── api\               wp\*.ts  guestbook.ts
│   ├── .fn-check\             不依赖 workerd 的接口验证脚手架
│   └── src\                   Vue 3 前端
└── admin\                     ← Pages 项目 #2：后台（阶段 4）
```

---

## 五、API 契约

### 已实现（阶段 3）

```
GET  /api/wp/posts           列表 ?page&perPage&tag&category&type&q&sort
GET  /api/wp/posts/:slug     详情（含正文，阅读量异步自增）
GET  /api/wp/tags            标签 + 文章数
GET  /api/wp/settings        站点设置
GET  /api/guestbook          留言列表
POST /api/guestbook          发布留言（长度校验 + 按 IP 哈希限流）
```

### 待实现（阶段 3b）

```
GET  /api/wp/albums  /api/wp/albums/:slug
GET  /api/wp/moments  /api/wp/music  /api/wp/projects  /api/wp/links
GET  /api/wp/search?q=
GET  /feed.xml  /sitemap.xml
```

### 阶段 4–5

```
POST /api/admin/*                   后台写接口（全部走鉴权中间件）
GET  /api/auth/github[/callback]    GitHub OAuth
POST /api/auth/email/start|verify   邮箱验证码
GET  /api/comments  POST /api/comments
POST /api/stats/hit  GET /api/stats
POST /api/chat                      AI 聊天（SSE，带 IP 限流）
```

---

## 六、噜噜（水豚吉祥物）—— 延后到阶段 7

**决定：整体功能做完后再单独加，现在不动。**

单列一个阶段的理由：它不属于任何功能链路 —— 只依赖公开站布局，
不依赖 D1、接口或后台。放在最后加不会阻塞任何事，也不会被后续改动反复波及。

阶段 7 的要点（先记下来，免得忘）：

- 位置：**左下角**（右下角留给全局音乐播放器，两者都靠右会重叠）
- 三层结构：① 静态人格（每页台词 / 点击反应 / 空闲念叨）② AI 对话 ③ 气泡提示
- 可拖拽 + 松手吸附最近边 + 位置记忆（localStorage，键名用 `lulu-pos-v2` 避免旧位置残留）
- 气泡按所在半屏自动翻边，避免顶出视口
- 素材用**自己画的 SVG**，不复制参考站的吉祥物图片；台词按本站文案重写
- 参考旧实现：`git show dfebd27^:site/src/components/LuluMascot.vue`

---

## 七、数据库

`db/schema.sql` 共 **20 张表**，已用真实 SQLite 引擎验证可执行：

| 分组 | 表 |
|---|---|
| 账号 | `users` `email_codes` `sessions` `rate_limits` |
| 内容 | `posts` `albums` `album_images` `moments` `music` `projects` |
| 分类 | `categories` `tags` `post_tags` |
| 互动 | `comments` `guestbook` `friend_links` |
| 统计 | `visitor_daily` `visitor_seen` `visitor_online` |
| 配置 | `site_settings` |

设计原则：软删除（`posts.deleted_at`）、只存 IP 哈希不存明文、
正文带 `content_format` 标记、索引全部预建、JSON 字段省关联表。

---

## 八、成本（目标 $0）

| 项目 | 预估 |
|---|---|
| Pages 静态托管 | $0（请求不计费、带宽不限） |
| Pages Functions（Workers Free） | $0（10 万请求/天） |
| D1 Free | $0（5 GB / 500 万行读/天 / 10 万行写/天） |
| R2 Free | $0（约 1.75 GB 存储 + 少量读） |
| 域名 | $0（免费二级域名） |
| **合计** | **$0 / 月** |

**唯二会破坏 $0 的动作**：

1. 订阅 Workers Paid → 立刻变成 **$5/月固定支出**
2. 媒体超过 10 GB 或读操作超过 1000 万次/月 → R2 开始按量计费

> 绑卡本身不产生费用：**R2 启用时必须走一次结账流程**（官方要求），
> 但只要用量在免费额度内就是 $0。

---

## 九、风险与已知问题

1. **workerd 在部分 Windows 环境下起不来** —— 无法创建缓存目录
   （`CreateDirectory: #5 拒绝访问; path = miniflare-CacheObject`）。
   已排除：`TEMP`/`TMP`、全部 `XDG_*`、`--persist-to` 绝对路径、放宽沙箱权限。
   手动建同名目录是成功的，说明不是文件系统权限问题，而是 workerd 自身的兼容性。
   → 对策：写了 `site/.fn-check/` 脚手架（sql.js 做 D1 替身 + esbuild 打包），
   直接调用真实 handler，356 项断言全通过。环境正常的机器上 `wrangler pages dev` 可以直接用。
2. **参考站的 sitemap 是过期的** —— `/articles`、`/albums`、`/moments` 全部 404，
   真实路由是单数 `/article`、`/album`、`/moment`。已对齐。
3. **免费二级域名能否作为 R2 自定义域** —— 需实际绑定验证一次（见 media-r2.md §3）。
4. **免费域名可能要续期/被回收** —— 别当唯一入口，`xxx.pages.dev` 兜底。
5. **AI 聊天会被刷** —— 参考站 `/api/chat` 无鉴权无限流，实测不带 token 就能刷它的模型额度。
   我们必须加 IP 限流 + 请求体长度限制 + Key 只存 Secret。
6. **音频版权** —— 别传商业音乐。

---

## 十、需要你本人做的事

| 阶段 | 事项 |
|---|---|
| 3b→6 | 注册 Cloudflare 账号，启用 R2 订阅（走结账流程，但只用免费额度） |
| 4 | 创建 D1 数据库，把 `database_id` 填进 `site/wrangler.toml` |
| 4 | 创建 R2 桶 `my-blog-media`，绑自定义域 |
| 4 | 建 GitHub 仓库（代码托管 + Pages 自动构建） |
| 5 | 建 GitHub OAuth App（评论登录） |
| 5 | 注册发信服务（邮箱验证码，如 Resend 免费 100 封/天） |
| 6 | 申请免费二级域名 + 托管 NS 到 Cloudflare |
| — | 在 Billing 里设一个 **$1 的 Budget alert** |
