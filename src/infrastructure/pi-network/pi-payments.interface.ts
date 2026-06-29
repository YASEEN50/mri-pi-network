// =============================================================================
// src/infrastructure/pi-network/pi-payments.interface.ts
// Pi Payments Interface
// =============================================================================

export type PaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR'

export interface PiPaymentMetadata {
  appointmentId?: string
  userId?: string
  description?: string
  [key: string]: unknown
}

export interface CreatePiPaymentInput {
  amount: number
  memo: string
  metadata: PiPaymentMetadata
  uid: string
}

export interface PiPaymentResult {
  paymentId: string
  txid?: string
  status: PaymentStatus
  amount: number
  createdAt: Date
}

export interface CreateA2UPaymentInput {
  uid: string
  amount: number
  memo: string
  metadata?: Record<string, unknown>
}

export interface A2UPaymentResult {
  paymentId: string
  toAddress?: string
  amount: number
  status: PaymentStatus
  createdAt: Date
}

export interface IPiPaymentService {
  createPayment(input: CreatePiPaymentInput): Promise<PiPaymentResult>
  createA2UPayment(input: CreateA2UPaymentInput): Promise<A2UPaymentResult>
  approvePayment(paymentId: string): Promise<void>
  completePayment(paymentId: string, txid: string): Promise<PiPaymentResult>
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>
  handleIncompletePayment(paymentId: string): Promise<void>
}
