import { DEFAULT_PARAMS, type InputImage, type PromptSquareFavoriteCollection, type PromptSquareItem, type PromptSquareManifest, type PromptSquareMediaType, type TaskParams } from '../types'

export const PROMPT_SQUARE_MANIFEST_VERSION = 1
export const DEFAULT_PROMPT_SQUARE_MEDIA_TYPE: PromptSquareMediaType = 'image'
export const DEFAULT_PROMPT_SQUARE_CATEGORY = '未分类'
export const ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID = '__all_prompt_square_favorites__'
export const DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID = '__default_prompt_square_favorites__'
export const DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_NAME = '默认'

export const PROMPT_SQUARE_MEDIA_TYPES: Array<{ value: PromptSquareMediaType; label: string }> = [
  { value: 'image', label: '图像' },
  { value: 'video', label: '视频' },
  { value: 'functional', label: '功能' },
]

const PROMPT_SQUARE_MEDIA_TYPE_VALUES = new Set<PromptSquareMediaType>(PROMPT_SQUARE_MEDIA_TYPES.map((item) => item.value))

export interface PromptSquareDraft {
  id?: string
  title?: string
  prompt?: string
  category?: string
  mediaType?: PromptSquareMediaType
  tagsText?: string
  tags?: string[]
  modelHint?: string
  quality?: TaskParams['quality']
  aspectRatio?: string
  effectImages?: InputImage[]
  referenceImages?: InputImage[]
  isFeatured?: boolean
  isFavorite?: boolean
  favoriteCollectionIds?: string[]
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
  if (!draft.mediaType || !PROMPT_SQUARE_MEDIA_TYPE_VALUES.has(draft.mediaType)) errors.push('类型无效')
  return errors
}

function normalizePromptSquareQuality(value: unknown): TaskParams['quality'] {
  return value === 'auto' || value === 'low' || value === 'medium' || value === 'high'
    ? value
    : DEFAULT_PARAMS.quality
}

function normalizePromptSquareImages(value: unknown): InputImage[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const images: InputImage[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl.trim() : ''
    if (!id || !dataUrl.startsWith('data:image/') || seen.has(id)) continue
    seen.add(id)
    images.push({ id, dataUrl })
  }
  return images
}

function normalizeFavoriteCollectionName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function createDefaultPromptSquareFavoriteCollection(now = Date.now()): PromptSquareFavoriteCollection {
  return {
    id: DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID,
    name: DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_NAME,
    createdAt: now,
    updatedAt: now,
  }
}

export function normalizePromptSquareFavoriteCollectionIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .map((id) => typeof id === 'string' ? id.trim() : String(id).trim())
      .filter((id) => id && id !== ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID),
  ))
}

export function normalizePromptSquareFavoriteCollections(value: unknown, now = Date.now()): PromptSquareFavoriteCollection[] {
  const collections = Array.isArray(value) ? value : []
  const normalized: PromptSquareFavoriteCollection[] = []
  const ids = new Set<string>()

  for (const item of collections) {
    if (!isRecord(item)) continue
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    const name = normalizeFavoriteCollectionName(typeof item.name === 'string' ? item.name : '')
    if (!id || id === ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID || !name || ids.has(id)) continue
    ids.add(id)
    normalized.push({
      id,
      name,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
    })
  }

  return normalized
}

export function ensurePromptSquareDefaultFavoriteCollection(
  collections: PromptSquareFavoriteCollection[],
  now = Date.now(),
) {
  if (collections.some((collection) => collection.id === DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID)) {
    return collections
  }
  return [createDefaultPromptSquareFavoriteCollection(now), ...collections]
}

export function resolvePromptSquareDefaultFavoriteCollectionId(
  collections: PromptSquareFavoriteCollection[],
  preferredId: unknown,
) {
  if (typeof preferredId === 'string' && collections.some((collection) => collection.id === preferredId)) return preferredId
  if (collections.some((collection) => collection.id === DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID)) {
    return DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID
  }
  return collections[0]?.id ?? null
}

