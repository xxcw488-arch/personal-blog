/**
 * 全局音乐播放器 store
 * ------------------------------------------------------------
 * 设计要点：
 * 1. store 是播放状态的唯一来源（曲目、当前曲、进度、音量、模式）。
 * 2. store **不创建** <audio> 元素——组件挂载后调用 attachAudio(el) 把它交进来，
 *    卸载时调用 detachAudio() 摘掉全部监听，避免事件泄漏；这样播放器可以
 *    在任何页面挂载/卸载，而不影响播放状态。
 * 3. 没有曲目时所有 action 都是 no-op，任何页面调用都安全。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Music } from '@/types'
import { getMusic } from '@/api'

/** 播放模式：顺序 / 单曲循环 / 随机 */
export type PlayMode = 'sequence' | 'single' | 'shuffle'

/** 模式切换顺序（cycleMode 用） */
const MODE_ORDER: readonly PlayMode[] = ['sequence', 'single', 'shuffle']

/** 本地存储键：只记音量、模式与上次听到第几首，不含任何个人信息 */
const STORAGE_KEY = 'blog-player'
/** 默认音量；面板里已经没有音量控件了，组件用它在必要时复位（见 MusicPlayer.vue） */
export const DEFAULT_VOLUME = 0.7

interface SavedPlayerState {
  volume?: number
  mode?: PlayMode
  index?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function isPlayMode(value: unknown): value is PlayMode {
  return value === 'sequence' || value === 'single' || value === 'shuffle'
}

/** 读本地记录；隐私模式 / 存储被禁用时静默返回空 */
function readSaved(): SavedPlayerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const record = parsed as Record<string, unknown>
    return {
      volume: typeof record.volume === 'number' ? record.volume : undefined,
      mode: isPlayMode(record.mode) ? record.mode : undefined,
      index: typeof record.index === 'number' ? record.index : undefined,
    }
  } catch {
    return {}
  }
}

function writeSaved(state: SavedPlayerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* 无痕模式 / 存储被禁用：静默失败，不影响播放 */
  }
}

