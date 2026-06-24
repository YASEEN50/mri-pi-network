'use client'

import ChatWorkspace from '@/components/chat/ChatWorkspace'

export default function ClientChatPage() {
  return (
    <ChatWorkspace
      emptyRoomsHint="لا توجد محادثات بعد. احجز موعداً مع طبيب للبدء."
      otherPartyFallback="طبيب"
    />
  )
}
