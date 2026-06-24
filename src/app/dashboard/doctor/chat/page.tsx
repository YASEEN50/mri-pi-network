'use client'

import ChatWorkspace from '@/components/chat/ChatWorkspace'

export default function DoctorChatPage() {
  return (
    <ChatWorkspace
      emptyRoomsHint="لا توجد محادثات من المرضى بعد."
      otherPartyFallback="مريض"
    />
  )
}
