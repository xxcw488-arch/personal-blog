# 部署你自己的博客

从 fork 到能打开，**全程使用 Cloudflare 免费额度，月费 $0**。预计 30–40 分钟。

**不需要先买域名** —— Cloudflare Pages 会给每个项目一个 `xxx.pages.dev` 地址，
HTTPS 和公网访问都是现成的。域名可以以后再加（见[可选配置](#可选配置)）。

> 两条会影响「花不花钱」的铁律：
> 1. **R2 要绑一次支付方式才能启用**（官方要求走一次 checkout 流程），但用量在免费额度内就是 $0。
> 2. **不要订阅 Workers Paid** —— 它是每月固定 $5、没有免费档，一订就破坏 $0 目标。

---

## 目录

1. [Fork 仓库](#1-fork-仓库)
2. [改配置文件里的值](#2-改配置文件里的值)
3. [创建 GitHub OAuth App](#3-创建-github-oauth-app)
4. [创建 Cloudflare 资源](#4-创建-cloudflare-资源d1--r2)
5. [连接 Pages 并首次部署](#5-连接-pages-并首次部署)
6. [设置两个 Secret](#6-设置两个-secret)
7. [建表](#7-建表)
8. [初始化管理员](#8-初始化管理员)
9. [以后如何更新](#9-以后如何更新)

---

## 1. Fork 仓库

打开本仓库页面，点右上角 **Fork** → Owner 选自己的账号 → **Create fork**。

之后所有操作都在**你自己的 fork** 里进行。

> 顺便做两件小事（都在你自己的 fork 里）：
> - 把 `LICENSE` 里的 `<你的名字或 GitHub 用户名>` 换成你自己
> - 仓库可以设为 Private，Cloudflare 同样能连（授权时选中这个仓库即可）

---

## 2. 改配置文件里的值

编辑 **`site/wrangler.toml`**。这个文件是 Pages 项目的**唯一真相**（下面第 5 步会解释为什么），
所以值都填在这里，而不是控制台。文件顶部有一份逐条勾选的清单，照着勾即可。

### 先搞清楚：所有变量住在哪

| 变量 | 放在哪 | 说明 |
|---|---|---|
| `database_id` | `site/wrangler.toml` | D1 是**绑定**，不是环境变量 —— 只能写在这里或控制台 |
| `bucket_name` | `site/wrangler.toml` | R2 同上 |
| `name` | `site/wrangler.toml` | 必须与 Pages 项目名一致 |
| `SITE_URL` / `MEDIA_URL` / `GITHUB_CLIENT_ID` | `site/wrangler.toml` 的 `[vars]` | 非密钥，可以提交进 git |
| `ADMIN_PEPPER` | **Cloudflare Secret** | 不落在任何文件里，第 6 步设置 |
| `GITHUB_CLIENT_SECRET` | **Cloudflare Secret** | 同上 |
| `ADMIN_PEPPER` / `GITHUB_CLIENT_SECRET`（本地） | `site/.dev.vars` | **只给本地 `npm run dev:local` 用**，不进 git |
| `VITE_USE_MOCK` | `site/.env.local` | **只影响前端构建**，与部署无关 |

> 所以本项目**没有**「两份 `.env` 模板直接填」的模式 —— 那是 Workers 项目的做法
> （变量配在控制台）。在 Pages 上：绑定只能进 `wrangler.toml`，
> 而 Functions 的运行时变量只来自 `wrangler.toml` 的 `[vars]` 或控制台，
> Vite 的 `.env` 只喂给前端代码（还必须带 `VITE_` 前缀）。
> 一句话：**部署要填的东西全在 `site/wrangler.toml` 一个文件里**，外加两个 Secret。

### 逐项说明

| 值 | 必改？ | 填什么 |
|---|---|---|
| `database_id` | ✅ **必改** | 第 4 步创建的 D1 数据库 ID |
| `bucket_name` | 建议 | 第 4 步创建的 R2 桶名（默认 `my-blog-media`，你也可以用别的名字） |
| `MEDIA_URL` | 建议 | 图片/音频的公开地址。**先用 R2 的 `r2.dev` 地址顶上**，等有域名了再换（见第 4.2 步） |
| `GITHUB_CLIENT_ID` | 第 3 步拿到后填 | GitHub OAuth App 的 Client ID（**不是密钥**，可以提交） |
| `name` | 看情况 | Pages 项目名。**第 5 步创建项目时要填一样的名字**，否则构建会报错 |
| `SITE_URL` | 可以不改 | 站点域名。**留占位符也能跑**：`feed.xml` / `sitemap.xml` 检测到值里有 `example.` 会自动回退到实际访问地址 |

**`ADMIN_PEPPER` 和 `GITHUB_CLIENT_SECRET` 不要写进这个文件** —— 它们是 Secret，第 6 步单独设置。

> 第 2、3 步可以和第 4 步换顺序做，只要最后 `wrangler.toml` 里三个值都齐了再部署就行。

---

## 3. 创建 GitHub OAuth App

评论功能要求登录（否则垃圾广告成本为零），用 GitHub 登录就不用自己存密码。

打开 https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**：

| 字段 | 填什么 |
|---|---|
| Application name | 随便，例如 `我的博客` |
| Homepage URL | 你的站点地址。**还没部署就先随便填**（例如 `https://example.com`），部署完再回来改 |
| Authorization callback URL | `https://<你的实际地址>/api/auth/github/callback` |

**还不知道地址怎么办**：先按第 5 步部署，拿到 `https://xxx.pages.dev` 之后，
再回来把上面两个 URL 改成真实地址。**回调地址必须完全一致**（带 `https://`、结尾不加斜杠）。

创建后：
1. 复制 **Client ID** → 填进 `site/wrangler.toml` 的 `GITHUB_CLIENT_ID`
2. 点 **Generate a new client secret** → **立刻复制**（只显示一次）→ 留到第 6 步用

> 🔒 Client Secret 不要提交进 git、不要贴进任何聊天窗口。
> 万一泄露：回 GitHub 重新 Generate 一个，再重跑第 6 步即可。

---

## 4. 创建 Cloudflare 资源（D1 + R2）

打开 https://dash.cloudflare.com/ 。本项目只需要两种资源。

### 4.1 D1 数据库（存文章、评论、统计）

**Storage & databases → D1 SQLite Database → Create Database**，名字填 `blog-db`，
位置保留默认 → **Create**。

回到列表，在 **UUID** 那一栏复制完整 ID → 填进 `site/wrangler.toml` 的 `database_id`。

> 部署**不会**自动建表，第 7 步会做（配好之后就是自动的）。

### 4.2 R2 存储桶（存图片和音频）

**Storage & databases → R2 Object Storage** → 按提示完成一次 checkout（要绑支付方式，
额度内不产生费用）→ **Create bucket**，名字填 `my-blog-media`，Location 保留 **Automatic**。

**关键一步：让桶能被公开访问。** 两种做法：

| 做法 | 什么时候用 | 怎么配 |
|---|---|---|
| **`r2.dev` 开发地址**（先这样） | 还没有域名 | 进入桶 → **Settings** → **Public access** → 启用 **R2.dev subdomain**，拿到形如 `https://pub-xxxx.r2.dev` 的地址 → 填进 `MEDIA_URL` |
| **自定义域**（正式） | 有域名之后 | 见[可选配置](#r2-绑定自定义域名) |

> `r2.dev` 官方标注**限流、仅供开发调试**，不要长期用它对外。功能上够你把站跑起来验证版式。

---

## 5. 连接 Pages 并首次部署

**Compute → Workers & Pages → Create application → Pages → Connect to Git**，
授权 Cloudflare 访问你的 GitHub，选中你 fork 的仓库。

### 构建配置（照抄）

| 设置项 | 填什么 |
|---|---|
| Project name | **必须和 `site/wrangler.toml` 里的 `name` 一致**（默认 `my-blog-site`） |
| Production branch | `main` |
| Framework preset | `None` |
| **Root directory** | **`site`** ← 别漏，仓库根目录不是项目根目录 |
| Build command | `npm run build` |
| Build output directory | `dist` |

点 **Save and Deploy**，等构建完成。成功后会给你一个 `https://<项目名>.pages.dev` 地址。

### 部署后自检

把 `<地址>` 换成你的实际地址，逐个访问：

| 检查 | 期望结果 |
|---|---|
| `<地址>/` | 看到博客首页（深色极光风格） |
| `<地址>/api/wp/posts` | 返回 JSON，`total` 是 `0`（还没建表/塞数据，属于正常） |
| `<地址>/api/admin/status` | 返回 `{"initialized":false,...}` |
| `<地址>/feed.xml` | 返回 RSS |
| `<地址>/admin/login` | 看到「初始化后台」界面 |

> ⚠️ **`wrangler.toml` 是唯一真相**：只要它带了 `pages_build_output_dir`，
> Cloudflare 就以它为准，**控制台里同名字段（D1/R2 绑定、`[vars]`）改不动**。
> 所以别在控制台重复配一遍，否则以后排查问题时会很困惑。

---

## 6. 设置两个 Secret

两个密钥都**不进仓库**，用命令行设置（会提示你粘贴值）。

```powershell
# ① 后台口令用的 pepper：先生成一串随机值
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ② 存成 Pages Secret（把 my-blog-site 换成你的项目名）
npx wrangler pages secret put ADMIN_PEPPER --project-name my-blog-site

# ③ GitHub OAuth 的 Client Secret（第 3 步复制的）
npx wrangler pages secret put GITHUB_CLIENT_SECRET --project-name my-blog-site
```

也可以全部在控制台做：**Pages 项目 → Settings → Variables and Secrets → Add**。

> - `ADMIN_PEPPER` 的作用：后台口令校验时做 HMAC。有了它，**即使数据库泄露，
>   攻击者也无法用库里的哈希验证自己猜的口令**。丢了不影响使用，但换了它所有登录会话失效。
> - **千万不要把这两个值发给我或任何人。** 忘记 `GITHUB_CLIENT_SECRET` 就回 GitHub 重新生成。

**改完 `wrangler.toml` 里的 `GITHUB_CLIENT_ID` 后要重新部署一次**（`[vars]` 改动不会自动生效）：

```powershell
cd site
npm run build
npx wrangler pages deploy dist --project-name my-blog-site
cd ..
```

（Secret 是立即生效的，不用重新部署。）

---

## 7. 建表

### 方式 A：让 GitHub Action 自动做（推荐）

仓库里已经带了一个 workflow：`.github/workflows/migrate.yml`，
推送到 `main` 就自动执行 `db/schema.sql`。配置一次即可：

**GitHub 仓库 → Settings → Secrets and variables → Actions**

| 类型 | 名称 | 值 |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | 在 Cloudflare 控制台 **My Profile → API Tokens → Create Token**，用 **Edit Cloudflare Workers** 模板，或自定义一个带 **D1 编辑**权限的 token |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 控制台右侧栏可以看到 |

配好之后去 **Actions → 数据库迁移 → Run workflow** 手动跑一次。

> ⚠️ **Fork 不会触发 push 事件**，所以第一次必须手动 Run workflow（或随便推一个 commit）。
> 之后每次推送到 `main` 都会自动跑。

### 方式 B：手动跑一次

```powershell
npx wrangler d1 execute DB --remote --config site/wrangler.toml --file=./db/schema.sql
```

`db/schema.sql` 里全部是 `CREATE TABLE IF NOT EXISTS`，**可以反复执行**，不会覆盖数据。

### 想先看示例内容？

```powershell
npx wrangler d1 execute DB --remote --config site/wrangler.toml --file=./db/seed.sql
```

会塞进 8 篇示例文章、3 个相册、2 首占位音乐等。**看够了想清空示例内容、保留设置与管理员账号**：

```powershell
npm run db:clear:remote
```

---

## 8. 初始化管理员

打开 `https://<你的地址>/admin/login`。数据库里还没有管理员，页面会显示「**初始化后台**」，
由你自己设口令。

> 口令在浏览器里用 PBKDF2（600k 迭代）派生成 verifier 后才发给服务端，
> **明文口令不会离开你的浏览器**，服务端存的只是 HMAC 值。
> 这是为了在 Workers 免费版 10 ms CPU 限制下也能用上强口令哈希。

> ⚠️ **部署完请立刻初始化**，别先把地址分享给别人 —— 虽然本站的管理员初始化需要口令、
> 不像「第一个登录的人自动成为管理员」那样有被抢注的竞态，但先设好总是更稳妥。

初始化后就能进后台写文章、传图片、改站点设置。评论需要先登录 GitHub，
第一次用 GitHub 登录会自动创建评论用户（普通用户，不是管理员）。

---

## 9. 以后如何更新

上游有新提交时：

1. 打开**你自己的 fork**，切到 `main`
2. 点 **Sync fork → Update branch**
3. Cloudflare 会自动重新构建部署；`migrate.yml` 也会自动应用数据库结构
4. 刷新站点确认正常

> 同步后如果构建失败，最常见的原因是上游加了新的配置项 —— 看一眼构建日志，
> 对照本文件第 2 步的表补上即可。

---

## 可选配置

### 绑定自定义域名

1. 在 Cloudflare 添加你的域名（**Add → Connect Domain**），把 NS 改成 Cloudflare 给的两个地址，
   等状态变成 **Active**
2. **Pages 项目 → Custom domains → Set up a domain**，填你的域名
3. 回 GitHub 把 OAuth App 的 **Homepage URL** 和 **Callback URL** 改成新域名
   （`https://你的域名/api/auth/github/callback`）
4. 把 `site/wrangler.toml` 的 `SITE_URL` 改成 `https://你的域名`，重新部署

### R2 绑定自定义域名

`r2.dev` 是限流的开发地址，正式用要换成自定义域（**只有自定义域才能用 Cloudflare 缓存**，
而缓存是把 R2 读操作压在免费额度内的关键）：

**R2 → 你的桶 → Settings → Custom Domains → Add**，填一个子域（例如 `static.你的域名`），
等状态变成 **Active**，然后把 `MEDIA_URL` 改成 `https://static.你的域名` 并重新部署。

> 前置条件：域名必须是**同一个 Cloudflare 账号下的 zone**。

### 设预算告警（强烈建议）

卡已经绑上了，**超出免费额度会自动计费、不会先问你**：

**Manage Account → Billing → Billable Usage → Create budget alert**，
阈值填 `1` USD，收件人填你的邮箱。

> 官方明确说明：预算告警**只发通知，不会暂停或封顶用量**。所以它是报警器，不是保险丝。
> 真正的保护是下面那些工程手段。

### 图片优化

如果绑定了域名，可以在 **Images → Transformations** 里为该域名启用转换（Sources 选
**This zone only**），按需缩放压缩图片。不启用也能用，只是直接返回原图。

---

## 免费额度守卫（已写进代码，你不需要额外配置）

| 守卫 | 位置 | 作用 |
|---|---|---|
| 上传单文件 ≤ 5 MB | `functions/api/admin/upload.ts` | 防一次误传撑爆 10 GB |
| 只允许图片/音频 | 同上 | 不允许把桶当公开文件托管 |
| 上传限流 200/小时 | 同上 | 防脚本批量灌文件 |
| 运行时绝不 `ListObjects` | 全部读接口 | `ListObjects` 属贵档 Class A 操作 |
| 读接口带 `s-maxage` | 全部读接口 | 边缘缓存，减少回源 |
| 列表接口固定 3 条查询 | `functions/api/wp/posts.ts` | 免费版单次调用只有 50 条查询额度 |
| 访客统计按天去重 + 过滤爬虫 | `functions/_lib/stats.ts` | 行写入只有 10 万/天 |
| 评论限流 10 条/小时 | `functions/api/comments.ts` | 防刷屏 |
| 后台登录限流 10 次/15 分钟 | `functions/api/admin/login.ts` | 防在线爆破 |

**唯一需要你手动做的**：给 R2 自定义域配一条 **Cache Everything** 页面规则
（**你的域名 → Rules → Page Rules**，URL 填 `static.你的域名/*`，设置选 **Cache Everything**）。
这条规则能让同一张图被读 1 万次时，回源到 R2 的可能只有几次。

---

## 常见问题（按症状查）

### 构建失败，提示找不到数据库 / 权限不足

`site/wrangler.toml` 里的 `database_id` 还是占位符，或者填的不是**你自己账号**下的 ID。
D1 填的是完整 **ID**（UUID），R2 填的是**桶名**，别搞混。

### 构建失败，提示项目名不一致

`site/wrangler.toml` 的 `name` 必须和 Pages 项目名完全一致。

### 构建成功，但 `/api/...` 返回一坨 HTML

`_routes.json` 没生效。确认 `site/public/_routes.json` 存在（构建后会在 `dist/` 里）。
它把 `/api/*`、`/feed.xml`、`/sitemap.xml` 交给 Functions，其余走静态资源。

### 刷新子页面 404

`site/public/_redirects` 没生效。它负责把 SPA 路由回落给 `index.html`。

### 评论区显示「评论还没开启」

说明 `GITHUB_CLIENT_ID` 或 `GITHUB_CLIENT_SECRET` 没生效。按顺序排查：

1. `GITHUB_CLIENT_ID` 是否填在 `site/wrangler.toml` 的 `[vars]` 里
2. 改完是否**重新部署**过（`[vars]` 不会自动生效）
3. `npx wrangler pages secret list --project-name <项目名>` 确认 `GITHUB_CLIENT_SECRET` 在
4. 直接访问 `<地址>/api/auth/me`，看 `githubEnabled` 是不是 `true`

### 点 GitHub 登录后报 `redirect_uri_mismatch`

GitHub OAuth App 里的 Callback URL 和实际访问的域名不一致。**必须逐字符一致**
（`https://`、结尾不加斜杠、路径是 `/api/auth/github/callback`）。
注意**预览部署的地址和正式地址不同**，回调只有一个，所以预览站上的 GitHub 登录会失败 ——
这是预期行为，测评论请用正式地址。

### 上传的图片打不开

1. `MEDIA_URL` 是否填对（`r2.dev` 地址要以 `https://` 开头，结尾不要加斜杠）
2. R2 桶的 Public access 是否已启用
3. 用了自定义域的话，状态是否已经是 **Active**

### 站点是空的 / 文章列表报错

数据库表还没建。跑第 7 步（配好 token 后 Actions 里手动 Run workflow 一次）。

### 用 curl 测访客统计，PV 一直是 0

**这不是 bug**：`curl`、`wget`、各种 bot 的 User-Agent 在爬虫黑名单里，不计入统计。
用浏览器打开页面，或者加一个浏览器 UA 再测。

### 想确认自己没超免费额度

**Manage Account → Billing → Billable Usage**，能看到当期用量与预估费用。

### 本地怎么开发

```powershell
npm run dev:local -- --port 8790
```

`dev:local` 会先把真实 Functions 代码跑在 Node HTTP 服务上（D1 用 sql.js、
R2 用内存 Map），打开 http://localhost:8790 即可。启动日志会告诉你评论登录有没有配好。

> 项目自带了本地开发服务器，**不需要 wrangler**：部分 Windows 环境下 workerd 有
> `CreateDirectory: 拒绝访问` 的兼容性问题，`wrangler pages dev` 会起不来，这个服务器绕开了它。
> 端口可以用 `--port` 换（在 `site/` 下写成 `--port 8790`；在仓库根目录要多一层 `--`）。

**想在本地测评论登录**：复制 `site/.dev.vars.example` 成 `site/.dev.vars`，
填上 `GITHUB_CLIENT_SECRET`，并把 `GITHUB_CLIENT_ID` 填进 `site/wrangler.toml` 的 `[vars]`。
本地开发服务器读的就是这两处（`.dev.vars` 不会进 git）。

> ⚠️ GitHub OAuth App 只能填**一个**回调地址，所以本地测试建议**另建一个** OAuth App，
> 回调填 `http://localhost:8790/api/auth/github/callback`；
> 否则把线上那个 App 的回调改成本地地址后，线上登录就挂了。

改完代码建议跑一遍四项验证：

```powershell
cd site
npm run typecheck
npm run typecheck:functions
npm run build
npm run verify:api     # 350+ 项接口断言
```

---

[返回项目 README](../README.md) · [设计说明与开发记录](../README.md#项目说明)
