import type { PromptSquareItem, PromptSquareMediaType } from '../types'
import { PROMPT_SQUARE_MEDIA_TYPES } from './promptSquare'

export type { PromptSquareItem, PromptSquareMediaType }
export { PROMPT_SQUARE_MEDIA_TYPES }

export const PROMPT_SQUARE_TEST_ITEMS: PromptSquareItem[] = [
  {
    id: 'test-image',
    title: '测试图像提示词',
    prompt: 'Test image prompt',
    category: '测试',
    mediaType: 'image',
    tags: ['测试'],
    accentColor: '#2563eb',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'test-video',
    title: '测试视频提示词',
    prompt: 'Test video prompt',
    category: '测试',
    mediaType: 'video',
    tags: ['测试'],
    accentColor: '#334155',
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: 'test-functional',
    title: '测试功能提示词',
    prompt: 'Test functional prompt',
    category: '测试',
    mediaType: 'functional',
    tags: ['测试'],
    accentColor: '#4f46e5',
    createdAt: 3,
    updatedAt: 3,
  },
]
