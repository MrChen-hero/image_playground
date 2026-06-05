import type { TaskParams } from '../types'

export const MAX_REFERENCE_IMAGES = 16

export const OPENAI_QUALITY_OPTIONS: Array<{ label: TaskParams['quality']; value: TaskParams['quality'] }> = [
  { label: 'auto', value: 'auto' },
  { label: 'low', value: 'low' },
  { label: 'medium', value: 'medium' },
  { label: 'high', value: 'high' },
]

export const FAL_QUALITY_OPTIONS: Array<{ label: Exclude<TaskParams['quality'], 'auto'>; value: Exclude<TaskParams['quality'], 'auto'> }> = [
  { label: 'low', value: 'low' },
  { label: 'medium', value: 'medium' },
  { label: 'high', value: 'high' },
]

export function getQualityOptionsForProvider(provider: string) {
  return provider === 'fal' ? FAL_QUALITY_OPTIONS : OPENAI_QUALITY_OPTIONS
}
