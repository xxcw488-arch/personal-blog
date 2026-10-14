/**
 * 应用入口
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './styles/tokens.css'
import './styles/layout.css'

import App from './App.vue'
import { router } from './router'
import { vReveal } from './directives/reveal'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.directive('reveal', vReveal)

// 先挂载，避免主题初始化阻塞首屏
app.mount('#app')