export function normalizePromptSquareFavoriteState(
  items: PromptSquareItem[],
  collections: PromptSquareFavoriteCollection[],
  preferredDefaultCollectionId: string | null,
  now = Date.now(),
) {
  const normalizedCollections = ensurePromptSquareDefaultFavoriteCollection(
    normalizePromptSquareFavoriteCollections(collections, now),
    now,
  )
  const collectionIdSet = new Set(normalizedCollections.map((collection) => collection.id))
  const defaultCollectionId = resolvePromptSquareDefaultFavoriteCollectionId(normalizedCollections, preferredDefaultCollectionId)
  const normalizedItems = items.map((item) => normalizePromptSquareItemFavoriteState(item, collectionIdSet, defaultCollectionId))
  return {
    items: normalizedItems,
    collections: normalizedCollections,
    defaultCollectionId,
  }
}

export function normalizePromptSquareItemFavoriteState(
  item: PromptSquareItem,
  validCollectionIds: Set<string>,
  defaultCollectionId: string | null,
): PromptSquareItem {
  const { accentColor: _accentColor, ...itemWithoutAccentColor } = item as PromptSquareItem & { accentColor?: unknown }
  const filteredIds = normalizePromptSquareFavoriteCollectionIds(item.favoriteCollectionIds)
    .filter((id) => validCollectionIds.has(id))
  const ids = filteredIds.length ? filteredIds : item.isFavorite && defaultCollectionId ? [defaultCollectionId] : []
  return {
    ...itemWithoutAccentColor,
    favoriteCollectionIds: ids,
    isFavorite: ids.length > 0,
  }
}

export function createPromptSquareFavoriteCollection(
  collections: PromptSquareFavoriteCollection[],
  name: string,
  now = Date.now(),
) {
  const normalizedName = normalizeFavoriteCollectionName(name)
  if (!normalizedName) return null
  const existing = collections.find((collection) => collection.name === normalizedName)
  if (existing) return existing
  return {
    id: `prompt-square-favorite-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
  }
}

export function renamePromptSquareFavoriteCollection(
  collections: PromptSquareFavoriteCollection[],
  collectionId: string,
  name: string,
  now = Date.now(),
) {
  const normalizedName = normalizeFavoriteCollectionName(name)
  if (!normalizedName || collectionId === ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID) return collections
  return collections.map((collection) => (
    collection.id === collectionId ? { ...collection, name: normalizedName, updatedAt: now } : collection
  ))
}

export function removePromptSquareFavoriteCollection(
  items: PromptSquareItem[],
  collections: PromptSquareFavoriteCollection[],
  defaultCollectionId: string | null,
  collectionId: string,
) {
  if (!collectionId || collectionId === ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID || collections.length <= 1) {
    return { items, collections, defaultCollectionId }
  }
  const nextCollections = collections.filter((collection) => collection.id !== collectionId)
  if (nextCollections.length === collections.length || nextCollections.length < 1) {
    return { items, collections, defaultCollectionId }
  }
  const validCollectionIds = new Set(nextCollections.map((collection) => collection.id))
  const nextDefaultCollectionId = resolvePromptSquareDefaultFavoriteCollectionId(nextCollections, defaultCollectionId === collectionId ? null : defaultCollectionId)
  return {
    collections: nextCollections,
    defaultCollectionId: nextDefaultCollectionId,
    items: items.map((item) => normalizePromptSquareItemFavoriteState({
      ...item,
      favoriteCollectionIds: normalizePromptSquareFavoriteCollectionIds(item.favoriteCollectionIds).filter((id) => id !== collectionId),
      isFavorite: item.isFavorite,
    }, validCollectionIds, null)),
  }
}

export function getPromptSquareItemFavoriteCollectionIds(item: PromptSquareItem) {
  return normalizePromptSquareFavoriteCollectionIds(item.favoriteCollectionIds)
}

export function getPromptSquareFavoriteCollectionTitle(collectionId: string | null, collections: PromptSquareFavoriteCollection[]) {
  if (collectionId === ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID) return '全部'
  return collections.find((collection) => collection.id === collectionId)?.name ?? DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_NAME
}

export function normalizePromptSquareDraft(draft: PromptSquareDraft, now = Date.now()): PromptSquareItem {
  const mediaType = draft.mediaType && PROMPT_SQUARE_MEDIA_TYPE_VALUES.has(draft.mediaType)
    ? draft.mediaType
    : DEFAULT_PROMPT_SQUARE_MEDIA_TYPE
  const createdAt = draft.createdAt ?? now
  const tags = draft.tags ?? parsePromptSquareTags(draft.tagsText ?? '')
  const favoriteCollectionIds = normalizePromptSquareFavoriteCollectionIds(draft.favoriteCollectionIds)

  return {
    id: draft.id || `prompt-square-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: draft.title?.trim() ?? '',
    prompt: draft.prompt?.trim() ?? '',
    category: draft.category?.trim() || DEFAULT_PROMPT_SQUARE_CATEGORY,
    mediaType,
    tags,
    modelHint: draft.modelHint?.trim() || undefined,
    quality: normalizePromptSquareQuality(draft.quality),
    aspectRatio: draft.aspectRatio?.trim() || undefined,
    effectImages: normalizePromptSquareImages(draft.effectImages),
    referenceImages: normalizePromptSquareImages(draft.referenceImages),
    isFeatured: Boolean(draft.isFeatured),
    favoriteCollectionIds,
    isFavorite: favoriteCollectionIds.length > 0 || Boolean(draft.isFavorite),
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
    quality: item.quality ?? DEFAULT_PARAMS.quality,
    aspectRatio: item.aspectRatio ?? '',
    effectImages: item.effectImages?.map((image) => ({ ...image })) ?? [],
    referenceImages: item.referenceImages?.map((image) => ({ ...image })) ?? [],
    isFeatured: Boolean(item.isFeatured),
    isFavorite: Boolean(item.isFavorite),
    favoriteCollectionIds: getPromptSquareItemFavoriteCollectionIds(item),
    createdAt: item.createdAt,
  }
}

