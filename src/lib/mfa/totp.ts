import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'
import { hash, compare } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { decryptMfaSecret, encryptMfaSecret } from '@/lib/mfa/secret-crypto'

export const MFA_ISSUER = 'MRI Medical Platform'

export function generateTotpSecret(): string {
  return generateSecret()
}

export function buildOtpAuthUrl(email: string, secret: string): string {
  return generateURI({
    issuer: MFA_ISSUER,
    label: email,
    secret,
  })
}

export async function qrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 })
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({
      secret,
      token: code.replace(/\s/g, ''),
      epochTolerance: 30,
    })
    return result.valid
  } catch {
    return false
  }
}

export async function verifyStoredTotp(encryptedSecret: string, code: string): Promise<boolean> {
  try {
    const secret = decryptMfaSecret(encryptedSecret)
    return verifyTotpCode(secret, code)
  } catch {
    return false
  }
}

export function encryptSecretForStorage(secret: string): string {
  return encryptMfaSecret(secret)
}

export async function generateBackupCodes(count = 8): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: count }, () =>
    randomBytes(4).toString('hex').toUpperCase(),
  )
  const hashed = await Promise.all(plain.map(c => hash(c, 10)))
  return { plain, hashed }
}

export async function consumeBackupCode(
  code: string,
  storedHashes: string[],
): Promise<{ matched: boolean; remaining: string[] }> {
  const normalized = code.replace(/\s/g, '').toUpperCase()
  for (let i = 0; i < storedHashes.length; i++) {
    if (await compare(normalized, storedHashes[i])) {
      return { matched: true, remaining: storedHashes.filter((_, idx) => idx !== i) }
    }
  }
  return { matched: false, remaining: storedHashes }
}
