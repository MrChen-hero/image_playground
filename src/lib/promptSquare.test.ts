import { describe, expect, it } from 'vitest'
import {
  createPromptSquareManifest,
  DEFAULT_PROMPT_SQUARE_MEDIA_TYPE,
  normalizePromptSquareDraft,
  parsePromptSquareManifest,
  parsePromptSquareTags,
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
      aspectRatio: '',
      accentColor: '',
      isFeatured: false,
    }, 100)

    expect(normalized).toMatchObject({
      title: '标题',
      prompt: 'prompt',
      mediaType: 'image',
      category: '未分类',
      tags: [],
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
})

describe('prompt square manifest', () => {
  it('exports a versioned manifest', () => {
    const manifest = createPromptSquareManifest([], 123)

    expect(manifest).toEqual({
      version: 1,
      exportedAt: 123,
      items: [],
      collections: [],
      defaultCollectionId: null,
    })
  })

  it('parses and normalizes valid imported items', () => {
    const parsed = parsePromptSquareManifest({
      version: 1,
      exportedAt: 1,
      collections: [],
      defaultCollectionId: null,
      items: [{
        id: 'imported',
        title: ' Imported ',
        prompt: ' Prompt ',
        category: '',
        mediaType: 'functional',
        tags: ['A', 'A', ' B '],
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
        updatedAt: 10,
      })
    }
  })

  it('rejects invalid manifest structure', () => {
    expect(parsePromptSquareManifest({ version: 2, items: [] }).ok).toBe(false)
    expect(parsePromptSquareManifest({ version: 1, items: [{ title: '', prompt: '' }] }).ok).toBe(false)
  })
})
