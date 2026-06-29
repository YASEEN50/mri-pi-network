/**
 * Saudi license verification — scaffold until official API credentials are provided.
 * Set SCFHS_LICENSE_API_URL + SCFHS_LICENSE_API_KEY to enable live checks.
 */

export interface LicenseVerifyResult {
  status: 'verified' | 'not_found' | 'mismatch' | 'unavailable' | 'error'
  message: string
  registryName?: string | null
  registryExpiry?: string | null
  checkedAt: string
}

export function isSaudiLicenseApiConfigured(): boolean {
  return !!(process.env.SCFHS_LICENSE_API_URL && process.env.SCFHS_LICENSE_API_KEY)
}

export async function verifySaudiMedicalLicense(params: {
  licenseNumber: string
  holderName?: string | null
}): Promise<LicenseVerifyResult> {
  const checkedAt = new Date().toISOString()

  if (!isSaudiLicenseApiConfigured()) {
    return {
      status: 'unavailable',
      message: 'التحقق الرسمي غير مُفعّل — أضف SCFHS_LICENSE_API_URL و SCFHS_LICENSE_API_KEY',
      checkedAt,
    }
  }

  const baseUrl = process.env.SCFHS_LICENSE_API_URL!.replace(/\/$/, '')
  const url = `${baseUrl}/verify?license=${encodeURIComponent(params.licenseNumber)}`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.SCFHS_LICENSE_API_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) {
      return {
        status: 'error',
        message: `فشل الاتصال بالسجل (${res.status})`,
        checkedAt,
      }
    }

    const data = (await res.json()) as {
      valid?: boolean
      name?: string
      expiry?: string
    }

    if (!data.valid) {
      return {
        status: 'not_found',
        message: 'رقم الرخصة غير موجود في السجل',
        checkedAt,
      }
    }

    return {
      status: 'verified',
      message: 'الرخصة موجودة في السجل',
      registryName: data.name ?? null,
      registryExpiry: data.expiry ?? null,
      checkedAt,
    }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'خطأ في التحقق',
      checkedAt,
    }
  }
}
