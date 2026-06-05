import type { PromptSquareItem, PromptSquareManifest, PromptSquareMediaType } from '../types'

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

export function promptSquareItemToDraft(item: PromptSquareItem): PromptSquareDraft {
  return {
    id: item.id,
    title: item.title,
    prompt: item.prompt,
    category: item.category,
    mediaType: item.mediaType,
    tagsText: item.tags.join(', '),
    modelHint: item.modelHint ?? '',
    aspectRatio: item.aspectRatio ?? '',
    accentColor: item.accentColor ?? '',
    isFeatured: Boolean(item.isFeatured),
    isFavorite: Boolean(item.isFavorite),
    createdAt: item.createdAt,
  }
}

export function sortPromptSquareItems(items: PromptSquareItem[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.isFeatured) !== Boolean(b.isFeatured)) return a.isFeatured ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

export function createPromptSquareManifest(items: PromptSquareItem[], exportedAt = Date.now()): PromptSquareManifest {
  return {
    version: PROMPT_SQUARE_MANIFEST_VERSION,
    exportedAt,
    items: sortPromptSquareItems(items),
    collections: [],
    defaultCollectionId: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeImportedPromptSquareItem(value: unknown, now = Date.now()): PromptSquareItem | null {
  if (!isRecord(value)) return null
  const mediaType = value.mediaType === 'image' || value.mediaType === 'video' || value.mediaType === 'functional'
    ? value.mediaType
    : null
  if (!mediaType) return null

  const tags = Array.isArray(value.tags)
    ? parsePromptSquareTags(value.tags.map((tag) => String(tag)).join(','))
    : []

  const normalized = normalizePromptSquareDraft({
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : undefined,
    title: typeof value.title === 'string' ? value.title : '',
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    category: typeof value.category === 'string' ? value.category : '',
    mediaType,
    tags,
    modelHint: typeof value.modelHint === 'string' ? value.modelHint : '',
    aspectRatio: typeof value.aspectRatio === 'string' ? value.aspectRatio : '',
    accentColor: typeof value.accentColor === 'string' ? value.accentColor : '',
    isFeatured: Boolean(value.isFeatured),
    isFavorite: Boolean(value.isFavorite),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
  }, now)

  return validatePromptSquareDraft(normalized).length ? null : normalized
}

export type ParsePromptSquareManifestResult =
  | { ok: true; items: PromptSquareItem[] }
  | { ok: false; error: string }

export function parsePromptSquareManifest(value: unknown, now = Date.now()): ParsePromptSquareManifestResult {
  if (!isRecord(value)) return { ok: false, error: '导入文件结构无效' }
  if (value.version !== PROMPT_SQUARE_MANIFEST_VERSION) return { ok: false, error: '导入文件版本不支持' }
  if (!Array.isArray(value.items)) return { ok: false, error: '导入文件缺少 items' }

  const items = value.items.map((item) => normalizeImportedPromptSquareItem(item, now))
  if (items.some((item) => !item)) return { ok: false, error: '导入文件包含无效提示词' }
  return { ok: true, items: items as PromptSquareItem[] }
}
