/**
 * 占位封面生成器（深色版）
 * ------------------------------------------------------------
 * 为什么不用在线图床？
 *   1. 加载慢/被限流时卡片会留空灰框，看起来像坏了；
 *   2. 离线打不开，截图与演示都不稳定。
 * 所以用「确定性生成的 SVG 封面」：同一个 seed 永远得到同一张图，
 * 零请求、秒出、离线可用，配色与站点主题一致。
 *
 * 正式使用时把数据里的 cover 换成你自己的图片 URL 即可，本文件不用动。
 */

/** 确定性哈希（FNV-1a） */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 从哈希里取 [0, n) 的整数。
 * 必须做完整雪崩混合，否则相近的 seed 会落到同一分支，导致整站封面长得一样。
 */
function pickInt(h: number, salt: number, n: number): number {
  let x = (h ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  return x % n
}

/* ---------- 深色主题配色 ---------- */
const BG_A = '#241f19'
const BG_B = '#16140f'
const GRID = 'rgba(255, 255, 255, 0.05)'
const FRAME = 'rgba(255, 255, 255, 0.07)'
const MUTED = 'rgba(216, 207, 190, 0.5)'
const INK = 'rgba(237, 230, 216, 0.9)'

/** 霓虹强调色（与 tokens.css 一致） */
const NEON = [
  { c: '#c79468', g: 'rgba(199, 148, 104, 0.30)' }, // 暖金
  { c: '#ff6ec7', g: 'rgba(255, 110, 199, 0.28)' }, // 粉
  { c: '#4dd0ff', g: 'rgba(77, 208, 255, 0.26)' }, // 青
  { c: '#b388ff', g: 'rgba(179, 136, 255, 0.28)' }, // 紫
  { c: '#8fb08f', g: 'rgba(143, 176, 143, 0.26)' }, // 灰绿
]

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 所有封面共用的底板：渐变底 + 柔光 + 细网格 */
function plate(w: number, h: number, glow: string, glowX: number, glowY: number, id: string): string {
  return `
  <defs>
    <linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_A}"/>
      <stop offset="1" stop-color="${BG_B}"/>
    </linearGradient>
    <radialGradient id="glow${id}" cx="${glowX}" cy="${glowY}" r="0.7">
      <stop offset="0" stop-color="${glow}"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <pattern id="grid${id}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="${GRID}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg${id})"/>
  <rect width="${w}" height="${h}" fill="url(#grid${id})"/>
  <rect width="${w}" height="${h}" fill="url(#glow${id})"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="${FRAME}" stroke-width="1"/>`
}

/**
 * 文章 / 项目封面：横向构图（默认 1200×500，适配卡片的 12:5）
 * @param seed  一般传 slug，保证同文同图
 * @param label 可选角标（如分类名）
 */
export function coverImage(seed: string, w = 1200, h = 500, label = ''): string {
  const hsh = hash(seed)
  const neon = NEON[pickInt(hsh, 1, NEON.length)] ?? NEON[0]!
  const variant = pickInt(hsh, 2, 5)
  const flip = pickInt(hsh, 3, 2) === 1
  const pad = Math.round(Math.min(w, h) * 0.1)
  const iw = w - pad * 2
  const ih = h - pad * 2
  const id = 'c'
  const glowX = flip ? 0.72 : 0.28

  let art = ''
  if (variant === 0) {
    // 竖条纹（一条被强调色点亮）
    const bars = 9
    const bw = iw / (bars * 2 - 1)
    const lit = 2 + pickInt(hsh, 4, bars - 4)
    for (let i = 0; i < bars; i++) {
      const x = pad + bw * (i * 2)
      const ratio = 0.35 + ((hsh >> (i % 16)) % 55) / 100
      const bh = ih * Math.min(ratio, 0.95)
      const on = i === lit
      art += `<rect x="${x.toFixed(1)}" y="${(pad + ih - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${on ? neon.c : INK}" opacity="${on ? 0.95 : 0.5}"/>`
    }
  } else if (variant === 1) {
    // 大弧线
    const cx = pad + iw * (flip ? 0.34 : 0.66)
    art = `
      <path d="M${pad} ${pad + ih * 0.8} Q ${cx} ${pad + ih * 0.06} ${pad + iw} ${pad + ih * 0.8}" fill="none" stroke="${INK}" stroke-width="2.5" opacity="0.62"/>
      <path d="M${pad} ${pad + ih * 0.94} Q ${cx} ${pad + ih * 0.3} ${pad + iw} ${pad + ih * 0.94}" fill="none" stroke="${neon.c}" stroke-width="2.5" opacity="0.95"/>`
  } else if (variant === 2) {
    // 同心圆
    const cx = pad + iw * (flip ? 0.68 : 0.32)
    const cy = pad + ih * 0.5
    const r = Math.min(iw, ih) * 0.38
    art = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.55"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.38"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="${neon.c}" opacity="0.95"/>`
  } else if (variant === 3) {
    // 斜切色块
    const bx = flip ? pad : pad + iw * 0.46
    art = `
      <path d="M${bx} ${pad + ih} L${bx + iw * 0.5} ${pad} L${pad + iw} ${pad} L${pad + iw} ${pad + ih} Z" fill="${neon.c}" opacity="0.26"/>
      <path d="M${bx} ${pad + ih} L${bx + iw * 0.5} ${pad}" stroke="${neon.c}" stroke-width="2.5" opacity="0.9"/>
      <line x1="${pad}" y1="${pad + ih * 0.74}" x2="${pad + iw}" y2="${pad + ih * 0.74}" stroke="${INK}" stroke-width="2" opacity="0.45"/>`
  } else {
    // 方与三角
    const sx = pad + iw * (flip ? 0.08 : 0.52)
    art = `
      <rect x="${sx}" y="${pad + ih * 0.34}" width="${iw * 0.4}" height="${ih * 0.62}" rx="3" fill="${INK}" opacity="0.35"/>
      <path d="M${pad + iw * (flip ? 0.5 : 0.05)} ${pad + ih} L${pad + iw * (flip ? 0.74 : 0.27)} ${pad + ih * 0.12} L${pad + iw * (flip ? 0.98 : 0.49)} ${pad + ih} Z" fill="${neon.c}" opacity="0.42"/>`
  }

  const labelSvg = label
    ? `<text x="${pad}" y="${pad + 22}" font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="17" letter-spacing="3" fill="${MUTED}">${esc(label)}</text>`
    : ''

  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${plate(w, h, neon.g, glowX, 0.3, id)}
  ${art}
  ${labelSvg}
</svg>`)
}

/**
 * 相册封面：图像感构图（4 种母题）
 */
export function albumCoverImage(seed: string, w = 1200, h = 800): string {
  const hsh = hash(seed)
  const neon = NEON[pickInt(hsh, 4, NEON.length)] ?? NEON[0]!
  const variant = pickInt(hsh, 8, 4)
  const horizon = 0.52 + (pickInt(hsh, 5, 20) - 10) / 100
  const hy = Math.round(h * horizon)
  const sunX = Math.round(w * (0.18 + pickInt(hsh, 6, 64) / 100))
  const sunR = Math.round(Math.min(w, h) * (0.09 + pickInt(hsh, 9, 8) / 100))
  const id = 'a'

  let art = ''
  if (variant === 0) {
    // 落日
    art = `
      <circle cx="${sunX}" cy="${hy}" r="${sunR}" fill="${neon.c}" opacity="0.85"/>
      <rect y="${hy}" width="${w}" height="${h - hy}" fill="#0e0d0a" opacity="0.72"/>
      <rect x="0" y="${hy}" width="${w}" height="2" fill="${neon.c}" opacity="0.7"/>`
  } else if (variant === 1) {
    // 山脊
    art = `
      <circle cx="${sunX}" cy="${h * 0.34}" r="${sunR * 0.8}" fill="${neon.c}" opacity="0.75"/>
      <path d="M0 ${hy + 50} L${w * 0.22} ${hy - 80} L${w * 0.44} ${hy + 16} L${w * 0.68} ${hy - 104} L${w} ${hy + 34} L${w} ${h} L0 ${h} Z" fill="#0e0d0a" opacity="0.74"/>`
  } else if (variant === 2) {
    // 左右分栏
    art = `
      <rect x="${w * 0.58}" width="${w * 0.42}" height="${h}" fill="#0e0d0a" opacity="0.6"/>
      <circle cx="${w * 0.29}" cy="${h * 0.5}" r="${sunR}" fill="${neon.c}" opacity="0.8"/>
      <line x1="0" y1="${h * 0.78}" x2="${w}" y2="${h * 0.78}" stroke="${FRAME}" stroke-width="2"/>`
  } else {
    // 横向条纹
    const n = 6
    for (let i = 0; i < n; i++) {
      art += `<rect x="0" y="${(h / n) * i}" width="${w}" height="${h / n - 3}" fill="rgba(255,255,255,${i % 2 === 0 ? 0.02 : 0.045})"/>`
    }
    art += `
      <rect x="${sunX - sunR}" y="${h * 0.5 - sunR}" width="${sunR * 2}" height="${sunR * 2}" rx="4" fill="${neon.c}" opacity="0.7"/>
      <rect x="0" y="${hy}" width="${w}" height="2" fill="${INK}" opacity="0.4"/>`
  }

  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${plate(w, h, neon.g, 0.5, 0.2, id)}
  ${art}
</svg>`)
}

/**
 * 头像占位：底色圆 + 首字
 */
export function avatarImage(seed: string, ch: string, size = 200): string {
  const hsh = hash(seed)
  const neon = NEON[pickInt(hsh, 7, NEON.length)] ?? NEON[0]!
  const id = 'v'
  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="ab${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${neon.c}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${neon.c}" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${BG_A}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.42}" fill="url(#ab${id})"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
        font-size="${size * 0.44}" font-weight="600" fill="#16140f">${esc(ch)}</text>
</svg>`)
}
