// src/app/api/avatars/[filename]/route.ts
// عرض الصور الشخصية — عام (بدون تسجيل دخول)

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const MIME: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
}

const SAFE_FILENAME = /^[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params
    const decoded = decodeURIComponent(filename)

    if (!SAFE_FILENAME.test(decoded) || decoded.includes('..')) {
      return NextResponse.json({ error: true, message: 'مسار غير صالح' }, { status: 400 })
    }

    const ext = decoded.slice(decoded.lastIndexOf('.')).toLowerCase()
    const filePath = join(process.cwd(), '.local-storage', 'avatars', decoded)
    const buffer = await readFile(filePath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: true, message: 'الصورة غير موجودة' }, { status: 404 })
  }
}
