// =============================================================================
// src/infrastructure/pi-network/pi-sdk.service.ts
// Pi Network SDK — server-side verification
// =============================================================================

import { getPiNetworkApiKey, isPiSandboxMode } from '@/lib/pi/pi-api-key'
import { verifyPiAccessToken } from '@/lib/pi/verify-access-token'

export interface PiUserInfo {
  uid: string
  username: string
  roles: string[]
}

export interface PiKYCStatus {
  verified: boolean
}

export class PiSdkService {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.minepi.com'
  private readonly isSandbox: boolean

  constructor() {
    this.apiKey = getPiNetworkApiKey() ?? ''
    this.isSandbox = isPiSandboxMode()
  }

  private get headers() {
    return {
      Authorization: `Key ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  // -------------------------------------------------------------------------
  // Verify Pi access token (received from frontend Pi SDK)
  // -------------------------------------------------------------------------
  async verifyAccessToken(accessToken: string): Promise<PiUserInfo | null> {
    const me = await verifyPiAccessToken(accessToken)
    if (!me) return null
    return { uid: me.uid, username: me.username, roles: [] }
  }

  // -------------------------------------------------------------------------
  // Get user KYC status
  // -------------------------------------------------------------------------
  async getKYCStatus(piUid: string): Promise<PiKYCStatus> {
    if (!this.apiKey) return { verified: false }
    try {
      const res = await fetch(`${this.baseUrl}/v2/users/${piUid}`, {
        headers: this.headers,
      })

      if (!res.ok) return { verified: false }

      const data = await res.json()
      return { verified: data.kyc_verified === true }
    } catch (err) {
      console.error('[Pi SDK] getKYCStatus error:', err)
      return { verified: false }
    }
  }

  // -------------------------------------------------------------------------
  // Sandbox: تجاهل التحقق وإرجاع بيانات وهمية
  // -------------------------------------------------------------------------
  async verifySandboxToken(accessToken: string): Promise<PiUserInfo> {
    // في وضع الـ sandbox، Pi SDK يُرجع token مؤقت
    // نستخدمه مباشرة بدون verification حقيقي
    return {
      uid: `sandbox-${accessToken.slice(0, 8)}`,
      username: `sandbox_user_${accessToken.slice(0, 6)}`,
      roles: ['member'],
    }
  }
}
