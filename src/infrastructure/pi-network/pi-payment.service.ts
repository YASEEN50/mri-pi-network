// =============================================================================
// src/infrastructure/pi-network/pi-payment.service.ts
// =============================================================================

import { prisma } from '@/lib/prisma'
import {
  IPiPaymentService,
  CreatePiPaymentInput,
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
}

class RealPiPaymentService implements IPiPaymentService {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.minepi.com'

  constructor() {
    const apiKey = process.env.PI_API_KEY
    if (!apiKey) throw new Error('PI_API_KEY is not set')
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
      method: 'POST', headers: this.headers,
    })
    if (!res.ok) throw new Error(`Pi approve failed: ${res.status}`)
  }

  async completePayment(paymentId: string, txid: string): Promise<PiPaymentResult> {
    const res = await fetch(`${this.baseUrl}/v2/payments/${paymentId}/complete`, {
      method: 'POST', headers: this.headers, body: JSON.stringify({ txid }),
    })
    if (!res.ok) throw new Error(`Pi complete failed: ${res.status}`)
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
}

function createPiPaymentService(): IPiPaymentService {
  const isSandbox = process.env.PI_SANDBOX === 'true'
  return isSandbox ? new SimulatedPiPaymentService() : new RealPiPaymentService()
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
  const isSandbox = process.env.PI_SANDBOX === 'true'
  const platformFee = input.amountTotal * 0.05
  const receiverAmount = input.amountTotal - platformFee

  try {
    let txHash: string
    if (isSandbox) {
      const result = await piPaymentService.createPayment({
        amount: input.amountTotal,
        memo: input.memo,
        metadata: { appointmentId: input.appointmentId, userId: input.userId, description: input.memo },
        uid: input.userId,
      })
      txHash = `SIMULATED_${result.paymentId}`
    } else {
      txHash = `PI_PENDING_${Date.now()}`
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: input.userId,
        doctorId: input.doctorId,
        appointmentId: input.appointmentId,
        type: input.type,
        status: isSandbox ? 'COMPLETED' : 'PENDING',
        amountTotal: input.amountTotal,
        platformFee,
        receiverAmount,
        payerWallet: input.payerWallet,
        receiverWallet: input.receiverWallet,
        txHash,
      },
    })

    return { success: true, transactionId: transaction.id, txHash }
  } catch (err) {
    console.error('[processPayment] Error:', err)
    return { success: false, error: 'فشل في معالجة الدفع' }
  }
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
