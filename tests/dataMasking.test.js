import { describe, expect, it } from 'vitest'
import {
  MASK_LIMITS,
  MASK_PRESETS,
  applyDataMasking,
  findColumnMaskPreset,
  findMaskPreset,
  maskValue,
  normalizeMaskPresetKeys
} from '../src/shared/dataMasking.js'

describe('data masking', () => {
  it('normalizes preset keys with dedupe, invalid removal and caps', () => {
    expect(normalizeMaskPresetKeys(['phone', 'phone', 'nope', 'email'])).toEqual(['phone', 'email'])
    expect(normalizeMaskPresetKeys('phone')).toEqual([])
    const many = Array.from(
      { length: MASK_PRESETS.length + 4 },
      (_, index) => MASK_PRESETS[index % MASK_PRESETS.length].key
    )
    expect(normalizeMaskPresetKeys(many)).toHaveLength(Math.min(MASK_LIMITS.maxPresets, MASK_PRESETS.length))
  })

  it('matches columns by keyword in preset order', () => {
    expect(findColumnMaskPreset('user_email', ['email']).key).toBe('email')
    expect(findColumnMaskPreset('mobile_phone', ['phone']).key).toBe('phone')
    expect(findColumnMaskPreset('user_name', ['name', 'email']).key).toBe('name')
    expect(findColumnMaskPreset('name', ['name']).key).toBe('name')
    expect(findColumnMaskPreset('file_name', ['name'])).toBeNull()
    expect(findColumnMaskPreset('client_ip', ['ip']).key).toBe('ip')
    expect(findColumnMaskPreset('zip_code', ['ip'])).toBeNull()
    expect(findColumnMaskPreset('api_token', ['secret']).key).toBe('secret')
    expect(findColumnMaskPreset('created_at', ['phone', 'email'])).toBeNull()
    expect(findMaskPreset('missing')).toBeNull()
  })

  it('masks values per strategy', () => {
    expect(maskValue('13812345678', findMaskPreset('phone'))).toBe('138****5678')
    expect(maskValue('a@example.com', findMaskPreset('email'))).toBe('a***@example.com')
    expect(maskValue('not-an-email', findMaskPreset('email'))).toBe('******')
    expect(maskValue('张三丰', findMaskPreset('name'))).toBe('张**')
    expect(maskValue('192.168.10.24', findMaskPreset('ip'))).toBe('192.168.*.*')
    expect(maskValue('110101199001011234', findMaskPreset('idcard'))).toBe('1101**********1234')
    expect(maskValue('secret-value', findMaskPreset('secret'))).toBe('******')
    expect(maskValue(null, findMaskPreset('phone'))).toBeNull()
    expect(maskValue('', findMaskPreset('address'))).toBe('')
    expect(maskValue('12', findMaskPreset('phone'))).toBe('******')
  })

  it('applies masking to rows without mutating the source', () => {
    const rows = [
      { id: 1, email: 'a@example.com', phone: '13800001111', name: 'Alice', note: 'keep' },
      { id: 2, email: null, phone: null, name: 'Bob', note: 'keep' }
    ]
    const result = applyDataMasking(rows, ['email', 'phone', 'name'])

    expect(result.maskedColumns).toEqual(['email', 'phone', 'name'])
    expect(result.rows[0]).toEqual({
      id: 1,
      email: 'a***@example.com',
      phone: '138****1111',
      name: 'A****',
      note: 'keep'
    })
    expect(result.rows[1].email).toBeNull()
    expect(result.rows[1].phone).toBeNull()
    expect(rows[0].email).toBe('a@example.com')
  })

  it('returns the original rows when no preset matches or none is selected', () => {
    const rows = [{ id: 1, title: 'hello' }]
    expect(applyDataMasking(rows, []).rows).toBe(rows)
    const unmatched = applyDataMasking(rows, ['phone'])
    expect(unmatched.rows).toBe(rows)
    expect(unmatched.maskedColumns).toEqual([])
    expect(applyDataMasking(null, ['phone']).rows).toEqual([])
  })
})
