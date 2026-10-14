<script setup lang="ts">
/**
 * SiteBackdrop —— 全站统一背景层（程序化"照片质感"）
 * ------------------------------------------------------------
 * **这是全站唯一的背景来源。** 所有页面（首页首屏、文章列表、文章详情、
 * 相册……）共用这一层，所以「换背景」只需要改这一个文件，
 * 不存在某个页面漏改、和别处不一致的可能。
 *
 * 实现方式：`position: fixed; inset: 0`，永远铺满视口。
 * 页面滚动时背景不动（相当于一面固定的"窗"），
 * 因此不论页面多长，每一屏看到的背景构图都是同一套，
 * 不会出现"背景被拉长变形"或"只出现在首页"的问题。
 *
 * 参考站的首屏是一段循环视频（水下光线 + 角色漂浮）。
 * 本项目不引用任何外部素材，用**纯 CSS 多层渐变 + SVG 噪声滤镜**
 * 合成等价的静态底图：
 *
 *   ① 水下光束（rays）—— 斜射光柱，照片感最强的一层；
 *   ② 水面横带（surface）—— 上暗下亮的水下分层；
 *   ③ 水光焦散 ×3（caustics）—— 三种尺度交叠、反向漂移的网状光斑；
 *   ④ 中央光晕（bloom）—— 画面中心一团柔光，撑起视觉重心；
 *   ⑤ 焦外光斑 ×4（bokeh）—— 大半径低透明度柔光，冷暖对撞制造色散感；
 *   ⑥ 胶片颗粒（grain）—— SVG feTurbulence 分形噪声，消除"塑料感"；
 *   ⑦ 暗角（vignette）—— 四周压暗，把视线收拢到画面中心；
 *   ⑧ 可读性遮罩（veil）—— 保证正文在任何一屏都够对比度。
 *
 * 全部由 CSS 自定义属性驱动，因此换主题时无需改这个文件。
 */
</script>

<template>
  <!-- 背景层整块 aria-hidden：纯装饰，不该进无障碍树 -->
  <div class="site-bg" aria-hidden="true">
    <!-- ① 水下光束：从顶部斜射进来的光柱，是"照片感"里最强的一层 -->
    <div class="site-bg__rays" />
    <!-- ② 水面横带：把画面切成"上暗下亮"的水下分层 -->
    <div class="site-bg__surface" />
    <!-- ③ 水光焦散：三种尺度交叠、反向漂移的网状光斑 -->
    <div class="site-bg__caustics site-bg__caustics--a" />
    <div class="site-bg__caustics site-bg__caustics--b" />
    <div class="site-bg__caustics site-bg__caustics--c" />

    <!-- ④ 中央光晕：画面的视觉重心 -->
    <div class="site-bg__bloom" />

    <!-- ⑤ 焦外光斑：暖金左上、冷青右下、紫调偏右、青色补左 -->
    <div class="site-bg__bokeh site-bg__bokeh--warm" />
    <div class="site-bg__bokeh site-bg__bokeh--cool" />
    <div class="site-bg__bokeh site-bg__bokeh--violet" />
    <div class="site-bg__bokeh site-bg__bokeh--aqua" />

    <!-- ⑥ 胶片颗粒 + ⑦ 暗角 + ⑧ 可读性遮罩 -->
    <div class="site-bg__grain" />
    <div class="site-bg__vignette" />
    <div class="site-bg__veil" />
  </div>
</template>

<style scoped>
.site-bg {
  /* fixed 而不是 absolute：背景固定铺满视口，滚动时不跟着页面走。
     这样再长的页面，每一屏看到的都是同一套构图，
     也让「所有页面背景一致」这件事在结构上就成立。 */
  position: fixed;
  inset: 0;
  z-index: var(--z-backdrop);
  overflow: hidden;
  pointer-events: none;
  /* 底色：不依赖图片，任何情况下都不会白屏 */
  background:
    radial-gradient(120% 90% at 22% 12%, var(--bg-photo-base-3) 0%, transparent 62%),
    linear-gradient(
      155deg,
      var(--bg-photo-base-1) 0%,
      var(--bg-photo-base-2) 58%,
      var(--bg-photo-base-3) 100%
    );
}

