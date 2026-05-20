// src/lib/client/image-compress.ts
// ضغط الصور قبل الرفع (عميل فقط)

import imageCompression from 'browser-image-compression'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function compressImageForUpload(file: File): Promise<File> {
  if (!IMAGE_TYPES.has(file.type)) {
    return file
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB:          2,
      maxWidthOrHeight:   2048,
      useWebWorker:       true,
      initialQuality:     0.85,
      fileType:           file.type === 'image/png' ? 'image/png' : 'image/jpeg',
    })

    const ext = compressed.type === 'image/png' ? '.png' : '.jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload'
    return new File([compressed], `${baseName}${ext}`, {
      type: compressed.type,
      lastModified: Date.now(),
    })
  } catch (err) {
    console.warn('[image-compress] fallback to original:', err)
    return file
  }
}
