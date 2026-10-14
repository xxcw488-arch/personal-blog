/**
 * 客户端慢哈希（PBKDF2）
 * ============================================================
 * 这是整个后台鉴权的关键一环：服务端只有 10 ms CPU（Workers Free），
 * 跑不动标准强度的密码哈希，所以**慢哈希放在浏览器里做**。
 *
 * 600,000 次迭代在浏览器里约 50–150 ms —— 用户点「登录」时几乎无感，
 * 但服务端只需要一次亚毫秒级的 HMAC 就能完成校验。
 *
 * 注意：这里算出来的 verifier 就是「口令等价物」，全程只在 HTTPS 内传输，
 * 不会被存进数据库。
 */

/** 与服务端 auth.ts 里的常量保持一致（服务端也会通过接口下发） */
export const DEFAULT_ITERATIONS = 600_000

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 生成 salt（16 字节 → 32 位十六进制）。
 * 只在「首次初始化」时用一次，之后从服务端读取。
 */
export function randomSaltHex(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 推导 verifier：PBKDF2-SHA256(password, salt, iterations) → 32 字节 hex
 *
 * @param password   管理员输入的口令（只在内存里，不外发）
 * @param saltHex    32 位十六进制 salt
 * @param iterations 迭代次数，由服务端下发以保证两端一致
 */
export async function deriveVerifier(
  password: string,
  saltHex: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return bytesToHex(bits)
}
