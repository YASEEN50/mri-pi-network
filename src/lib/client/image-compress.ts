// src/lib/client/image-compress.ts
// ضغط الصور قبل الرفع (عميل فقط)

import imageCompression from 'browser-image-compression'

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  if (file.type === '') return IMAGE_EXT.test(file.name)
  return false
}

export async function compressImageForUpload(file: File): Promise<File> {
  if (!isLikelyImageFile(file)) {
    return file
  }

  const keepPng = file.type === 'image/png' || /\.png$/i.test(file.name)

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB:          2,
      maxWidthOrHeight:   1024,
      useWebWorker:       true,
      initialQuality:     0.85,
      fileType:           keepPng ? 'image/png' : 'image/jpeg',
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