/* ---------- ⑧ 可读性遮罩 ----------
   原先挂在首屏内部（.hero__veil），只保护首页文字；
   现在并入背景层，全站每一屏都吃到同一层遮罩 ——
   既保证内页正文可读，又让「首页背景 == 内页背景」严格成立。
   中性纯黑/纯白，不带色相，色相全部交给下面的渐变层。 */
.site-bg__veil {
  position: absolute;
  inset: 0;
  background: var(--bg-veil);
}

/* ---------- ① 水下光束 ----------
   用 repeating-linear-gradient 做斜向条纹，再用 mask 把它
   约束成"顶部亮、往下散开"的光柱形状。 */
.site-bg__rays {
  position: absolute;
  inset: -30% -20% 0;
  background: repeating-linear-gradient(
    104deg,
    transparent 0 46px,
    var(--bg-photo-caustic) 46px 62px,
    transparent 62px 132px
  );
  opacity: 0.22;
  mix-blend-mode: screen;
  filter: blur(14px);
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9) 0%, transparent 72%);
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9) 0%, transparent 72%);
  animation: hero-rays 26s ease-in-out infinite;
}
:root[data-theme='light'] .site-bg__rays {
  mix-blend-mode: multiply;
  opacity: 0.14;
}

/* ---------- ② 水面横带 ----------
   一条水平的明暗交界，制造"水面"和"水下"的空间分层。
   峰值刻意压低（0.5）——照片的高光不该是纯白，会像贴片。 */
.site-bg__surface {
  position: absolute;
  left: -10%;
  right: -10%;
  top: 26%;
  height: 52%;
  background: radial-gradient(
    74% 40% at 46% 52%,
    var(--bg-photo-caustic) 0%,
    transparent 66%
  );
  opacity: 0.5;
  mix-blend-mode: screen;
  filter: blur(46px);
}
:root[data-theme='light'] .site-bg__surface {
  mix-blend-mode: multiply;
  opacity: 0.22;
}

/* 用遮罩把焦散约束成"中间亮、四周散"的水面感 */
.site-bg__caustics {
  position: absolute;
  inset: -18%;
  background-repeat: repeat;
  /* 水光纹是"照片质感"的主力：之前 0.26 再叠上 0.5 的遮罩，
     几乎什么都看不见（实测首屏除标题外一片平坦）。
     参考站的水光是明显可见的亮网，这里提到 0.4/0.28。 */
  opacity: 0.4;
  mix-blend-mode: screen;
  /* 大半径模糊是"照片"和"圆点阵"的分界线：
     不模糊的话，重复的 radial-gradient 会露出规则的圆点网格 */
  filter: blur(22px);
  will-change: transform;
}
:root[data-theme='light'] .site-bg__caustics {
  /* 浅底上用 multiply 才会有"水印"的实体感，screen 会直接糊成一片白。
     透明度不能压太低：原来 0.18 叠上浅色遮罩后，
     实测首屏标准差只剩 2~5（一张白纸），水面质感消失。
     现在跟深色主题取同一个量级。 */
  mix-blend-mode: multiply;
  opacity: 0.34;
}

/* 斜向的细网：模拟水面折射出的亮线 */
.site-bg__caustics--a {
  background-image:
    radial-gradient(circle at 30% 30%, var(--bg-photo-caustic) 0%, transparent 12%),
    radial-gradient(circle at 70% 62%, var(--bg-photo-caustic) 0%, transparent 9%),
    radial-gradient(circle at 18% 78%, var(--bg-photo-caustic) 0%, transparent 10%);
  background-size: 260px 260px;
  transform: rotate(-8deg) scale(1.1);
  animation: hero-caustics-a 34s ease-in-out infinite;
}

