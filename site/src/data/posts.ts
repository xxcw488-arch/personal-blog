/* eslint-disable */
import { coverImage } from '@/utils/cover'

/**
 * 原创示例文章（阶段 1 的 mock 数据）
 *
 * 说明：这些内容是为演示排版而原创撰写的占位文章，不复制参考站点的任何文字。
 * 阶段 3 接上 D1 后，本文件被 /api/wp/posts 取代（组件无需修改）。
 */

export interface RawPost {
  id: number
  slug: string
  title: string
  excerpt: string
  content: string
  contentFormat: 'markdown' | 'html'
  cover: string
  coverCaption?: string
  categorySlug: string
  tagSlugs: string[]
  views: number
  readingTime: number
  isTop: boolean
  publishedAt: string
  updatedAt: string
}

/** 占位封面：本地确定性生成，不依赖外网，永远不会出现空灰框。
 *  换成自己的图片时，把这里的调用改成图片 URL 字符串即可。 */
const pic = (seed: string, w = 1600, h = 1000) => coverImage(seed, w, h)

export const rawCategories = [
  { id: 1, name: '技术', slug: 'tech', description: '工程实践、架构取舍与踩坑记录' },
  { id: 2, name: '设计', slug: 'design', description: '排版、界面与视觉观察' },
  { id: 3, name: '生活', slug: 'life', description: '日常碎片与旅行笔记' },
  { id: 4, name: '随笔', slug: 'essay', description: '想到哪写到哪' },
]

export const rawTags = [
  { id: 1, name: '前端', slug: 'frontend' },
  { id: 2, name: 'Vue', slug: 'vue' },
  { id: 3, name: 'Cloudflare', slug: 'cloudflare' },
  { id: 4, name: '排版', slug: 'typography' },
  { id: 5, name: '性能', slug: 'performance' },
  { id: 6, name: '数据库', slug: 'database' },
  { id: 7, name: '摄影', slug: 'photography' },
  { id: 8, name: '随想', slug: 'thoughts' },
]

