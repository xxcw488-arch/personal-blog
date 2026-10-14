/**
 * Markdown 渲染
 * ------------------------------------------------------------
 * 用 marked 解析 + DOMPurify 消毒。
 * 消毒不是可选项：正文可能来自后台录入，一旦混入脚本就是 XSS。
 */

import { marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'

// 杂志排版需要给图片套 figure/figcaption，这里改写渲染器
const renderer = new marked.Renderer()

const originalImage = renderer.image.bind(renderer)
// marked v15 的 image 回调接收完整的 Tokens.Image，因此这里保持同样的签名
renderer.image = function (token: Tokens.Image) {
  const img = originalImage(token)
  const caption = token.title || token.text
  if (!caption) return `<p class="md-img">${img}</p>`
  return `<figure>${img}<figcaption>${caption}</figcaption></figure>`
}

marked.setOptions({
  renderer,
  gfm: true,
  breaks: false,
})

/** 把 Markdown 渲染成安全的 HTML */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'loading', 'srcset'],
    ADD_TAGS: ['figure', 'figcaption'],
  })
}

/** 按内容格式渲染（自动区分 markdown / html） */
export function renderContent(content: string, format: 'markdown' | 'html'): string {
  if (format === 'html') {
    return DOMPurify.sanitize(content, {
      ADD_ATTR: ['target', 'loading', 'srcset'],
      ADD_TAGS: ['figure', 'figcaption'],
    })
  }
  return renderMarkdown(content)
}

/** 从 Markdown 提取纯文本（用于搜索与摘要） */
export function markdownToPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
