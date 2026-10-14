/**
 * v-reveal 指令：元素进入视口时加上 is-visible，触发进场动效。
 * 用法：<div v-reveal> 或 <div v-reveal="150">（延迟毫秒）
 */

import type { Directive, DirectiveBinding } from 'vue'

/** 每个元素一个 observer，卸载时断开，避免泄漏 */
const observers = new WeakMap<HTMLElement, IntersectionObserver>()

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<number | undefined>) {
    // 尊重系统的「减少动效」偏好：直接显示，不做动画
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reveal', 'is-visible')
      return
    }

    const delay = Number(binding.value ?? 0)
    el.classList.add('reveal')
    // 用 animationDelay 而不是 transitionDelay：
    // 进场已经改成 animation 实现（见 layout.css 的 .reveal 说明），
    // transitionDelay 对 animation 不生效
    if (delay > 0) el.style.animationDelay = `${delay}ms`

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          el.classList.add('is-visible')
          // 只触发一次，出现后即停止观察
          observer.disconnect()
          observers.delete(el)
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(el)
    observers.set(el, observer)
  },

  unmounted(el: HTMLElement) {
    const observer = observers.get(el)
    if (observer) {
      observer.disconnect()
      observers.delete(el)
    }
  },
}
