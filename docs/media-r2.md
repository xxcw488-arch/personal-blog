# 媒体存储：Cloudflare R2（只用免费额度）

> 本文取代 PLAN.md 里「音乐音频放 GitHub + jsDelivr」的旧方案。
> 数据来源：Cloudflare 官方 R2 / Workers / Billing 文档（已逐条核对）。

## 〇、先分清两件不同的事（很重要）

「绑了支付方式」和「订阅付费套餐」是两回事，**结论完全不同**：

| | R2 订阅 | Workers Paid |
|---|---|---|
| 有免费额度吗 | ✅ **有**：10 GB 存储 + 1000 万次读 + 出流量免费 | ❌ **没有免费档** |
| 计费方式 | 超出免费额度才按量计费 | **每月最低 $5**，用不用都收 |
| 绑卡的作用 | **启用 R2 必须先走一次结账流程**（官方要求） | 订阅后才生效 |
| 目标 $0 的做法 | ✅ 用量控制在免费额度内即可 | ❌ 只要订阅就必然产生 $5/月 |

**官方原文（R2 Get started）**：
> "You need a Cloudflare account with an R2 subscription... Complete the checkout flow to add an R2 subscription."
> "R2 is free to get started with included free monthly usage. You are billed for your usage on a monthly basis."

所以：**R2 绑卡是必须的，绑了也能保持 $0；但 Workers Paid 一旦订阅就是 $5/月固定支出。**

→ **本项目的立场：R2 用免费额度；Workers 保持 Free 套餐，不订阅 Paid。**

### 这带来一个必须回收的结论

我在上一版文档里写过「付费版 CPU 30 秒 → 密码哈希可用」。
既然决定**不订阅 Workers Paid**，那就仍然受 **Workers Free 的 CPU 10 ms/请求**限制：

| 登录方式 | Free 套餐（10 ms CPU） |
|---|---|
| 邮箱验证码 OTP | ✅ 可用（SHA-256 比对，CPU 开销可忽略） |
| GitHub OAuth | ✅ 可用 |
| 邮箱 + 密码（PBKDF2 600k ≈ 75 ms） | ❌ **会撞 CPU 上限，不用** |

**→ 阶段 5 的登录方案回到「GitHub OAuth + 邮箱验证码」，不做密码登录。**

（如果哪天你愿意付那 $5/月，密码登录随时可以加回来，改动很小。）

## 一、R2 免费额度与守卫线

| 项目 | 免费额度 / 月 | 我给自己定的守卫线 | 说明 |
|---|---|---|---|
| 存储 | 10 GB-month | **≤ 8 GB** | 留 2 GB 余量 |
| Class A（写 / 列举） | 100 万次 | ≤ 50 万 | 上传、ListObjects 都算 |
| Class B（读） | **1000 万次** | ≤ 500 万 | 图片/音频被读取的次数 |
| 出流量 | 免费不限 | — | R2 的核心优势 |

**超出后会自动计费**（因为卡已绑定），所以守卫线比额度本身更重要。

## 二、四条硬规则（把用量压在免费额度内）

### ① 媒体必须走自定义域 + 缓存，不能直连桶

```
✅ https://static.你的域名/photos/xxx.jpg   ← 自定义域，走 Cloudflare Cache
❌ https://pub-xxxx.r2.dev/photos/xxx.jpg   ← r2.dev 是限流的开发地址，官方不建议生产
```

自定义域上再配一条 **Cache Everything** 页面规则，图片/音频会被边缘缓存住：
**同一个文件被读 1 万次，回源到 R2 的可能只有几次。**
这是把 Class B 读操作压在 1000 万以内的关键手段——否则一次热门访问就能吃掉几万次读。

### ② 运行时绝不列举桶

`ListObjects` 属于 **Class A**（贵的那一档，$4.50/百万次）。
所以**不要**在接口里 `env.BUCKET.list()` 去"看看有哪些文件"。

