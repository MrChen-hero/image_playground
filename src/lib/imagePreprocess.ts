import type { AppSettings } from '../types'

const JPEG_QUALITY_STEPS = [0.86, 0.8, 0.72, 0.64, 0.56]
const LONG_EDGE_STEPS = [2048, 1600, 1280, 1024, 768]

export interface ReferenceImagePreprocessResult {
  dataUrl: string
  originalBytes: number
  outputBytes: number
  changed: boolean
  formatChanged: boolean
  warning?: string
}

export async function preprocessReferenceImageFile(
  file: File,
  settings: AppSettings,
): Promise<ReferenceImagePreprocessResult> {
  const dataUrl = await fileToDataUrl(file)
  return preprocessReferenceImageDataUrl(dataUrl, settings)
}

export async function preprocessReferenceImageDataUrl(
  dataUrl: string,
  settings: AppSettings,
): Promise<ReferenceImagePreprocessResult> {
  const originalBytes = dataUrlByteSize(dataUrl)
  const targetBytes = Math.max(1, settings.referenceCompressionTargetKb || 0) * 1024
  const originalMime = getDataUrlMime(dataUrl)

  if (!settings.referenceCompressionEnabled || originalBytes <= targetBytes) {
    return {
      dataUrl,
      originalBytes,
      outputBytes: originalBytes,
      changed: false,
      formatChanged: false,
    }
  }

  if (originalMime === 'image/gif' || originalMime === 'image/svg+xml') {
    return {
      dataUrl,
      originalBytes,
      outputBytes: originalBytes,
      changed: false,
      formatChanged: false,
      warning: '该图片格式不适合浏览器端压缩，已保留原图',
    }
  }

  try {
    const image = await loadImage(dataUrl)
    const transparent = await hasTransparentPixels(image)
    const outputMime = transparent ? 'image/png' : 'image/jpeg'
    const attempts = transparent
      ? await createPngAttempts(image, targetBytes)
      : await createJpegAttempts(image, targetBytes)

    const bestWithinTarget = attempts.find((attempt) => attempt.bytes <= targetBytes)
    const smallest = attempts.reduce((best, item) => (item.bytes < best.bytes ? item : best), attempts[0])
    const selected = bestWithinTarget ?? smallest

    if (!selected || selected.bytes >= originalBytes) {
      return {
        dataUrl,
        originalBytes,
        outputBytes: originalBytes,
        changed: false,
        formatChanged: false,
        warning: '压缩后体积未变小，已保留原图',
      }
    }

    return {
      dataUrl: selected.dataUrl,
      originalBytes,
      outputBytes: selected.bytes,
      changed: selected.dataUrl !== dataUrl,
      formatChanged: outputMime !== originalMime,
      warning: selected.bytes > targetBytes ? '参考图仍大于目标大小，Responses API 代理可能仍返回 413' : undefined,
    }
  } catch (err) {
    return {
      dataUrl,
      originalBytes,
      outputBytes: originalBytes,
      changed: false,
      formatChanged: false,
      warning: err instanceof Error ? `图片压缩失败：${err.message}` : '图片压缩失败，已保留原图',
    }
  }
}

export function dataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return new TextEncoder().encode(dataUrl).length

  const header = dataUrl.slice(0, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  if (!/;base64/i.test(header)) return new TextEncoder().encode(decodeURIComponent(payload)).length

  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getDataUrlMime(dataUrl: string): string {
  return dataUrl.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() ?? 'image/png'
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法解码图片'))
    image.src = dataUrl
  })
}

async function hasTransparentPixels(image: HTMLImageElement): Promise<boolean> {
  const { canvas, ctx } = drawImageToCanvas(image, Math.min(Math.max(image.naturalWidth, image.naturalHeight), 512))
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

async function createJpegAttempts(
  image: HTMLImageElement,
  targetBytes: number,
): Promise<Array<{ dataUrl: string; bytes: number }>> {
  const attempts: Array<{ dataUrl: string; bytes: number }> = []

  for (const maxLongEdge of LONG_EDGE_STEPS) {
    for (const quality of JPEG_QUALITY_STEPS) {
      const { canvas } = drawImageToCanvas(image, maxLongEdge, '#fff')
      const dataUrl = await canvasToDataUrl(canvas, 'image/jpeg', quality)
      const bytes = dataUrlByteSize(dataUrl)
      attempts.push({ dataUrl, bytes })
      if (bytes <= targetBytes) return attempts
    }
  }

  return attempts
}

async function createPngAttempts(
  image: HTMLImageElement,
  targetBytes: number,
): Promise<Array<{ dataUrl: string; bytes: number }>> {
  const attempts: Array<{ dataUrl: string; bytes: number }> = []

  for (const maxLongEdge of LONG_EDGE_STEPS) {
    const { canvas } = drawImageToCanvas(image, maxLongEdge)
    const dataUrl = await canvasToDataUrl(canvas, 'image/png')
    const bytes = dataUrlByteSize(dataUrl)
    attempts.push({ dataUrl, bytes })
    if (bytes <= targetBytes) return attempts
  }

  return attempts
}

function drawImageToCanvas(
  image: HTMLImageElement,
  maxLongEdge: number,
  background?: string,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const scale = Math.min(1, maxLongEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 压缩')

  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(image, 0, 0, width, height)
  return { canvas, ctx }
}

function canvasToDataUrl(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas 导出图片失败'))
          return
        }

        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      },
      mime,
      quality,
    )
  })
}
