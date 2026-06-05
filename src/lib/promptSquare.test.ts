import { describe, expect, it } from 'vitest'
import {
  createPromptSquareManifest,
  DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID,
  DEFAULT_PROMPT_SQUARE_MEDIA_TYPE,
  normalizePromptSquareFavoriteState,
  normalizePromptSquareDraft,
  parsePromptSquareManifest,
  parsePromptSquareTags,
  PROMPT_SQUARE_MEDIA_TYPES,
  promptSquareItemToDraft,
  sortPromptSquareItems,
  validatePromptSquareDraft,
} from './promptSquare'
import type { PromptSquareItem } from '../types'

describe('prompt square normalization', () => {
  it('splits tags by comma, Chinese comma, and newline', () => {
    expect(parsePromptSquareTags('商业, 棚拍，极简\n产品')).toEqual(['商业', '棚拍', '极简', '产品'])
  })

  it('defaults empty category and accent color', () => {
    const normalized = normalizePromptSquareDraft({
      title: '  标题  ',
      prompt: '  prompt  ',
      mediaType: 'image',
      category: '   ',
      tagsText: '',
      modelHint: '',
      quality: undefined,
      aspectRatio: '',
      effectImages: [],
      referenceImages: [],
      accentColor: '',
      isFeatured: false,
    }, 100)

    expect(normalized).toMatchObject({
      title: '标题',
      prompt: 'prompt',
      mediaType: 'image',
      category: '未分类',
      tags: [],
      quality: 'auto',
      effectImages: [],
      referenceImages: [],
      accentColor: '#2563eb',
      isFeatured: false,
      createdAt: 100,
      updatedAt: 100,
    })
    expect(normalized.id).toMatch(/^prompt-square-/)
  })

  it('rejects empty title and prompt', () => {
    expect(validatePromptSquareDraft({ title: '', prompt: '', mediaType: DEFAULT_PROMPT_SQUARE_MEDIA_TYPE })).toEqual([
      '标题不能为空',
      '提示词不能为空',
    ])
  })

  it('sorts pinned items first, then createdAt ascending', () => {
    const items = [
      { id: 'b', isFeatured: false, createdAt: 2 },
      { id: 'c', isFeatured: true, createdAt: 3 },
      { id: 'a', isFeatured: true, createdAt: 1 },
    ] as PromptSquareItem[]

    expect(sortPromptSquareItems(items).map((item) => item.id)).toEqual(['a', 'c', 'b'])
  })

  it('migrates legacy favorite flags into the default prompt square collection', () => {
    const normalized = normalizePromptSquareFavoriteState([
      {
        id: 'legacy-favorite',
        title: 'Title',
        prompt: 'Prompt',
        category: '未分类',
        mediaType: 'image',
        tags: [],
        isFavorite: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ], [], null, 100)

    expect(normalized.collections).toEqual([{
      id: DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID,
      name: '默认',
      createdAt: 100,
      updatedAt: 100,
    }])
    expect(normalized.defaultCollectionId).toBe(DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID)
    expect(normalized.items[0]).toMatchObject({
      isFavorite: true,
      favoriteCollectionIds: [DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID],
    })
  })

  it('deduplicates and filters invalid favorite collection ids', () => {
    const normalized = normalizePromptSquareFavoriteState([
      {
        id: 'item-a',
        title: 'Title',
        prompt: 'Prompt',
        category: '未分类',
        mediaType: 'image',
        tags: [],
        isFavorite: true,
        favoriteCollectionIds: ['collection-a', 'collection-a', 'missing'],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'item-b',
        title: 'Title',
        prompt: 'Prompt',
        category: '未分类',
        mediaType: 'image',
        tags: [],
        isFavorite: true,
        favoriteCollectionIds: ['missing'],
        createdAt: 1,
        updatedAt: 1,
      },
    ], [{
      id: 'collection-a',
      name: 'A',
      createdAt: 1,
      updatedAt: 1,
    }], 'collection-a', 100)

    expect(normalized.items[0]).toMatchObject({
      isFavorite: true,
      favoriteCollectionIds: ['collection-a'],
    })
    expect(normalized.items[1]).toMatchObject({
      isFavorite: true,
      favoriteCollectionIds: ['collection-a'],
    })
  })
})

describe('prompt square manifest', () => {
  it('exports a versioned manifest', () => {
    const manifest = createPromptSquareManifest([], 123)

    expect(manifest).toEqual({
      version: 1,
      exportedAt: 123,
      items: [],
      collections: [{
        id: DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID,
        name: '默认',
        createdAt: 123,
        updatedAt: 123,
      }],
      defaultCollectionId: DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID,
    })
  })

  it('parses and normalizes valid imported items', () => {
    const parsed = parsePromptSquareManifest({
      version: 1,
      exportedAt: 1,
      collections: [{ id: 'collection-a', name: '收藏 A', createdAt: 1, updatedAt: 1 }],
      defaultCollectionId: 'collection-a',
      items: [{
        id: 'imported',
        title: ' Imported ',
        prompt: ' Prompt ',
        category: '',
        mediaType: 'functional',
        tags: ['A', 'A', ' B '],
        quality: 'high',
        effectImages: [{ id: 'effect-a', dataUrl: 'data:image/webp;base64,abc' }],
        referenceImages: [{ id: 'image-a', dataUrl: 'data:image/png;base64,abc' }],
        favoriteCollectionIds: ['collection-a'],
        createdAt: 1,
        updatedAt: 1,
      }],
    }, 10)

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.items[0]).toMatchObject({
        id: 'imported',
        title: 'Imported',
        prompt: 'Prompt',
        category: '未分类',
        mediaType: 'functional',
        tags: ['A', 'B'],
        quality: 'high',
        effectImages: [{ id: 'effect-a', dataUrl: 'data:image/webp;base64,abc' }],
        referenceImages: [{ id: 'image-a', dataUrl: 'data:image/png;base64,abc' }],
        favoriteCollectionIds: ['collection-a'],
        isFavorite: true,
        updatedAt: 10,
      })
      expect(parsed.collections).toEqual([
        { id: DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID, name: '默认', createdAt: 10, updatedAt: 10 },
        { id: 'collection-a', name: '收藏 A', createdAt: 1, updatedAt: 1 },
      ])
      expect(parsed.defaultCollectionId).toBe('collection-a')
    }
  })

  it('exports favorite collections and default collection with items', () => {
    const manifest = createPromptSquareManifest([{
      id: 'item-a',
      title: 'Title',
      prompt: 'Prompt',
      category: '未分类',
      mediaType: 'image',
      tags: [],
      favoriteCollectionIds: ['collection-a'],
      isFavorite: true,
      createdAt: 1,
      updatedAt: 1,
    }], [{
      id: 'collection-a',
      name: '收藏 A',
      createdAt: 1,
      updatedAt: 1,
    }], 'collection-a', 200)

    expect(manifest.collections).toEqual([
      { id: DEFAULT_PROMPT_SQUARE_FAVORITE_COLLECTION_ID, name: '默认', createdAt: 200, updatedAt: 200 },
      { id: 'collection-a', name: '收藏 A', createdAt: 1, updatedAt: 1 },
    ])
    expect(manifest.defaultCollectionId).toBe('collection-a')
    expect(manifest.items[0]).toMatchObject({
      favoriteCollectionIds: ['collection-a'],
      isFavorite: true,
    })
  })

  it('rejects invalid manifest structure', () => {
    expect(parsePromptSquareManifest({ version: 2, items: [] }).ok).toBe(false)
    expect(parsePromptSquareManifest({ version: 1, items: [{ title: '', prompt: '' }] }).ok).toBe(false)
  })
})