export function sortPromptSquareItems(items: PromptSquareItem[]) {
  return [...items].sort((a, b) => {
    if (Boolean(a.isFeatured) !== Boolean(b.isFeatured)) return a.isFeatured ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

export function createPromptSquareManifest(
  items: PromptSquareItem[],
  collectionsOrExportedAt: PromptSquareFavoriteCollection[] | number = [],
  defaultCollectionId: string | null = null,
  exportedAt = Date.now(),
): PromptSquareManifest {
  const collections = typeof collectionsOrExportedAt === 'number' ? [] : collectionsOrExportedAt
  const resolvedExportedAt = typeof collectionsOrExportedAt === 'number' ? collectionsOrExportedAt : exportedAt
  const normalized = normalizePromptSquareFavoriteState(items, collections, defaultCollectionId, resolvedExportedAt)
  return {
    version: PROMPT_SQUARE_MANIFEST_VERSION,
    exportedAt: resolvedExportedAt,
    items: sortPromptSquareItems(normalized.items),
    collections: normalized.collections,
    defaultCollectionId: normalized.defaultCollectionId,
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
    quality: normalizePromptSquareQuality(value.quality),
    aspectRatio: typeof value.aspectRatio === 'string' ? value.aspectRatio : '',
    effectImages: normalizePromptSquareImages(value.effectImages),
    referenceImages: normalizePromptSquareImages(value.referenceImages),
    isFeatured: Boolean(value.isFeatured),
    isFavorite: Boolean(value.isFavorite),
    favoriteCollectionIds: normalizePromptSquareFavoriteCollectionIds(value.favoriteCollectionIds),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
  }, now)

  return validatePromptSquareDraft(normalized).length ? null : normalized
}

export type ParsePromptSquareManifestResult =
  | { ok: true; items: PromptSquareItem[]; collections: PromptSquareFavoriteCollection[]; defaultCollectionId: string | null }
  | { ok: false; error: string }

export function parsePromptSquareManifest(value: unknown, now = Date.now()): ParsePromptSquareManifestResult {
  if (!isRecord(value)) return { ok: false, error: '导入文件结构无效' }
  if (value.version !== PROMPT_SQUARE_MANIFEST_VERSION) return { ok: false, error: '导入文件版本不支持' }
  if (!Array.isArray(value.items)) return { ok: false, error: '导入文件缺少 items' }

  const items = value.items.map((item) => normalizeImportedPromptSquareItem(item, now))
  if (items.some((item) => !item)) return { ok: false, error: '导入文件包含无效提示词' }

  const collections = ensurePromptSquareDefaultFavoriteCollection(
    normalizePromptSquareFavoriteCollections(value.collections, now),
    now,
  )
  const normalized = normalizePromptSquareFavoriteState(
    items as PromptSquareItem[],
    collections,
    typeof value.defaultCollectionId === 'string' ? value.defaultCollectionId : null,
    now,
  )
  return { ok: true, ...normalized }
}
