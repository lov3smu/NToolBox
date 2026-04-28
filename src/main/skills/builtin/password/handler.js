export default function handler(params) {
  const length = params.length || 16
  const includeUppercase = params.include_uppercase !== false
  const includeLowercase = params.include_lowercase !== false
  const includeNumbers = params.include_numbers !== false
  const includeSymbols = params.include_symbols !== false
  
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  let charset = ''
  if (includeUppercase) charset += uppercase
  if (includeLowercase) charset += lowercase
  if (includeNumbers) charset += numbers
  if (includeSymbols) charset += symbols
  
  if (charset.length === 0) {
    return { success: false, error: '至少需要选择一种字符类型' }
  }
  
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  return {
    success: true,
    content: password,
    metadata: {
      length,
      includes: {
        uppercase: includeUppercase,
        lowercase: includeLowercase,
        numbers: includeNumbers,
        symbols: includeSymbols
      }
    }
  }
}