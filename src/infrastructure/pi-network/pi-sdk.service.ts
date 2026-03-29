// =============================================================================
// src/infrastructure/pi-network/pi-sdk.service.ts
// Pi Network SDK — server-side verification
// =============================================================================

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
    const apiKey = process.env.PI_API_KEY
    if (!apiKey) throw new Error('PI_API_KEY is not set')

    this.apiKey = apiKey
    this.isSandbox = process.env.PI_SANDBOX === 'true'
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
    try {
      const res = await fetch(`${this.baseUrl}/v2/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        console.error('[Pi SDK] Token verification failed:', res.status)
        return null
      }

      const data = await res.json()
      return {
        uid: data.uid,
        username: data.username,
        roles: data.roles ?? [],
      }
    } catch (err) {
      console.error('[Pi SDK] verifyAccessToken error:', err)
      return null
    }
  }

  // -------------------------------------------------------------------------
  // Get user KYC status
  // -------------------------------------------------------------------------
  async getKYCStatus(piUid: string): Promise<PiKYCStatus> {
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