正确做法：**文件路径存在 D1 里**（`posts.cover`、`album_images.url`、`music.audio` 等字段），
接口只读 D1，R2 只负责按已知路径提供文件。表结构已经就是这么设计的，不用改。

### ③ 上传前先压缩

| 类型 | 建议 | 理由 |
|---|---|---|
| 照片 | 长边 ≤ 2000px，JPEG 质量 80，**单张 ≤ 300 KB** | 500 张 ≈ 150 MB |
| 音频 | 128–192 kbps MP3 | 200 首 ≈ 1.6 GB |
| 视频 | 尽量别放，或压到 720p | 视频最容易撑爆 10 GB |

按这个标准，**150 MB 照片 + 1.6 GB 音频 ≈ 1.75 GB**，离 8 GB 守卫线还很远。

### ④ 设预算告警（但要知道它只是提醒）

Cloudflare 有 **Budget alerts**：控制台 → **Manage Account → Billing → Billable Usage → Create budget alert**，
按美元阈值发邮件。建议设 **$1**，这样一有计费就能立刻知道。

同时可以在 **Notifications** 里配 **按产品的用量通知**（比如 R2 的存储字节数 / 操作数）。

⚠️ **官方明确说明：Budget alerts 只发通知，不会暂停或封顶用量。**
> "Budget alerts are informational only. They do not pause or cap usage."

所以它是"报警器"而不是"保险丝"——真正的保护还是上面那三条工程手段。

## 三、桶结构

```
my-blog-media/                ← 公开桶
├── photos/<相册slug>/<序号>.jpg
├── audio/<曲目slug>.mp3
├── covers/<文章slug>.jpg
└── avatars/<name>.png
```

绑定步骤：R2 → 选中桶 → **Settings → Custom Domains → Add** → 填 `static.你的域名`。
绑定后会自动写一条 CNAME，几分钟后从 Initializing 变成 Active。

⚠️ 自定义域要求该域名是**同一个 Cloudflare 账号下的 zone**。
免费二级域名（DNSHE 等）把 NS 整体托管给 Cloudflare 后就是一个 zone，理论上可用——
**但这一条需要你实际绑定一次验证**，检查步骤写在 DOMAIN.md 里。

## 四、成本：目标 $0

| 项目 | 预估 | 说明 |
|---|---|---|
| Pages 静态托管 | **$0** | 静态资源请求不计费、带宽不限 |
| Pages Functions（= Workers Free） | **$0** | 10 万请求/天，个人博客用不到 1/10 |
| D1（Free） | **$0** | 5 GB 存储、500 万行读/天、10 万行写/天 |
| R2（Free） | **$0** | 1.75 GB 存储 + 少量读，都在额度内 |
| 域名 | **$0** | 免费二级域名 |
| **合计** | **$0 / 月** | 只要不订阅 Workers Paid |

**唯一会让它变成 $5/月 的动作**：订阅 Workers Paid。
**唯一会让 R2 产生费用的动作**：媒体超过 10 GB，或读操作超过 1000 万次/月。

## 五、上传方式

| 方式 | 适用 | Class A 消耗 |
|---|---|---|
| R2 控制台拖拽 | 少量手动 | 每次上传 1 次 |
| **批量脚本**（阶段 3b 落地） | 首次导入、增量更新 | 每文件 1 次 |
| **后台在线上传**（阶段 4） | 日常发文配图 | 每文件 1 次 |

100 万次 Class A 意味着你可以传 100 万个文件——**上传量根本不是瓶颈**，
真正要盯的是 ② 里的"别列举桶"和 ① 里的"必须走缓存"。

## 六、数据模型不用改

媒体字段的结构原样保留，只改值的来源：

```
旧：https://cdn.jsdelivr.net/gh/you/repo@v1/audio/x.mp3
新：https://static.你的域名/audio/x.mp3
```

所以 `posts.cover`、`albums.cover`、`album_images.url`、`music.audio`、`music.cover`
**一个字段都不用动，前端代码一行都不用改。**
