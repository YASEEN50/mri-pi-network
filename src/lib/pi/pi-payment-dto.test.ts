import { describe, it, expect } from 'vitest'
import { parsePiPaymentDto } from '@/lib/pi/pi-payment-dto'

describe('parsePiPaymentDto', () => {
  it('returns null for invalid input', () => {
    expect(parsePiPaymentDto(null)).toBeNull()
    expect(parsePiPaymentDto({})).toBeNull()
    expect(parsePiPaymentDto({ identifier: 'x', amount: 'bad' })).toBeNull()
  })

  it('parses valid Pi payment payload', () => {
    const dto = parsePiPaymentDto({
      identifier: 'pay-123',
      amount: 10.5,
      memo: 'Premio',
      metadata: { plan: 'MONTHLY' },
      status: {
        developer_approved: true,
        developer_completed: false,
        cancelled: false,
        user_cancelled: false,
      },
      transaction: { txid: 'tx-abc', verified: true },
    })

    expect(dto).not.toBeNull()
    expect(dto!.identifier).toBe('pay-123')
    expect(dto!.amount).toBe(10.5)
    expect(dto!.status.developer_approved).toBe(true)
    expect(dto!.transaction?.txid).toBe('tx-abc')
    expect(dto!.metadata).toEqual({ plan: 'MONTHLY' })
  })

  it('normalizes missing memo and transaction', () => {
    const dto = parsePiPaymentDto({
      identifier: 'pay-456',
      amount: 1,
      status: {},
    })
    expect(dto!.memo).toBe('')
    expect(dto!.transaction).toBeNull()
  })
})
