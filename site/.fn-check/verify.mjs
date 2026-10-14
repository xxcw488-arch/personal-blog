/**
 * 打包并运行 Pages Functions 验证脚本。
 * 用法：npm run verify:api
 *
 * 为什么要打包：Functions 源码用的是「无扩展名的相对导入」+ TS，
 * Node 无法直接跑；用 esbuild 打成单文件 mjs 后即可执行。
 * 打包时 `import type` 会被完全擦除，所以不会去解析 src/types。
 *
 * 为什么不用 wrangler pages dev：workerd 运行时在部分 Windows 环境下无法启动
 * （见 README「已知限制」），所以用 sql.js 做 D1 替身来跑真实 handler。
 */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outfile = join(here, 'run.bundle.mjs')

await build({
  entryPoints: [join(here, 'run.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // sql.js 走 node_modules，不要打进来
  external: ['sql.js'],
  logLevel: 'warning',
})

const r = spawnSync(process.execPath, [outfile], { stdio: 'inherit' })
process.exit(r.status ?? 1)