/* 另一层错开角度与网格尺寸，两层交叠才不会看出重复的棋盘格 */
.site-bg__caustics--b {
  background-image:
    radial-gradient(circle at 55% 28%, var(--bg-photo-caustic) 0%, transparent 8%),
    radial-gradient(circle at 22% 55%, var(--bg-photo-caustic) 0%, transparent 11%);
  background-size: 190px 190px;
  opacity: 0.16;
  transform: rotate(14deg) scale(1.16);
  animation: hero-caustics-b 43s ease-in-out infinite reverse;
}
:root[data-theme='light'] .site-bg__caustics--b {
  opacity: 0.22;
}

/* 第三层：更细的网格，专门负责"近处水面"的细节。
   只有两层时画面偏"大块平涂"，加一层细网后纵深才出来。
   透明度最低、模糊最小，避免抢掉前两层的结构。 */
.site-bg__caustics--c {
  background-image:
    radial-gradient(circle at 42% 18%, var(--bg-photo-caustic) 0%, transparent 6%),
    radial-gradient(circle at 78% 72%, var(--bg-photo-caustic) 0%, transparent 5%),
    radial-gradient(circle at 12% 46%, var(--bg-photo-caustic) 0%, transparent 7%);
  background-size: 130px 130px;
  opacity: 0.14;
  filter: blur(12px);
  transform: rotate(-21deg) scale(1.22);
  animation: hero-caustics-c 57s ease-in-out infinite;
}
:root[data-theme='light'] .site-bg__caustics--c {
  opacity: 0.18;
}

/* ---------- ④ 中央光晕 ----------
   这是角色移除后**接管视觉重心**的一层。
   参考站首屏中央是"角色 + 水下亮区"，角色去掉后若只留平铺的水纹，
   画面中心会空掉、标题像浮在空背景上。
   这里用一团大半径柔光把中心"点亮"，让视线自然落到标题上。
   刻意做成椭圆（横向更宽）以匹配文字块的形状。 */
.site-bg__bloom {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(120vw, 1500px);
  height: min(78vh, 760px);
  translate: -50% -50%;
  background: radial-gradient(
    50% 50% at 50% 50%,
    var(--bg-photo-bloom) 0%,
    transparent 68%
  );
  opacity: 0.6;
  mix-blend-mode: screen;
  filter: blur(60px);
  animation: hero-bloom 30s ease-in-out infinite;
}
:root[data-theme='light'] .site-bg__bloom {
  /* 浅底上 screen 会把中心提成纯白（比四周还亮，反而像脏点），
     改用 multiply 让中心成为"水更清透"的一区。 */
  mix-blend-mode: multiply;
  opacity: 0.3;
}

/* ---------- ⑤ 焦外光斑 ----------
   真实照片里的 bokeh 是"柔到看不出圆边"的。
   这里把模糊半径拉到和直径同量级，并压到 0.2~0.3，
   否则会变成一颗颗清晰的小圆点，一眼假。 */
.site-bg__bokeh {
  position: absolute;
  border-radius: 50%;
  will-change: transform;
}
.site-bg__bokeh--warm {
  width: min(78vw, 1120px);
  aspect-ratio: 1;
  top: -32%;
  left: -18%;
  background: radial-gradient(circle, var(--bg-photo-warm) 0%, transparent 62%);
  opacity: 0.28;
  filter: blur(110px);
  animation: hero-bokeh-1 38s ease-in-out infinite;
}
.site-bg__bokeh--cool {
  width: min(70vw, 1000px);
  aspect-ratio: 1;
  right: -22%;
  bottom: -34%;
  background: radial-gradient(circle, var(--bg-photo-cool) 0%, transparent 64%);
  opacity: 0.24;
  filter: blur(120px);
  animation: hero-bokeh-2 46s ease-in-out infinite;
}
.site-bg__bokeh--violet {
  width: min(58vw, 820px);
  aspect-ratio: 1;
  top: 26%;
  right: 8%;
  background: radial-gradient(circle, var(--bg-photo-violet) 0%, transparent 66%);
  opacity: 0.16;
  filter: blur(130px);
  animation: hero-bokeh-3 52s ease-in-out infinite;
}
/* 第四团光斑补在左侧偏下：只有三团时，左侧中下部偏空，
   而标题块正好压在那里，缺一层底光会显得"字浮着"。 */
