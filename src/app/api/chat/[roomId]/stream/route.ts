import { NextRequest } from 'next/server'
import { requireAuth } from '@/infrastructure/auth/providers/role-guard'
import { fromAppError } from '@/lib/api-response'
import { getChatRoomForUser } from '@/lib/chat/access'
import { db } from '@/lib/prisma'
import { touchChatPresence } from '@/lib/chat/presence'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function mapMessage(msg: {
  id: string
  senderId: string
  content: string
  createdAt: Date
  fileUrl: string | null
}) {
  return {
    id: msg.id,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    fileUrl: msg.fileUrl ?? undefined,
  }
}

/** Server-Sent Events — pushes new chat messages (replaces fast client polling). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await requireAuth()
  if (!auth.success) return fromAppError(auth.error)

  const { userId } = auth.context
  const { roomId } = await params
  const room = await getChatRoomForUser(roomId, auth.context.userId, auth.context.role)
  if (!room) {
    return new Response('Unauthorized', { status: 403 })
  }

  if (room.status !== 'ACTIVE') {
    return new Response('Room not active', { status: 400 })
  }

  const sinceParam = req.nextUrl.searchParams.get('since')
  let cursor = sinceParam ? new Date(sinceParam) : new Date(0)
  if (Number.isNaN(cursor.getTime())) cursor = new Date(0)

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      const tick = async () => {
        if (closed) return
        try {
          await touchChatPresence(userId, roomId)

          const messages = await db.chatMessage.findMany({
            where: {
              roomId,
              deletedAt: null,
              createdAt: { gt: cursor },
            },
            orderBy: { createdAt: 'asc' },
            take: 50,
          })

          for (const msg of messages) {
            send({ type: 'message', message: mapMessage(msg) })
            cursor = msg.createdAt
          }

          send({ type: 'heartbeat', at: new Date().toISOString() })
        } catch {
          closed = true
          controller.close()
        }
      }

      void tick()
      const timer = setInterval(() => void tick(), 1500)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(timer)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
