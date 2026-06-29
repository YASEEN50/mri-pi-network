// =============================================================================
// src/infrastructure/pi-network/pi-payment.service.ts
// =============================================================================

import { prisma } from '@/lib/prisma'
import { getPiNetworkApiKey } from '@/lib/pi/pi-api-key'
import {
  IPiPaymentService,
  CreatePiPaymentInput,
  CreateA2UPaymentInput,
  A2UPaymentResult,
  PiPaymentResult,
  PaymentStatus,
} from './pi-payments.interface'

class SimulatedPiPaymentService implements IPiPaymentService {
  async createPayment(input: CreatePiPaymentInput): Promise<PiPaymentResult> {
    const paymentId = `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    console.log('[Pi Simulation] Creating payment:', { paymentId, amount: input.amount })
    return { paymentId, txid: undefined, status: 'APPROVED', amount: input.amount, createdAt: new Date() }
  }
  async approvePayment(paymentId: string): Promise<void> {
    console.log('[Pi Simulation] Approving payment:', paymentId)
  }
  async completePayment(paymentId: string, txid: string): Promise<PiPaymentResult> {
    return { paymentId, txid, status: 'COMPLETED', amount: 0, createdAt: new Date() }
  }
  async getPaymentStatus(_paymentId: string): Promise<PaymentStatus> {
    return 'COMPLETED'
  }
  async handleIncompletePayment(_paymentId: string): Promise<void> {}
  async createA2UPayment(input: CreateA2UPaymentInput): Promise<A2UPaymentResult> {
    const paymentId = `SIM_A2U_${Date.now()}`
    console.log('[Pi Simulation] A2U payment:', { paymentId, amount: input.amount, uid: input.uid })
    return {
      paymentId,
      toAddress: 'SIM_RECIPIENT_ADDRESS',
      amount: input.amount,
      status: 'APPROVED',
      createdAt: new Date(),
    }
  }
}

class RealPiPaymentService implements IPiPaymentService {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.minepi.com'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private get headers() {
    return { Authorization: `Key ${this.apiKey}`, 'Content-Type': 'application/json' }
  }

  async createPayment(_input: CreatePiPaymentInput): Promise<PiPaymentResult> {
    throw new Error('Pi payment must be initiated from frontend SDK')
  }

  async approvePayment(paymentId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v2/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: this.headers,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Pi approve failed: ${res.status} ${body}`)
    }
  }

  async completePayment(paymentId: string, txid: string): Promise<PiPaymentResult> {
    const res = await fetch(`${this.baseUrl}/v2/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ txid }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Pi complete failed: ${res.status} ${body}`)
    }
    const data = await res.json()
    return { paymentId, txid, status: 'COMPLETED', amount: data.amount, createdAt: new Date(data.created_at) }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const res = await fetch(`${this.baseUrl}/v2/payments/${paymentId}`, { headers: this.headers })
    if (!res.ok) return 'ERROR'
    const data = await res.json()
    return data.status as PaymentStatus
  }

  async handleIncompletePayment(paymentId: string): Promise<void> {
    await this.approvePayment(paymentId)
  }

  async createA2UPayment(input: CreateA2UPaymentInput): Promise<A2UPaymentResult> {
    const res = await fetch(`${this.baseUrl}/v2/payments`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        payment: {
          amount: input.amount,
          memo: input.memo,
          metadata: input.metadata ?? {},
          uid: input.uid,
        },
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Pi A2U create failed: ${res.status} ${body}`)
    }
    const data = await res.json() as Record<string, unknown>
    const paymentId = String(data.identifier ?? data.payment_id ?? '')
    if (!paymentId) throw new Error('Pi A2U: missing payment identifier')

    return {
      paymentId,
      toAddress: (data.to_address ?? data.recipient ?? data.to_address) as string | undefined,
      amount: Number(data.amount ?? input.amount),
      status: (data.status as PaymentStatus) ?? 'APPROVED',
      createdAt: new Date(String(data.created_at ?? Date.now())),
    }
  }
}

function createPiPaymentService(): IPiPaymentService {
  const apiKey = getPiNetworkApiKey()
  if (apiKey) return new RealPiPaymentService(apiKey)
  if (process.env.PI_SANDBOX === 'true') return new SimulatedPiPaymentService()
  if (process.env.NODE_ENV === 'production') {
    console.error('[Pi Payment] PI_API_KEY / PI_NETWORK_API_KEY missing in production')
    return new SimulatedPiPaymentService()
  }
  console.warn('[Pi Payment] No Pi API key — dev simulation mode (set PI_SANDBOX=true to allow)')
  return new SimulatedPiPaymentService()
}

export const piPaymentService = createPiPaymentService()

export interface ProcessPaymentInput {
  userId: string
  doctorId?: string
  appointmentId?: string
  amountTotal: number
  type: 'APPOINTMENT_FEE' | 'DEPOSIT' | 'FINAL_PAYMENT' | 'PREMIO_PURCHASE'
  memo: string
  payerWallet?: string
  receiverWallet?: string
}

export interface ProcessPaymentResult {
  success: boolean
  transactionId?: string
  txHash?: string
  error?: string
}

export async function processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
  console.warn('[processPayment] deprecated direct call blocked', { type: input.type })
  return { success: false, error: 'يجب الدفع عبر Pi Network' }
}

export async function completePayment(transactionId: string, txHash: string): Promise<boolean> {
  try {
    await prisma.transaction.update({ where: { id: transactionId }, data: { status: 'COMPLETED', txHash } })
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } })
    if (transaction?.appointmentId) {
      if (transaction.type === 'APPOINTMENT_FEE' || transaction.type === 'FINAL_PAYMENT') {
        await prisma.appointment.update({ where: { id: transaction.appointmentId }, data: { isPaid: true, paidAt: new Date() } })
      } else if (transaction.type === 'DEPOSIT') {
        await prisma.appointment.update({ where: { id: transaction.appointmentId }, data: { isDepositPaid: true, depositAmount: transaction.receiverAmount } })
      }
    }
    return true
  } catch (err) {
    console.error('[completePayment] Error:', err)
    return false
  }
}
