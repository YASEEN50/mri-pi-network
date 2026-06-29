import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { ok, fromAppError, serverError } from '@/lib/api-response'
import { getChatRoomForUser } from '@/lib/chat/access'
import {
  productionStorageBlockedMessage,
  saveUploadedFile,
} from '@/lib/storage/production-storage'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'application/pdf'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.success) return fromAppError(auth.error)

    const blocked = productionStorageBlockedMessage()
    if (blocked) return ok({ error: true, message: blocked })

    const { roomId } = await params
    const room = await getChatRoomForUser(roomId, auth.context.userId, auth.context.role)
    if (!room || room.status !== 'ACTIVE') {
      return ok({ error: true, message: 'الغرفة غير متاحة' })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return ok({ error: true, message: 'لم يُرفَع ملف' })
    }
    if (!ALLOWED.has(file.type)) {
      return ok({ error: true, message: 'نوع الملف غير مدعوم (jpg, png, pdf)' })
    }
    if (file.size > MAX_BYTES) {
      return ok({ error: true, message: 'الحد الأقصى 5 ميجابايت' })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await saveUploadedFile(buffer, {
      folder: 'chat',
      mimeType: file.type as 'image/jpeg' | 'image/png' | 'application/pdf',
      filename: roomId.slice(0, 8),
    })

    return ok({ fileUrl: url, fileType: file.type })
  } catch (err) {
    console.error('[POST /api/chat/[roomId]/upload]', err)
    return serverError()
  }
}
