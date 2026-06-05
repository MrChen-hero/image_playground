import type { PromptSquareItem, PromptSquareMediaType } from '../types'

export const PROMPT_SQUARE_MANIFEST_VERSION = 1
export const DEFAULT_PROMPT_SQUARE_MEDIA_TYPE: PromptSquareMediaType = 'image'
export const DEFAULT_PROMPT_SQUARE_CATEGORY = '未分类'

export const PROMPT_SQUARE_MEDIA_TYPES: Array<{ value: PromptSquareMediaType; label: string }> = [
  { value: 'image', label: '图像' },
  { value: 'video', label: '视频' },
  { value: 'functional', label: '功能' },
]

const DEFAULT_ACCENT_COLORS: Record<PromptSquareMediaType, string> = {
  image: '#2563eb',
  video: '#334155',
  functional: '#4f46e5',
}

export interface PromptSquareDraft {
  id?: string
  title?: string
  prompt?: string
  category?: string
  mediaType?: PromptSquareMediaType
  tagsText?: string
  tags?: string[]
  modelHint?: string
  aspectRatio?: string
  accentColor?: string
  isFeatured?: boolean
  isFavorite?: boolean
  createdAt?: number
}

export function parsePromptSquareTags(value: string) {
  return Array.from(new Set(value
    .split(/[\n,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)))
}

export function validatePromptSquareDraft(draft: Pick<PromptSquareDraft, 'title' | 'prompt' | 'mediaType'>) {
  const errors: string[] = []
  if (!draft.title?.trim()) errors.push('标题不能为空')
  if (!draft.prompt?.trim()) errors.push('提示词不能为空')
  if (!draft.mediaType || !DEFAULT_ACCENT_COLORS[draft.mediaType]) errors.push('类型无效')
  return errors
}

export function normalizePromptSquareDraft(draft: PromptSquareDraft, now = Date.now()): PromptSquareItem {
  const mediaType = draft.mediaType && DEFAULT_ACCENT_COLORS[draft.mediaType]
    ? draft.mediaType
    : DEFAULT_PROMPT_SQUARE_MEDIA_TYPE
  const createdAt = draft.createdAt ?? now
  const tags = draft.tags ?? parsePromptSquareTags(draft.tagsText ?? '')

  return {
    id: draft.id || `prompt-square-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: draft.title?.trim() ?? '',
    prompt: draft.prompt?.trim() ?? '',
    category: draft.category?.trim() || DEFAULT_PROMPT_SQUARE_CATEGORY,
    mediaType,
    tags,
    modelHint: draft.modelHint?.trim() || undefined,
    aspectRatio: draft.aspectRatio?.trim() || undefined,
    accentColor: draft.accentColor?.trim() || DEFAULT_ACCENT_COLORS[mediaType],
    isFeatured: Boolean(draft.isFeatured),
    isFavorite: Boolean(draft.isFavorite),
    createdAt,
    updatedAt: now,
  }
}

export function sortPromptSquareItems(items: PromptSquareItem[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.isFeatured) !== Boolean(b.isFeatured)) return a.isFeatured ? -1 : 1
    return a.createdAt - b.createdAt
  })
}