.site-bg__bokeh--aqua {
  width: min(62vw, 880px);
  aspect-ratio: 1;
  left: -20%;
  bottom: -18%;
  background: radial-gradient(circle, var(--bg-photo-cool) 0%, transparent 66%);
  opacity: 0.2;
  filter: blur(125px);
  animation: hero-bokeh-4 41s ease-in-out infinite;
}

/* ---------- 胶片颗粒 ----------
   内联 SVG 的 feTurbulence 噪声。data URI 里 # 必须转义成 %23。 */
.site-bg__grain {
  position: absolute;
  inset: 0;
  opacity: 0.16;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}
:root[data-theme='light'] .site-bg__grain {
  opacity: 0.1;
  /* 浅底下 overlay 会把噪声提亮成灰雾，改成 multiply 才有颗粒 */
  mix-blend-mode: multiply;
}

/* ---------- 暗角 ----------
   不做成"黑框"：用极缓的过渡在四周压一点点，
   把视线收拢到中心的标题上就够了。 */
.site-bg__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    132% 96% at 50% 46%,
    transparent 0%,
    transparent 54%,
    rgba(0, 0, 0, 0.42) 100%
  );
}
:root[data-theme='light'] .site-bg__vignette {
  background: radial-gradient(
    132% 96% at 50% 46%,
    transparent 0%,
    transparent 58%,
    rgba(120, 108, 88, 0.16) 100%
  );
}

/* ---------- 漂移 ---------- */
@keyframes hero-caustics-a {
  0%,
  100% {
    background-position: 0 0;
  }
  50% {
    background-position: 130px 90px;
  }
}
@keyframes hero-rays {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
    opacity: 0.2;
  }
  50% {
    transform: translate3d(-3%, 2%, 0);
    opacity: 0.3;
  }
}
@keyframes hero-caustics-b {
  0%,
  100% {
    background-position: 0 0;
  }
  50% {
    background-position: -95px 120px;
  }
}
@keyframes hero-bokeh-1 {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(4%, 6%, 0) scale(1.08);
  }
}
@keyframes hero-bokeh-2 {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-5%, -4%, 0) scale(1.1);
  }
}
@keyframes hero-bokeh-3 {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1.02);
  }
  50% {
    transform: translate3d(3%, -5%, 0) scale(1.12);
  }
}
@keyframes hero-caustics-c {
  0%,
  100% {
    background-position: 0 0;
  }
  50% {
    background-position: 74px -58px;
  }
}
@keyframes hero-bokeh-4 {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(6%, -3%, 0) scale(1.09);
  }
}
/* 中央光晕：只做极缓慢的呼吸，幅度大了会像"闪烁"而不是照片 */
@keyframes hero-bloom {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.56;
  }
  50% {
    transform: scale(1.06);
    opacity: 0.66;
  }
}

/* 关闭动效：底图保持静止，但仍然有照片质感 */
@media (prefers-reduced-motion: reduce) {
  .site-bg__caustics,
  .site-bg__rays,
  .site-bg__bokeh,
  .site-bg__bloom {
    animation: none !important;
  }
}

/* 小屏：焦散与光斑都收小，避免糊成一片 */
@media (max-width: 768px) {
  .site-bg__rays {
    background-size: auto;
    opacity: 0.16;
  }
  .site-bg__caustics--a {
    background-size: 180px 180px;
  }
  .site-bg__caustics--b {
    background-size: 140px 140px;
  }
  .site-bg__caustics--c {
    background-size: 100px 100px;
  }
  .site-bg__bokeh {
    filter: blur(70px);
  }
  /* 中央光晕在窄屏上收窄，否则会横向溢出到画面外缘 */
  .site-bg__bloom {
    width: min(150vw, 900px);
    height: min(60vh, 520px);
    filter: blur(44px);
  }
}
</style>