export const rawPosts: RawPost[] = [
  {
    id: 1,
    slug: 'why-i-built-a-magazine-style-blog',
    title: '我为什么把博客做成一本杂志',
    excerpt:
      '博客不必长得像后台管理系统。当文字成为主角，排版就不再是装饰，而是阅读体验本身。这是我放弃卡片流、转向杂志排版的全部理由。',
    content: `## 从一个不舒服的感觉说起

我看了很多个人博客，它们大多长成同一个样子：顶部一个导航条，下面一片等宽的卡片流，每张卡片一张图、一个标题、两行摘要。信息很整齐，但我每次读完之后，都说不出刚才那篇文章讲的是什么。

问题不在内容，在**排版的优先级**。卡片流把每篇文章压缩成同等重量的一格，于是所有文章都变得一样重要——也就一样不重要。

## 杂志是怎么解决这件事的

杂志编辑有一整套成熟的视觉等级制度：

- **头条**占最大版面，配大图，标题字号是内文的数倍，明确告诉你"先读这个"；
- **次级**文章用中等卡片，形成节奏；
- **短讯**挤在侧栏，字号最小，供扫读。

一页之内，读者的视线路径是被**设计过的**。

> 排版不是把字放上去，而是决定读者的眼睛先落在哪里、停留多久、然后去哪。

## 落到实现上

我给自己定了几条硬规则：

1. **标题用衬线，正文用无衬线。** 衬线字体自带"印刷品"的心理暗示，而无衬线在小字号长文下更清晰。这个搭配几乎不会出错。
2. **正文行宽控制在 34em 左右。** 一行超过 45 个汉字，眼睛回行就容易串行。
3. **首字下沉只用在文章首段。** 用多了就成了花哨。
4. **强调色只出现三处以内。** 一页里到处都是红色，等于没有重点。

### 一个具体的取舍

我一度想给每篇文章都配一张封面大图。后来放弃了：**没有合适的图，比放一张不合适的图更好。** 所以数据模型里 \`cover\` 允许为空，为空时列表走纯文字排版，靠字号和分割线拉开层次。

\`\`\`css
/* 无封面时的卡片：靠字阶而不是图片建立层次 */
.card--text-only .card__title {
  font-size: var(--fs-xl);
  line-height: 1.3;
}
\`\`\`

## 代价是什么

杂志排版更难"填满"。卡片流随便塞十篇都整齐，杂志版式里少一篇就是一块空洞。

这迫使我写得更少、更认真一点。对我而言，这不是缺点。

## 小结

把博客做成杂志，本质上是**承认文字有重量差异**。头版给值得头版的东西，其余的位置留给其余的分量。`,
    contentFormat: 'markdown',
    cover: pic('magazine-desk', 1600, 1000),
    coverCaption: '排版是在一张纸上安排注意力',
    categorySlug: 'design',
    tagSlugs: ['typography', 'frontend'],
    views: 1284,
    readingTime: 6,
    isTop: true,
    publishedAt: '2026-03-18T09:20:00Z',
    updatedAt: '2026-03-19T14:02:00Z',
  },
  {
    id: 2,
    slug: 'cloudflare-pages-functions-d1-notes',
    title: '用 Cloudflare Pages + Functions + D1 搭后端的取舍笔记',
    excerpt:
      '无服务器不等于没有约束。免费额度里的 CPU 时间、单次查询数、文件体积，会实打实地改写你的架构决策。这是我在动手前先算清楚的几笔账。',
    content: `## 先说结论

对个人博客这种体量，Cloudflare 这套组合几乎是最优解。但"免费"是有形状的，你得顺着它的形状设计。

## 三笔必须提前算的账

### 一、CPU 时间是 10 毫秒，不是 30 秒

免费版的 Workers 每个请求只有 **10ms CPU 时间**。注意它只算 CPU 真正在执行的时间，等数据库、等网络都不算。

这意味着：**密码哈希这种故意设计得"很慢"的操作，在这里是奢侈品。** 我实测了一下 PBKDF2-SHA256：

| 迭代次数 | CPU 耗时 |
| --- | --- |
| 100,000 | 约 15 ms |
| 210,000 | 约 27 ms |
| 600,000 | 约 75 ms |

一行就超了。所以邮箱登录我改用**验证码**方案：存的是 SHA-256 哈希，计算量可以忽略，安全性靠"短期有效 + 限次尝试"来保证。

> 结论：在无服务器环境里选算法，要先看它的**计算成本**，再看它的**密码学强度**。

### 二、单次调用最多 50 条查询

D1 免费版每次 Worker 调用最多 50 个查询。这条限制的实际含义是：**禁止 N+1。**

错误的写法——列表里每篇文章查一次标签：

\`\`\`js
// 10 篇文章 = 11 次查询，看起来还好
// 但加上分类、作者、评论数，很快就撞天花板
for (const post of posts) {
  post.tags = await db.prepare('SELECT * FROM tags WHERE post_id = ?').bind(post.id).all()
}
\`\`\`

正确的写法——一次 JOIN 拿全，再在内存里归并：

\`\`\`sql
SELECT p.*, t.name AS tag_name
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t       ON t.id = pt.tag_id
WHERE p.status = 'published'
ORDER BY p.published_at DESC
LIMIT ? OFFSET ?
\`\`\`

### 三、单个文件不能超过 25 MiB

Pages 免费版单文件上限 25 MiB，站点最多 20,000 个文件。所以**音频和图片不要塞进 Pages**，丢到对象存储或 CDN 上。

## 数据库是单线程的

D1 的每个库背后是单个 Durable Object，**查询是串行执行的**。所以吞吐量直接由查询耗时决定：

- 平均查询 1ms → 约 1000 QPS
- 平均查询 100ms → 约 10 QPS

个人博客当然够用，但它提醒你：**索引不是优化项，是生存项。**

## 一个容易被忽略的坑

SPA 部署到 Pages 时，如果没配路由声明，\`/api/*\` 也会被回落到 \`index.html\`。于是前端拿到一坨 HTML 去 \`JSON.parse\`，报一个莫名其妙的错。

用 \`_routes.json\` 明确声明哪些路径交给 Functions：

\`\`\`json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
\`\`\`

## 小结

无服务器的真正工作，是**把平台约束翻译成架构决策**。先读限额文档，再动手写第一行代码，能省掉一次重写。`,
    contentFormat: 'markdown',
    cover: pic('server-room', 1600, 1000),
    coverCaption: '边缘计算的账，要提前算',
    categorySlug: 'tech',
    tagSlugs: ['cloudflare', 'database', 'performance'],
    views: 2031,
    readingTime: 8,
    isTop: true,
    publishedAt: '2026-03-15T11:05:00Z',
    updatedAt: '2026-03-16T08:40:00Z',
  },
  {
    id: 3,
    slug: 'typography-details-that-matter',
    title: '真正影响阅读体验的七个排版细节',
    excerpt:
      '行高、行宽、字距、标点避头尾……这些词听起来很枯燥，但它们决定了读者是读完还是划走。这里是我反复调整后留下来的七个参数。',
    content: `## 排版是阅读的物理层

内容再好，读起来累就是读不完。下面七个细节，是我改过很多遍之后稳定下来的值。

## 一、行高 1.7 ~ 1.85

中文没有西文的词间空格，字块更密，所以行高要比西文排版更大。**1.5 对中文偏挤，1.9 以上又显得松散。**

## 二、行宽 34em 左右

一行超过 45 个汉字，回行时容易串行；少于 25 个，视线要频繁折返。34em 是个舒服的中间值。

\`\`\`css
.prose {
  max-width: 34em;
  font-size: 1.0625rem;
  line-height: 1.85;
}
\`\`\`

## 三、段落间距要大于行距

如果段间距和行距接近，读者分不清是换行还是换段。**段间距至少是行距的 1.2 倍。**

## 四、标点符号的视觉平衡

中文标点占一个全角宽度，右引号、句号后面会留出一块视觉空洞。可以用字距微调收一收：

\`\`\`css
.prose p {
  text-spacing-trim: trim-start; /* 渐进增强，不支持也不影响 */
}
\`\`\`

## 五、首字下沉只用在首段

它是个强提示，用两次以上就变成噪声。而且小屏上要缩小字号，否则会撑破版心。

## 六、链接要能一眼看出是链接

只用颜色区分不够——色觉障碍用户看不出。**颜色 + 下划线**才是稳妥组合：

\`\`\`css
.prose a {
  color: var(--c-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
\`\`\`

## 七、暗色模式不是反色

直接黑白反转会让文字在暗底上"发光"，非常刺眼。正确做法是**降低对比度**：正文用 \`#e8e4dc\` 这类带一点暖调的浅灰，而不是纯白 \`#fff\`。

> 暗色模式的目的是"夜间不刺眼"，不是"把浅色模式取反"。

## 一个可量化的检验方法

把文章截图，眯起眼睛看。如果能看到清晰的**行纹**（一条条水平灰带），说明行高和字号的比例是对的；如果糊成一片灰块，回去调行高。

## 小结

这七个参数没有一个是靠审美拍出来的，全都是"读起来累不累"倒推出来的。排版的好，就是读者根本注意不到排版。`,
    contentFormat: 'markdown',
    cover: pic('type-specimen', 1600, 1000),
    coverCaption: '字距与行高：看不见的设计',
    categorySlug: 'design',
    tagSlugs: ['typography'],
    views: 876,
    readingTime: 5,
    isTop: false,
    publishedAt: '2026-03-12T16:30:00Z',
    updatedAt: '2026-03-12T16:30:00Z',
  },
  {
    id: 4,
    slug: 'vue3-composition-api-in-practice',
    title: 'Vue 3 Composition API 里那些真正省事的写法',
    excerpt:
      '组合式函数不是语法糖，它是一种把"有状态逻辑"当函数复用的思路。这里记录几个我反复用、并且确实减少了代码量的模式。',
    content: `## 从"逻辑跟着组件走"到"逻辑随时可用"

Options API 里，复用逻辑主要靠 mixin。mixin 的问题是：**你不知道它往组件里塞了什么东西。** 变量来源不明、命名冲突、调试困难。

Composition API 把这件事变成了普通的函数调用——逻辑在哪来、返回了什么，一眼可见。

## 模式一：把状态和它的操作封在一起

\`\`\`ts
// composables/useTheme.ts
import { ref, watchEffect } from 'vue'

export function useTheme() {
  // 状态和它的读写逻辑在同一个作用域里，读代码不用跳文件
  const theme = ref<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light'
  )

  const toggle = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // 副作用紧随其状态，不会散落各处
  watchEffect(() => {
    document.documentElement.dataset.theme = theme.value
    localStorage.setItem('theme', theme.value)
  })

  return { theme, toggle }
}
\`\`\`

## 模式二：模块级单例状态

不引 Pinia 也能做全局状态——把 \`ref\` 定义在模块顶层即可：

\`\`\`ts
// 模块只执行一次，所有 import 它的组件共享同一个 ref
const drawerOpen = ref(false)

export function useDrawer() {
  return { drawerOpen }
}
\`\`\`

什么时候该换成 Pinia？我的判断标准是：**需要 devtools 调试、需要 getter 缓存、或者状态之间有关联操作时**，才上 Pinia。

## 模式三：用 computed 代替 watch

很多人用 \`watch\` 去同步两个状态，其实大部分场景 \`computed\` 更合适：

\`\`\`ts
// 不推荐：手动同步，容易漏掉分支
watch(keyword, (v) => {
  filtered.value = list.value.filter((i) => i.title.includes(v))
})

// 推荐：派生值自动跟随，没有同步时机问题
const filtered = computed(() =>
  list.value.filter((i) => i.title.includes(keyword.value))
)
\`\`\`

> 能推导出来的值就不要存。多存一份状态，就多一份不一致的可能。

## 模式四：显式声明副作用清理

\`\`\`ts
onMounted(() => {
  const onScroll = () => { /* ... */ }
  window.addEventListener('scroll', onScroll, { passive: true })
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
})
\`\`\`

把"添加"和"移除"写在相邻位置，比分散在 \`mounted\` / \`unmounted\` 两个钩子里更难出错。

## 小结

Composition API 真正的收益不是写起来短，而是**逻辑的边界变清晰了**：一个函数进来，一个明确的对象出去，中间不碰全局。`,
    contentFormat: 'markdown',
    cover: pic('code-editor', 1600, 1000),
    categorySlug: 'tech',
    tagSlugs: ['vue', 'frontend'],
    views: 1547,
    readingTime: 7,
    isTop: false,
    publishedAt: '2026-03-08T10:15:00Z',
    updatedAt: '2026-03-10T09:00:00Z',
  },
  {
    id: 5,
    slug: 'a-walk-in-the-old-town',
    title: '老城区的一下午',
    excerpt:
      '没有目的地，只是沿着巷子往里走。拍了一些没什么意义的照片——大概正因为没有意义，才值得留下来。',
    content: `## 出门的理由

那天下午本来打算改 bug。代码写到一半，发现是个第三方库的边界问题，一时半会解不了。索性关了编辑器出门。

## 巷子

老城区的巷子有一种特别的尺度：宽不过两三米，两侧的墙把天空切成长长的一条。抬头看的时候，会觉得天只有那么窄——但走进去之后，一点都不觉得压抑。

墙上有各种年代的痕迹：八十年代的水泥修补、两千年的瓷砖贴面、去年刚刷的灰色涂料。它们叠在一起，像一份没整理过的地层档案。

## 拍了什么

说实话，没拍什么"作品"。几张斑驳的墙、一只在电动车上睡觉的猫、一个卖糖水的摊子。

> 有些照片不需要表达什么。它只是证明：**这个下午，我在这里。**

## 关于"记录"

我一直在想博客里的相册和"碎碎念"到底有什么用。它们没有信息量，不能教别人什么，甚至过几年自己都记不起当时在想什么。

但也许这就是用处。

## 回来的路上

绕了一圈，最后从一条完全没走过的路出来，发现出口就在家门口那条街。有些路就是这样，你得走一遍才知道它通向哪。

那天晚上回去，bug 还是没解。但心情好了。`,
    contentFormat: 'markdown',
    cover: pic('old-town-alley', 1600, 1000),
    coverCaption: '墙上的年代层',
    categorySlug: 'life',
    tagSlugs: ['photography', 'thoughts'],
    views: 523,
    readingTime: 4,
    isTop: false,
    publishedAt: '2026-03-05T20:40:00Z',
    updatedAt: '2026-03-05T20:40:00Z',
  },
  {
    id: 6,
    slug: 'indexes-are-not-optional',
    title: '索引不是优化项，是生存项',
    excerpt:
      '在单线程数据库上用 OFFSET 翻页、在全表扫描上做模糊搜索，都会在某一天突然变成灾难。这里是我踩过的三个性能坑。',
    content: `## 一开始都很快

一千条数据的时候，什么查询都是"瞬间"。于是很容易得出一个错误结论：**不用管索引。**

直到某天列表页要转三秒，你才回去翻 SQL。

## 坑一：深分页的 OFFSET

\`\`\`sql
SELECT * FROM posts ORDER BY published_at DESC LIMIT 10 OFFSET 10000
\`\`\`

数据库必须先扫描并丢弃前 10000 行。页码越深越慢，而且是线性变慢。

改用游标分页——记住上一页最后一条的时间戳：

\`\`\`sql
SELECT * FROM posts
WHERE published_at < ?   -- 上一页最后一条的时间
ORDER BY published_at DESC
LIMIT 10
\`\`\`

配合 \`(status, published_at)\` 索引，无论翻到第几页都是毫秒级。

## 坑二：LIKE '%关键词%'

前置通配符让索引彻底失效，只能全表扫。而且 D1 对 \`LIKE\` 模式串还有 **50 字节**的长度限制。

个人博客的替代方案很朴素：**数据量小，全表扫就全表扫，但限制频次。** 别让它成为可被反复触发的昂贵操作。

## 坑三：复合索引的列顺序

\`\`\`sql
-- 索引 (status, published_at)
WHERE status = 'published' ORDER BY published_at DESC  -- ✅ 用得上
WHERE published_at > '2026-01-01'                        -- ❌ 用不上（跳过了最左列）
\`\`\`

**最左前缀原则**：复合索引只能从最左列开始连续匹配。

- \`(a, b, c)\` 能支持 \`a\`、\`(a,b)\`、\`(a,b,c)\`；
- 支持不了 \`b\`、\`(b,c)\`。

所以列的顺序要按**查询的过滤顺序**排，把等值条件放前面，范围条件放后面。

## 怎么发现慢查询

别靠猜。逐步删减 WHERE 条件，看执行时间在哪一步跳变——跳变点就是你缺索引的地方。

## 小结

在单线程数据库上，**查询耗时直接等于吞吐上限**。索引不是"性能优化"，它是系统能不能撑住的前提。`,
    contentFormat: 'markdown',
    cover: pic('database-abstract', 1600, 1000),
    categorySlug: 'tech',
    tagSlugs: ['database', 'performance'],
    views: 1673,
    readingTime: 6,
    isTop: false,
    publishedAt: '2026-02-28T14:20:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 7,
    slug: 'on-writing-regularly',
    title: '写了半年之后，我对"坚持写作"的看法变了',
    excerpt:
      '一开始我以为难点是灵感，后来发现是别的东西。这篇没什么方法论，只是一些不太体面的真实感受。',
    content: `## 最开始的想法

我以为写作的难点在于"没有灵感"。所以给自己定了个规矩：有想法就立刻记下来，攒够了再写。

半年下来，我的感受是：**灵感从来不是问题，开始才是。**

## 真正卡住我的三件事

### 一、总想写得"值得发"

每次打开编辑器，脑子里都有个声音在问：这篇东西有人看吗？会不会太浅了？

于是草稿箱里躺了十几篇半成品。

后来我换了个标准：**先写给自己看。** 如果三个月后的自己读起来还能有点收获，就发。

### 二、把"记录"和"创作"混在一起

有些内容只是备忘——某个配置怎么写、某个坑怎么绕。我一开始也想把它们写成有起承转合的文章，结果每一篇都写不完。

分开就好了：**备忘就按备忘写，短、直接、能查。**

### 三、追求"完成度"

我一度给每篇文章都配图、配引用、反复润色。一篇文章要耗掉一个周末。

现在我的做法是先写正文，写完就发。图和引用想起来再加。

> 完成度是个陷阱。它让"发布"这件事变得太贵，而太贵的事情最后就不会发生。

## 有什么变化

写到现在，最大的变化不是文笔变好，而是**我发现自己想事情更清楚了**。

写的时候被迫把模糊的感觉变成具体的句子，很多原以为想明白的事情，一落笔就发现其实是乱的。

## 还是没做到的

- 更新频率依然不稳定，忙起来就断更；
- 有些开头写了三段就烂尾了，至今躺在草稿箱；
- 回过头看早期的文章，有些观点已经不认同了。

我不打算删它们。**那些不成熟的想法，也是记录的一部分。**

## 小结

如果非要给一条建议：**降低发布的门槛，提高放弃的门槛。** 写得烂也发出去，比憋一篇完美的永远不发要好。`,
    contentFormat: 'markdown',
    cover: pic('writing-desk-night', 1600, 1000),
    categorySlug: 'essay',
    tagSlugs: ['thoughts'],
    views: 934,
    readingTime: 5,
    isTop: false,
    publishedAt: '2026-02-22T21:10:00Z',
    updatedAt: '2026-02-22T21:10:00Z',
  },
  {
    id: 8,
    slug: 'building-a-serverless-comment-system',
    title: '从零做一个无服务器评论系统，我跳过了哪些坑',
    excerpt:
      '评论是最容易被低估的功能：它涉及身份认证、内容安全、垃圾过滤和数据库写入。这里记录我的方案与每一个放弃的选项。',
    content: `## 先明确要解决什么

评论系统的需求可以拆成四块，缺一个都不完整：

1. **身份**——谁在说话
2. **存储**——评论存在哪、怎么查
3. **安全**——垃圾、注入、刷屏
4. **体验**——发完立刻看到，不用刷新

## 身份：为什么不自己存密码

自己实现账号密码，意味着要处理：密码哈希（CPU 贵）、找回密码（要发邮件）、撞库防护、会话管理。对一个博客来说，这些成本远超收益。

我的选择是**第三方 OAuth**：把身份验证外包出去，自己只存一个稳定的用户 ID 和昵称头像。

\`\`\`ts
// 登录成功后，只落这四样东西
interface CommentUser {
  provider: 'github'        // 来源
  providerUid: string       // 稳定 ID
  login: string             // 昵称
  avatar: string            // 头像
}
\`\`\`

因为**邮箱可能被改，UID 不会。** 用 UID 做唯一标识，改名换邮箱都不影响历史评论。

## 存储：一张表管三种评论

文章评论、碎碎念评论、留言板，本质是同一种东西。所以我用一张表加一个类型字段：

\`\`\`sql
CREATE TABLE comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type  TEXT    NOT NULL,   -- post | moment | guestbook
  target_id    INTEGER NOT NULL,
  parent_id    INTEGER NOT NULL DEFAULT 0,  -- 0 表示顶层
  content      TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'approved',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_target
  ON comments(target_type, target_id, created_at DESC);
\`\`\`

嵌套用 \`parent_id\` 自关联，但只允许**两层**——无限嵌套在前端既难渲染也难读。

## 安全：三道闸

### 一、内容转义

绝不把用户输入直接塞进 HTML。前端渲染用 \`textContent\` 或转义后再插入。

### 二、写入限流

按 IP 哈希记次数，同一来源短时间内超过阈值就拒掉。IP **不存明文**，只存加盐哈希：

\`\`\`ts
const ipHash = await sha256(ip + env.IP_SALT)
\`\`\`

这样既能去重统计，又不持有可追溯的个人信息。

### 三、审核状态机

\`pending → approved\`，或直接 \`spam\`。新用户的前几条默认进 \`pending\`，由后台放行。

## 体验：乐观更新

发完评论立刻插到列表里，带上"发送中"的浅色状态，失败了再撤回并提示。**别让用户对着原地不动的列表等。**

## 我放弃的选项

| 方案 | 为什么不用 |
| --- | --- |
| 第三方评论插件 | 数据在别人手里，样式难改，可能加载慢或被墙 |
| 自建账号密码 | 哈希、找回、防撞库成本太高，见上文 |
| 无限嵌套回复 | 前端难渲染，移动端基本没法读 |
| 实时 WebSocket | 博客没那么高频，轮询或手动刷新足够 |

## 小结

评论系统的复杂度几乎全在"不要自己做身份认证"这一条上。把这块外包出去，剩下的就是一个带限流的普通 CRUD。`,
    contentFormat: 'markdown',
    cover: pic('conversation', 1600, 1000),
    categorySlug: 'tech',
    tagSlugs: ['cloudflare', 'database', 'frontend'],
    views: 1102,
    readingTime: 7,
    isTop: false,
    publishedAt: '2026-02-18T13:00:00Z',
    updatedAt: '2026-02-20T11:30:00Z',
  },
]
