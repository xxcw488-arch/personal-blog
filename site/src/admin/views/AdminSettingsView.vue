<script setup lang="ts">
/**
 * 站点设置
 * ------------------------------------------------------------
 * 这些值全部由 D1 的 site_settings 表驱动，改完立刻生效、不用重新构建。
 * 「站点信息不写死」这条需求就落在这里。
 */
import { onMounted, reactive, ref } from 'vue'
import { adminSettings, adminUpload, AdminApiError, type AdminSettings } from '@/admin/api'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')

const form = reactive<AdminSettings>({
  siteName: '',
  tagline: '',
  kicker: '',
  author: '',
  authorAvatar: '',
  authorBio: '',
  copyright: '',
  icp: '',
  accentColor: '',
  chatEnabled: true,
  social: { github: '', email: '', wechat: '', qq: '', rss: '' },
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const s = await adminSettings.get()
    Object.assign(form, s)
    form.social = { github: '', email: '', wechat: '', qq: '', rss: '', ...(s.social ?? {}) }
  } catch (e) {
    error.value = e instanceof AdminApiError ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

/* ============================================================
   头像上传
   ------------------------------------------------------------
   以前这里只有一个 URL 输入框，站长得自己先把图传到别处再粘地址，
   等于「头像」这个设置项实际上没法用。现在直接传进 R2（avatars/ 目录）。
   ============================================================ */

const avatarInput = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)

async function onAvatarPick(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  avatarUploading.value = true
  error.value = ''
  try {
    const res = await adminUpload.file(file, 'avatars')
    form.authorAvatar = res.url
    notice.value = '头像已上传，记得点「保存设置」才会生效'
  } catch (e) {
    error.value = e instanceof AdminApiError ? e.message : '上传失败'
  } finally {
    avatarUploading.value = false
    // 清空 input，否则同一个文件选第二次不会触发 change
    input.value = ''
  }
}

async function save() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const updated = await adminSettings.update({
      siteName: form.siteName,
      tagline: form.tagline,
      kicker: form.kicker,
      author: form.author,
      authorAvatar: form.authorAvatar,
      authorBio: form.authorBio,
      copyright: form.copyright,
      icp: form.icp,
      accentColor: form.accentColor,
      chatEnabled: form.chatEnabled,
      social: form.social,
    })
    Object.assign(form, updated)
    notice.value = '已保存。刷新站点首页即可看到变化。'
  } catch (e) {
    error.value = e instanceof AdminApiError ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="set">
    <p v-if="loading" class="set__muted">加载中…</p>

    <template v-else>
      <p class="set__lead">
        这里的改动会写进数据库并立刻生效，不需要重新构建或重新部署。
      </p>

      <!-- 报头与品牌 -->
      <section class="box">
        <h2 class="box__h">报头与品牌</h2>
        <div class="grid">
          <label class="fld">
            <span class="fld__label">站点名</span>
            <input v-model="form.siteName" class="fld__input" type="text" placeholder="纸上" />
          </label>
          <label class="fld">
            <span class="fld__label">报头上方小字（kicker）</span>
            <input v-model="form.kicker" class="fld__input" type="text" placeholder="Personal Space" />
            <span class="fld__help">显示在首屏大标题上方那行小字；留空则整行不显示。</span>
          </label>
          <label class="fld fld--wide">
            <span class="fld__label">一句话简介</span>
            <input v-model="form.tagline" class="fld__input" type="text" />
          </label>
        </div>
      </section>

      <!-- 作者 -->
      <section class="box">
        <h2 class="box__h">作者信息</h2>
        <div class="grid">
          <label class="fld">
            <span class="fld__label">昵称</span>
            <input v-model="form.author" class="fld__input" type="text" />
          </label>
          <div class="fld">
            <span class="fld__label">头像</span>
            <div class="fld__row">
              <img
                v-if="form.authorAvatar"
                class="fld__preview"
                :src="form.authorAvatar"
                alt="头像预览"
                width="36"
                height="36"
              />
              <input
                v-model="form.authorAvatar"
                class="fld__input"
                type="text"
                placeholder="点右边上传，或直接粘贴图片地址"
              />
              <button
                class="btn btn--sm"
                type="button"
                :disabled="avatarUploading"
                @click="avatarInput?.click()"
              >
                {{ avatarUploading ? '上传中…' : '上传' }}
              </button>
              <input
                ref="avatarInput"
                class="fld__file"
                type="file"
                accept="image/*"
                @change="onAvatarPick"
              />
            </div>
          </div>
          <label class="fld fld--wide">
            <span class="fld__label">个人简介</span>
            <textarea v-model="form.authorBio" class="fld__input fld__input--area" rows="3" />
          </label>
        </div>
      </section>

      <!-- 页脚 -->
      <section class="box">
        <h2 class="box__h">页脚</h2>
        <div class="grid">
          <label class="fld">
            <span class="fld__label">版权主体</span>
            <input v-model="form.copyright" class="fld__input" type="text" />
          </label>
          <label class="fld">
            <span class="fld__label">备案号</span>
            <input v-model="form.icp" class="fld__input" type="text" placeholder="可留空" />
          </label>
        </div>
      </section>

      <!-- 社交 -->
      <section class="box">
        <h2 class="box__h">社交链接</h2>
        <div class="grid">
          <label class="fld">
            <span class="fld__label">GitHub</span>
            <input v-model="form.social.github" class="fld__input" type="text" placeholder="https://github.com/…" />
          </label>
          <label class="fld">
            <span class="fld__label">邮箱</span>
            <input v-model="form.social.email" class="fld__input" type="text" placeholder="you@example.com" />
          </label>
          <label class="fld">
            <span class="fld__label">微信号</span>
            <input v-model="form.social.wechat" class="fld__input" type="text" placeholder="填微信号弹复制框；填网址则跳转" />
          </label>
          <label class="fld">
            <span class="fld__label">QQ 号</span>
            <input v-model="form.social.qq" class="fld__input" type="text" placeholder="填 QQ 号弹复制框；填网址则跳转" />
          </label>
          <label class="fld">
            <span class="fld__label">RSS</span>
            <input v-model="form.social.rss" class="fld__input" type="text" placeholder="/feed.xml" />
          </label>
          <p class="fld__help fld--wide">
            微信号 / QQ 号这两项：填<strong>号码</strong>时，首页站长卡片上的图标点开是「复制 + 提示」的小窗；
            填 <code>https://…</code> 网址时，点一下直接跳转。留空则卡片上不出现对应图标。
          </p>
        </div>
      </section>

      <!-- 外观与开关 -->
      <section class="box">
        <h2 class="box__h">外观与功能</h2>
        <div class="grid">
          <label class="fld">
            <span class="fld__label">主题强调色</span>
            <input v-model="form.accentColor" class="fld__input" type="text" placeholder="#c79468" />
            <span class="fld__help">
              留空用默认暖金。填 6 位十六进制（如 <code>#c79468</code>），会同时覆盖按钮、链接、
              边框与光晕的配色；保存后刷新站点即可看到效果。
            </span>
          </label>
          <label class="fld fld--switch">
            <input v-model="form.chatEnabled" type="checkbox" />
            <span>启用 AI 聊天（功能尚未实现，排在下个版本）</span>
          </label>
        </div>
      </section>

      <p v-if="error" class="set__error" role="alert">{{ error }}</p>
      <p v-if="notice" class="set__notice" role="status">{{ notice }}</p>

      <div class="set__actions">
        <button class="adm-btn" type="button" :disabled="saving" @click="load">重新加载</button>
        <button class="adm-btn adm-btn--primary" type="button" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存设置' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.set {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  max-width: 900px;
}
.set__lead {
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}
.set__muted {
  color: var(--c-ink-4);
  font-size: var(--fs-sm);
}
.set__error {
  color: var(--c-pink);
  font-size: var(--fs-sm);
}
.set__notice {
  color: var(--c-gold);
  font-size: var(--fs-sm);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--c-gold-soft);
}
.set__actions {
  display: flex;
  gap: var(--sp-2);
  justify-content: flex-end;
}

.box {
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-lg);
  background: var(--c-bg);
}
.box__h {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink);
  margin-bottom: var(--sp-4);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--c-line);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-4);
}
.fld {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 0;
}
.fld--wide {
  grid-column: 1 / -1;
}
.fld--switch {
  flex-direction: row;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
  cursor: pointer;
}
.fld__label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink);
}
/* 输入框 + 上传按钮并排 */
.fld__row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}
.fld__row .fld__input {
  flex: 1;
  min-width: 0;
}
.fld__preview {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 1px solid var(--c-line);
  flex-shrink: 0;
}
/* 真正的 file input 藏起来，由按钮代点 */
.fld__file {
  display: none;
}
.fld__input {
  padding: 0.5em 0.75em;
  border: 1px solid var(--c-line);
  border-radius: var(--radius);
  background: var(--glass-bg);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  outline: none;
  transition: border-color var(--dur-fast) var(--ease);
}
.fld__input:focus {
  border-color: var(--c-gold);
}
.fld__input--area {
  resize: vertical;
  line-height: 1.7;
  font-family: inherit;
}
.fld__help {
  font-size: var(--fs-xs);
  color: var(--c-ink-4);
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
