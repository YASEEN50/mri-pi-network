// Global type declarations

// CSS modules
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}

// Pi Network SDK - loaded via <Script> in layout.tsx
interface PiPaymentData {
  amount:   number
  memo:     string
  metadata: Record<string, unknown>
}

interface PiAuthResult {
  accessToken: string
  user: {
    uid:      string
    username: string
  }
}

interface PiSDK {
  init(config: { version: string; sandbox?: boolean }): void
  authenticate(
    scopes:                   string[],
    onIncompletePaymentFound: (payment: unknown) => void
  ): Promise<PiAuthResult>
  createPayment(
    data:      PiPaymentData,
    callbacks: {
      onReadyForServerApproval:   (paymentId: string) => void
      onReadyForServerCompletion: (paymentId: string, txid: string) => void
      onCancel:                   (paymentId: string) => void
      onError:                    (error: Error) => void
    }
  ): void
}

// Extend the global Window interface — no import/export here so it's truly global
interface Window {
  Pi?: PiSDK
}
