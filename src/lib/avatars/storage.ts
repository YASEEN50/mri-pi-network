import { saveUploadedFile, productionStorageBlockedMessage } from '@/lib/storage/production-storage'
import type { AllowedMimeType } from '@/core/interfaces/services/file-storage.interface'

export async function saveAvatarFile(
  userId: string,
  buffer: Buffer,
  mimeType: AllowedMimeType,
): Promise<string> {
  return saveUploadedFile(buffer, {
    folder: 'avatars',
    mimeType,
    filename: userId,
  })
}

export function avatarStorageUnavailableMessage(): string | null {
  return productionStorageBlockedMessage()
}
