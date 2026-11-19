import { randomInt } from 'node:crypto'

const DEFAULT_LENGTH = 16
const MIN_LENGTH = 1
const MAX_LENGTH = 128

const CHARACTER_SETS = [
  { key: 'uppercase', enabled: 'include_uppercase', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { key: 'lowercase', enabled: 'include_lowercase', chars: 'abcdefghijklmnopqrstuvwxyz' },
  { key: 'numbers', enabled: 'include_numbers', chars: '0123456789' },
  { key: 'symbols', enabled: 'include_symbols', chars: '!@#$%^&*()_+-=[]{}|;:,.<>?' }
]

export default function handler(params) {
  const requestedLength = params.length === undefined || params.length === null ? DEFAULT_LENGTH : Number(params.length)

  if (!Number.isInteger(requestedLength) || requestedLength < MIN_LENGTH || requestedLength > MAX_LENGTH) {
    return { success: false, error: `密码长度必须是 ${MIN_LENGTH}-${MAX_LENGTH} 之间的整数` }
  }

  const activeSets = CHARACTER_SETS.filter((set) => params[set.enabled] !== false)

  if (activeSets.length === 0) {
    return { success: false, error: '至少需要选择一种字符类型' }
  }

  if (requestedLength < activeSets.length) {
    return { success: false, error: `密码长度不足以包含全部 ${activeSets.length} 种选中字符类型` }
  }

  const passwordChars = activeSets.map((set) => set.chars[randomInt(set.chars.length)])
  const charset = activeSets.map((set) => set.chars).join('')

  while (passwordChars.length < requestedLength) {
    passwordChars.push(charset[randomInt(charset.length)])
  }

  for (let index = passwordChars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    const current = passwordChars[index]
    passwordChars[index] = passwordChars[swapIndex]
    passwordChars[swapIndex] = current
  }

  return {
    success: true,
    content: passwordChars.join(''),
    metadata: {
      length: requestedLength,
      includes: {
        uppercase: params.include_uppercase !== false,
        lowercase: params.include_lowercase !== false,
        numbers: params.include_numbers !== false,
        symbols: params.include_symbols !== false
      }
    }
  }
}
