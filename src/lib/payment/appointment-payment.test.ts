import { describe, it, expect } from 'vitest'
import { resolveAppointmentPayment } from '@/lib/payment/appointment-payment'

describe('resolveAppointmentPayment', () => {
  it('skips payment when already paid', () => {
    expect(
      resolveAppointmentPayment({
        fee: 100,
        paymentPolicy: 'PAY_BEFORE_BOOKING',
        isPaid: true,
      }),
    ).toEqual({ paymentType: 'FULL', amount: 0, requiresPayment: false })
  })

  it('PAY_ON_SERVICE does not require upfront payment', () => {
    expect(
      resolveAppointmentPayment({
        fee: 50,
        paymentPolicy: 'PAY_ON_SERVICE',
      }),
    ).toEqual({ paymentType: 'FULL', amount: 50, requiresPayment: false })
  })

  it('PAY_BEFORE_BOOKING requires full fee', () => {
    expect(
      resolveAppointmentPayment({
        fee: 80,
        paymentPolicy: 'PAY_BEFORE_BOOKING',
      }),
    ).toEqual({ paymentType: 'FULL', amount: 80, requiresPayment: true })
  })

  it('DEPOSIT_AND_PAY_LATER charges deposit first', () => {
    expect(
      resolveAppointmentPayment({
        fee: 100,
        paymentPolicy: 'DEPOSIT_AND_PAY_LATER',
        depositPercentage: 25,
        isDepositPaid: false,
      }),
    ).toEqual({ paymentType: 'DEPOSIT', amount: 25, requiresPayment: true })
  })

  it('DEPOSIT_AND_PAY_LATER charges remainder after deposit', () => {
    expect(
      resolveAppointmentPayment({
        fee: 100,
        paymentPolicy: 'DEPOSIT_AND_PAY_LATER',
        depositPercentage: 25,
        isDepositPaid: true,
        depositAmount: 25,
      }),
    ).toEqual({ paymentType: 'FULL', amount: 75, requiresPayment: true })
  })
})