describe('prompt square media types', () => {
  it('keeps the runtime media filter options available without seed items', () => {
    expect(PROMPT_SQUARE_MEDIA_TYPES.map((item) => item.value).sort()).toEqual(['functional', 'image', 'video'])
  })
})

describe('prompt square drafts', () => {
  it('converts an item to edit draft text', () => {
    expect(promptSquareItemToDraft({
      id: 'a',
      title: 'Title',
      prompt: 'Prompt',
      category: 'Cat',
      mediaType: 'image',
      tags: ['A', 'B'],
      quality: 'medium',
      aspectRatio: '16:9',
      effectImages: [{ id: 'effect-a', dataUrl: 'data:image/webp;base64,abc' }],
      referenceImages: [{ id: 'image-a', dataUrl: 'data:image/png;base64,abc' }],
      createdAt: 1,
      updatedAt: 2,
    })).toMatchObject({
      id: 'a',
      title: 'Title',
      prompt: 'Prompt',
      category: 'Cat',
      mediaType: 'image',
      tagsText: 'A, B',
      quality: 'medium',
      aspectRatio: '16:9',
      effectImages: [{ id: 'effect-a', dataUrl: 'data:image/webp;base64,abc' }],
      referenceImages: [{ id: 'image-a', dataUrl: 'data:image/png;base64,abc' }],
      createdAt: 1,
    })
  })
})
