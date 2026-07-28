/**
 * Prepares a picked photo for use as a profile picture.
 *
 * A phone camera roll image is several megabytes and many times larger than
 * the 64px circle it ends up in, so it is centre-cropped to a square and
 * scaled down before it goes anywhere near the network — or, in demo mode,
 * near localStorage.
 */

const SIZE = 512
const QUALITY = 0.85

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export async function prepareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That image is very large — please pick one under 8 MB.')
  }

  const bitmap = await loadBitmap(file)
  try {
    // Centre crop to a square: the picture is shown in a circle, so cropping
    // to the middle is what people expect rather than squashing it.
    const edge = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - edge) / 2
    const sy = (bitmap.height - edge) / 2

    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process that image.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, edge, edge, 0, 0, SIZE, SIZE)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    if (!blob) throw new Error('Could not process that image.')
    return blob
  } finally {
    bitmap.close?.()
  }
}

/** createImageBitmap where available, falling back for older Safari. */
async function loadBitmap(file: File): Promise<ImageBitmap & { close?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Some formats (notably HEIC) throw here; fall through to the <img> path.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That image could not be opened. Try a JPEG or PNG.'))
      el.src = url
    })
    return img as unknown as ImageBitmap
  } finally {
    URL.revokeObjectURL(url)
  }
}
