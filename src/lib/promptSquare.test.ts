import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROMPT_SQUARE_MEDIA_TYPE,
  normalizePromptSquareDraft,
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
