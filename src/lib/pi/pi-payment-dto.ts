export interface PiPaymentDto {
  identifier: string
  user_uid?: string
  amount: number
  memo: string
  metadata: Record<string, unknown>
  status: {
    developer_approved: boolean
    developer_completed: boolean
    cancelled: boolean
    user_cancelled: boolean
  }
  transaction: null | {
    txid: string
    verified: boolean
  }
}

export function parsePiPaymentDto(raw: unknown): PiPaymentDto | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as PiPaymentDto
  if (typeof p.identifier !== 'string' || !p.identifier) return null
  if (typeof p.amount !== 'number') return null
  if (!p.status || typeof p.status !== 'object') return null
  return {
    identifier: p.identifier,
    user_uid: p.user_uid,
    amount: p.amount,
    memo: typeof p.memo === 'string' ? p.memo : '',
    metadata: (p.metadata && typeof p.metadata === 'object' ? p.metadata : {}) as Record<string, unknown>,
    status: {
      developer_approved: !!p.status.developer_approved,
      developer_completed: !!p.status.developer_completed,
      cancelled: !!p.status.cancelled,
      user_cancelled: !!p.status.user_cancelled,
    },
    transaction: p.transaction && typeof p.transaction.txid === 'string'
      ? { txid: p.transaction.txid, verified: !!p.transaction.verified }
      : null,
  }
}