export const usePlayerStore = defineStore('player', () => {
  const saved = readSaved()

  /* ---------- state ---------- */
  /** 全部曲目（由 load() 拉取） */
  const tracks = ref<Music[]>([])
  /** 当前曲目下标，-1 表示还没选曲 */
  const currentIndex = ref(-1)
  const playing = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(clamp(saved.volume ?? DEFAULT_VOLUME, 0, 1))
  const mode = ref<PlayMode>(saved.mode ?? 'sequence')
  /** 曲目列表是否正在请求 */
  const loading = ref(false)
  /** 是否已经成功拿到过曲目列表 */
  const loaded = ref(false)

  /* ---------- getters ---------- */
  /** 当前曲目；没有曲目时为 null */
  const current = computed<Music | null>(() => tracks.value[currentIndex.value] ?? null)
  /** 播放进度 0–1；时长未知时为 0 */
  const progress = computed(() => {
    if (duration.value <= 0) return 0
    return clamp(currentTime.value / duration.value, 0, 1)
  })
  /** 是否有曲目可放（没有就整个播放器都不渲染） */
  const hasTracks = computed(() => tracks.value.length > 0)

  /* ---------- 内部：音频元素与请求缓存 ---------- */
  /** 由组件注入的音频元素 */
  let audio: HTMLAudioElement | null = null
  /** load() 的请求缓存：保证只请求一次 */
  let loadPromise: Promise<void> | null = null
  /** 音频还没 attach 时的「想播」意图，attach 后补一次播放 */
  let pendingPlay = false

  function persist(): void {
    writeSaved({ volume: volume.value, mode: mode.value, index: currentIndex.value })
  }

  /* ---------- 音频事件 ---------- */
  function onTimeUpdate(): void {
    if (!audio) return
    currentTime.value = audio.currentTime
    if (Number.isFinite(audio.duration) && audio.duration > 0) duration.value = audio.duration
  }

  function onDurationChange(): void {
    if (!audio) return
    if (Number.isFinite(audio.duration) && audio.duration > 0) duration.value = audio.duration
  }

  function onPlay(): void {
    playing.value = true
  }

  function onPause(): void {
    playing.value = false
  }

  function onError(): void {
    // 音频加载失败：不要卡在「正在播放」的假象里
    playing.value = false
  }

  function onEnded(): void {
    void handleEnded()
  }

  /** 把当前曲目写进 <audio>（只改 src，不触发播放） */
  function syncSource(): void {
    if (!audio) return
    const track = current.value
    if (!track) {
      audio.removeAttribute('src')
      currentTime.value = 0
      duration.value = 0
      return
    }
    // 用 attribute 比较，避免 audio.src 被解析成绝对地址后每次都判定为「不同」
    if (audio.getAttribute('src') !== track.audio) {
      audio.setAttribute('src', track.audio)
      audio.load()
      currentTime.value = 0
    } else {
      // 同一首再点一次：显式回到开头，别依赖浏览器对 ended 元素的处理差异
      try {
        audio.currentTime = 0
      } catch {
        /* 元数据未就绪时赋值会抛错：忽略 */
      }
      currentTime.value = 0
    }
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      duration.value = audio.duration
    } else if (track.duration > 0) {
      // 元数据还没就绪：先用曲目自带的时长，进度条不至于空着
      duration.value = track.duration
    }
  }

  /** 尝试播放；没有音频元素时先记下意图 */
  async function resume(): Promise<void> {
    if (!audio) {
      pendingPlay = true
      return
    }
    try {
      await audio.play()
      playing.value = true
      pendingPlay = false
    } catch {
      // 浏览器自动播放策略拦截 / 音频不可用：退回暂停态，由用户点击再试
      playing.value = false
    }
  }

  /* ---------- 选曲 ---------- */
  /** 把任意下标折回 0..total-1 */
  function normalize(index: number): number {
    const total = tracks.value.length
    if (total === 0) return -1
    return ((index % total) + total) % total
  }

  /** 随机挑一首（只有一首时就是它自己） */
  function randomIndex(): number {
    const total = tracks.value.length
    if (total <= 1) return currentIndex.value < 0 ? 0 : currentIndex.value
    let next = currentIndex.value
    while (next === currentIndex.value) {
      next = Math.floor(Math.random() * total)
    }
    return next
  }

  async function playIndex(index: number): Promise<void> {
    if (!hasTracks.value) return
    const target = normalize(index)
    if (target < 0) return

    const track = tracks.value[target]
    currentIndex.value = target
    currentTime.value = 0
    duration.value = track?.duration ?? 0
    persist()

    if (!audio) {
      // 组件还没挂上音频：记住意图，attachAudio 时会补播
      pendingPlay = true
      return
    }
    syncSource()
    await resume()
  }

  async function handleEnded(): Promise<void> {
    if (!hasTracks.value) {
      playing.value = false
      return
    }
    if (mode.value === 'single') {
      // 单曲循环：回到开头重放同一首
      if (audio) {
        audio.currentTime = 0
        currentTime.value = 0
        await resume()
      } else {
        currentTime.value = 0
        playing.value = false
      }
      return
    }
    if (mode.value === 'shuffle') {
      await playIndex(randomIndex())
      return
    }
    // 顺序播放：下一首，最后一首回到第一首
    await playIndex(currentIndex.value + 1)
  }

  /* ---------- 对外 action ---------- */
  /**
   * 拉取曲目列表。只会真正请求一次：无论谁先调用（App / 音乐页 / 播放器），
   * 后续调用都复用同一个 Promise。
   */
  async function load(): Promise<void> {
    if (!loadPromise) {
      loadPromise = (async () => {
        loading.value = true
        try {
          const list = await getMusic()
          tracks.value = list
          loaded.value = true
          // 恢复上次听到第几首（只定位，不自动播放——浏览器会拦截自动播放）
          const index = saved.index
          if (
            typeof index === 'number' &&
            index >= 0 &&
            index < list.length &&
            currentIndex.value < 0
          ) {
            currentIndex.value = index
            duration.value = list[index]?.duration ?? 0
          }
        } catch {
          // 接口挂了就当作没有曲目：播放器整体隐藏，不阻塞页面
          tracks.value = []
        } finally {
          loading.value = false
        }
      })()
    }
    return loadPromise
  }

  /** 播放 / 暂停切换 */
  async function toggle(): Promise<void> {
    if (!hasTracks.value) return
    if (currentIndex.value < 0) {
      await playIndex(0)
      return
    }
    if (!audio) {
      // 没有音频元素时只翻转意图，attach 后生效
      pendingPlay = !playing.value
      playing.value = pendingPlay
      return
    }
    if (audio.paused) {
      await resume()
    } else {
      audio.pause()
      playing.value = false
      pendingPlay = false
    }
  }

  /** 下一首（随机模式下随机挑一首） */
  async function next(): Promise<void> {
    if (!hasTracks.value) return
    if (currentIndex.value < 0) {
      await playIndex(0)
      return
    }
    if (mode.value === 'shuffle') {
      await playIndex(randomIndex())
      return
    }
    await playIndex(currentIndex.value + 1)
  }

  /** 上一首 */
  async function prev(): Promise<void> {
    if (!hasTracks.value) return
    if (currentIndex.value < 0) {
      await playIndex(0)
      return
    }
    if (mode.value === 'shuffle') {
      await playIndex(randomIndex())
      return
    }
    // 已经播过一会儿：先回到本曲开头（和主流播放器一致）
    if (audio && audio.currentTime > 3) {
      seek(0)
      return
    }
    await playIndex(currentIndex.value - 1)
  }

  /** 跳转到指定秒数（超出时长会被夹住） */
  function seek(seconds: number): void {
    if (!hasTracks.value) return
    if (!Number.isFinite(seconds)) return
    if (duration.value <= 0) return
    const target = clamp(seconds, 0, duration.value)
    currentTime.value = target
    if (audio) {
      try {
        audio.currentTime = target
      } catch {
        /* 元数据未就绪时赋值会抛错：忽略，进度仍会随 timeupdate 修正 */
      }
    }
  }

  /** 设置音量 0–1 */
  function setVolume(value: number): void {
    const next = clamp(Number.isFinite(value) ? value : DEFAULT_VOLUME, 0, 1)
    volume.value = next
    if (audio) audio.volume = next
    persist()
  }

  /** 顺序 → 单曲 → 随机 → 顺序 */
  function cycleMode(): PlayMode {
    const index = MODE_ORDER.indexOf(mode.value)
    mode.value = MODE_ORDER[(index + 1) % MODE_ORDER.length] ?? 'sequence'
    persist()
    return mode.value
  }

  /* ---------- 音频元素的挂载 / 卸载 ---------- */
  /** 组件把 <audio> 交给 store（store 不自己创建元素） */
  function attachAudio(el: HTMLAudioElement): void {
    if (audio === el) return
    detachAudio()
    audio = el
    el.volume = volume.value
    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('durationchange', onDurationChange)
    el.addEventListener('loadedmetadata', onDurationChange)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    syncSource()
    if (pendingPlay && current.value) {
      pendingPlay = false
      void resume()
    }
  }

  /** 卸载监听；元素要消失时顺带暂停，避免出现「没有播放器却在响」 */
  function detachAudio(): void {
    if (!audio) return
    const el = audio
    audio = null
    el.removeEventListener('timeupdate', onTimeUpdate)
    el.removeEventListener('durationchange', onDurationChange)
    el.removeEventListener('loadedmetadata', onDurationChange)
    el.removeEventListener('play', onPlay)
    el.removeEventListener('pause', onPause)
    el.removeEventListener('ended', onEnded)
    el.removeEventListener('error', onError)
    try {
      el.pause()
    } catch {
      /* 忽略：某些环境下元素已被移除 */
    }
    playing.value = false
  }

  return {
    /* state */
    tracks,
    currentIndex,
    playing,
    currentTime,
    duration,
    volume,
    mode,
    loading,
    loaded,
    /* getters */
    current,
    progress,
    hasTracks,
    /* actions */
    load,
    playIndex,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    cycleMode,
    attachAudio,
    detachAudio,
  }
})
