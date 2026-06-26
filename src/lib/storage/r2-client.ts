// src/lib/storage/r2-client.ts
// Cloudflare R2 — S3-compatible client

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { StorageError } from '@/core/errors'

export const DEFAULT_R2_ENDPOINT =
  'https://111b05170d4f3edce3a50012d9a04ac2.r2.cloudflarestorage.com'

export function getR2Endpoint(): string {
  const fromEnv = process.env.R2_ENDPOINT?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  if (accountId) {
    return `https://${accountId}.r2.cloudflarestorage.com`
  }

  return DEFAULT_R2_ENDPOINT
}

export function getR2PublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL?.trim()
  if (!url) {
    throw new Error('Missing R2 environment variable: R2_PUBLIC_URL')
  }
  return url.replace(/\/$/, '')
}

export function getR2BucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  if (!bucket) {
    throw new Error('Missing R2 environment variable: R2_BUCKET_NAME')
  }
  return bucket
}

export function getMissingR2ClientEnvVars(): string[] {
  return [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
  ].filter((key) => !process.env[key]?.trim())
}

let _client: S3Client | null = null

export function getR2Client(): S3Client {
  if (_client) return _client

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 environment variables: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY',
    )
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(),
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  return _client
}

export type UploadFileInput = {
  key: string
  body: Buffer | NodeJS.ReadableStream | Readable
  contentType: string
}

function mapR2UploadError(err: unknown): StorageError {
  const detail =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name?: string; Code?: string }).name ?? (err as { Code?: string }).Code ?? '')
      : ''

  if (detail === 'AccessDenied' || detail === 'Forbidden') {
    return new StorageError('رفض R2 الطلب — تحقق من صلاحيات API Token على الـ bucket')
  }
  if (detail === 'InvalidAccessKeyId' || detail === 'SignatureDoesNotMatch') {
    return new StorageError('مفاتيح R2 غير صحيحة — راجع R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY')
  }
  if (detail === 'NoSuchBucket') {
    return new StorageError('اسم الـ bucket غير موجود — راجع R2_BUCKET_NAME')
  }
  if (detail === 'NotImplemented') {
    return new StorageError('R2 رفض الطلب (NotImplemented)')
  }
  return new StorageError('فشل رفع الملف إلى R2')
}

/** Upload a file to R2 and return its public URL. */
export async function uploadFile(
  input: UploadFileInput,
): Promise<{ url: string; key: string }> {
  const key = input.key.replace(/^\/+/, '')
  const bucket = getR2BucketName()
  const client = getR2Client()

  const commandInput: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: input.body as PutObjectCommandInput['Body'],
    ContentType: input.contentType,
  }

  try {
    await client.send(new PutObjectCommand(commandInput))
    return {
      key,
      url: `${getR2PublicUrl()}/${key}`,
    }
  } catch (err) {
    console.error('[R2Client] uploadFile error:', err)
    throw mapR2UploadError(err)
  }
}

async function streamToBuffer(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/** Delete object from R2 (best-effort). */
export async function deleteFile(key: string): Promise<void> {
  const client = getR2Client()
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: getR2BucketName(),
        Key: key.replace(/^\/+/, ''),
      }),
    )
  } catch (err) {
    console.error('[R2Client] deleteFile error:', err)
  }
}

/** Download object bytes from R2 (workers / OCR). */
export async function downloadFile(key: string): Promise<Buffer> {
  const client = getR2Client()
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: key.replace(/^\/+/, ''),
      }),
    )
    if (!res.Body) {
      throw new StorageError('الملف غير موجود في R2')
    }
    return streamToBuffer(res.Body as Readable)
  } catch (err) {
    if (err instanceof StorageError) throw err
    console.error('[R2Client] downloadFile error:', err)
    throw new StorageError('فشل قراءة الملف من R2')
  }
}
