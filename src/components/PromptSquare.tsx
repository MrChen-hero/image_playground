import { useMemo, useRef, useState } from 'react'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import { PROMPT_SQUARE_MEDIA_TYPES, sortPromptSquareItems } from '../lib/promptSquare'
import { useStore } from '../store'
import type { PromptSquareItem, PromptSquareMediaType } from '../types'
import { CloseIcon, CodeIcon, CopyIcon, FavoriteIcon, PhotoIcon, WrenchIcon } from './icons'
import Select from './Select'

type MediaFilter = PromptSquareMediaType

const ALL_CATEGORIES = 'all'
const DEFAULT_MEDIA_FILTER: MediaFilter = 'image'
const MEDIA_FILTERS: Array<{ value: MediaFilter; label: string }> = PROMPT_SQUARE_MEDIA_TYPES

function getSearchText(item: PromptSquareItem) {
  return [item.title, item.prompt, item.category, ...item.tags].join('\n').toLowerCase()
}

function mediaLabel(value: MediaFilter) {
  return PROMPT_SQUARE_MEDIA_TYPES.find((item) => item.value === value)?.label ?? value
}

function MediaFilterIcon({ value, className }: { value: MediaFilter; className?: string }) {
  if (value === 'image') return <PhotoIcon className={className} />
  if (value === 'functional') return <WrenchIcon className={className} />
  if (value === 'video') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.89L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
    )
  }
  return <WrenchIcon className={className} />
}

function MediaFilterButton({
  value,
  active,
  onClick,
}: {
  value: MediaFilter
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors ${active ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900' : 'hover:bg-gray-100 dark:hover:bg-white/[0.08]'}`}
    >
      <MediaFilterIcon value={value} className="h-3.5 w-3.5" />
      <span>{mediaLabel(value)}</span>
    </button>
  )
}

function PromptVisual({ item }: { item: PromptSquareItem }) {
  const accent = item.accentColor ?? '#3b82f6'

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gray-100 dark:bg-black/20"
      style={{
        background: `radial-gradient(circle at 20% 20%, ${accent}33, transparent 32%), linear-gradient(135deg, ${accent}22, rgba(255,255,255,0.88) 48%, ${accent}14)`,
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.48),transparent_45%,rgba(0,0,0,0.04))] dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_45%,rgba(255,255,255,0.03))]" />
      <div className="absolute left-5 top-5 h-11 w-11 rounded-xl border border-white/50 bg-white/50 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10" />
      <div className="absolute bottom-5 right-4 h-16 w-24 rounded-xl border border-white/60 bg-white/45 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10" />
      <div className="absolute bottom-8 left-5 h-1.5 w-20 rounded-full bg-white/70 dark:bg-white/20" />
      <div className="absolute bottom-12 left-5 h-1.5 w-12 rounded-full bg-white/70 dark:bg-white/20" />
      {item.aspectRatio && (
        <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm sm:text-xs">
          {item.aspectRatio}
        </span>
      )}
      {item.modelHint && (
        <span className="absolute bottom-1.5 right-1.5 max-w-[80%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm" title={item.modelHint}>
          {item.modelHint}
        </span>
      )}
    </div>
  )
}

function PromptCard({
  item,
  favorite,
  onToggleFavorite,
  onCopy,
  onUse,
  onOpen,
}: {
  item: PromptSquareItem
  favorite: boolean
  onToggleFavorite: () => void
  onCopy: () => void
  onUse: () => void
  onOpen: () => void
}) {
  return (
    <article
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-[box-shadow,border-color,background-color,transform] hover:border-gray-300 hover:shadow-lg dark:border-white/[0.08] dark:bg-gray-900 dark:hover:border-white/[0.18] dark:hover:bg-gray-800/80"
      onClick={onOpen}
    >
      <div className="flex h-40 cursor-pointer">
        <div className="h-full w-40 min-w-[10rem] flex-shrink-0 overflow-hidden">
          <PromptVisual item={item} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3">
          <div className="mb-2 min-h-0 flex-1 overflow-hidden">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100" title={item.title}>{item.title}</h2>
              {item.isFeatured && (
                <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  置顶
                </span>
              )}
            </div>
            <p className="line-clamp-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{item.prompt}</p>
          </div>

          <div className="mt-auto flex flex-col gap-1.5">
            <div className="mask-edge-r flex min-w-0 gap-1.5 overflow-x-auto whitespace-nowrap pt-0.5 pr-2 hide-scrollbar">
              <span className="flex shrink-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                <CodeIcon className="h-3 w-3 shrink-0 text-gray-400" />
                {mediaLabel(item.mediaType)}
              </span>
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                {item.category}
              </span>
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                  {tag}
                </span>
              ))}
            </div>

            <div
              className="mask-edge-r ml-auto flex max-w-full shrink-0 items-center gap-1 overflow-x-auto pr-2 hide-scrollbar"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`rounded-md p-1.5 transition ${favorite ? 'text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-400 dark:hover:bg-yellow-500/10'}`}
                aria-label={favorite ? '取消本地标记' : '本地标记'}
                title="仅本次浏览有效"
              >
                <FavoriteIcon filled={favorite} className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onCopy}
                className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950/30"
                aria-label="复制提示词"
                title="复制提示词"
              >
                <CopyIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onUse}
                className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950/30"
                aria-label="使用提示词"
                title="使用提示词"
              >
                <PhotoIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function PromptDetailModal({
  item,
  favorite,
  onClose,
  onToggleFavorite,
  onCopy,
  onUse,
}: {
  item: PromptSquareItem | null
  favorite: boolean
  onClose: () => void
  onToggleFavorite: () => void
  onCopy: () => void
  onUse: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  useCloseOnEscape(Boolean(item), onClose)
  usePreventBackgroundScroll(Boolean(item), modalRef)

  if (!item) return null

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md animate-overlay-in dark:bg-black/40" />
      <div
        ref={modalRef}
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/90 shadow-[0_8px_40px_rgb(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/90 dark:shadow-[0_8px_40px_rgb(0,0,0,0.4)] dark:ring-white/10 md:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-end px-4 md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            aria-label="关闭"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="relative h-64 w-full flex-shrink-0 bg-gray-100 dark:bg-black/20 md:h-auto md:w-1/2">
          <PromptVisual item={item} />
        </div>

        <div className="flex w-full flex-col overflow-y-auto overscroll-contain p-5 md:w-1/2">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 hidden rounded-full p-1 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/[0.06] md:block"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          <div data-selectable-text className="flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-1.5 pr-8">
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                {mediaLabel(item.mediaType)}
              </span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                {item.category}
              </span>
              {item.isFeatured && (
                <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-300">
                  置顶
                </span>
              )}
            </div>

            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{item.title}</h2>

            <div className="mb-4">
              <div className="mb-2 flex items-center gap-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">提示词</h3>
                <button
                  type="button"
                  onClick={onCopy}
                  className="rounded p-1 text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/[0.06]"
                  title="复制提示词"
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">{item.prompt}</p>
            </div>

            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">模板信息</h3>
            <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.03]">
                <span className="text-gray-400 dark:text-gray-500">类型</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">{mediaLabel(item.mediaType)}</span>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.03]">
                <span className="text-gray-400 dark:text-gray-500">比例</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">{item.aspectRatio ?? '未指定'}</span>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.03]">
                <span className="text-gray-400 dark:text-gray-500">模型</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">{item.modelHint ?? '未指定'}</span>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.03]">
                <span className="text-gray-400 dark:text-gray-500">序号</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">#{String(item.createdAt).padStart(2, '0')}</span>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.08] sm:flex">
            <button
              type="button"
              onClick={onUse}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 sm:flex-1"
            >
              <PhotoIcon className="h-4 w-4" />
              使用
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="col-span-1 flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08] sm:flex-1"
            >
              <CopyIcon className="h-4 w-4" />
              复制
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`col-span-1 flex items-center justify-center rounded-xl transition sm:w-11 ${favorite ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100 dark:bg-yellow-500/10 dark:hover:bg-yellow-500/20' : 'bg-gray-50 text-gray-400 hover:bg-yellow-50 hover:text-yellow-500 dark:bg-white/[0.04] dark:hover:bg-yellow-500/10'}`}
              title={favorite ? '取消本地标记' : '本地标记'}
            >
              <FavoriteIcon filled={favorite} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PromptSquare() {
  const setPrompt = useStore((s) => s.setPrompt)
  const setAppMode = useStore((s) => s.setAppMode)
  const showToast = useStore((s) => s.showToast)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [mediaType, setMediaType] = useState<MediaFilter>(DEFAULT_MEDIA_FILTER)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [items] = useState<PromptSquareItem[]>([])

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort(), [items])
  const categoryOptions = useMemo(() => [
    { label: '全部分类', value: ALL_CATEGORIES },
    ...categories.map((item) => ({ label: item, value: item })),
  ], [categories])
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return sortPromptSquareItems(items.filter((item) => {
      if (item.mediaType !== mediaType) return false
      if (category !== ALL_CATEGORIES && item.category !== category) return false
      if (favoriteOnly && !favoriteIds.includes(item.id)) return false
      if (!normalizedQuery) return true
      return getSearchText(item).includes(normalizedQuery)
    }))
  }, [category, favoriteIds, favoriteOnly, items, mediaType, query])
  const detailItem = useMemo(
    () => items.find((item) => item.id === detailItemId) ?? null,
    [detailItemId, items],
  )

  const toggleFavorite = (itemId: string) => {
    setFavoriteIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId],
    )
  }

  const copyPrompt = async (item: PromptSquareItem) => {
    try {
      await copyTextToClipboard(item.prompt)
      showToast('提示词已复制', 'success')
    } catch (err) {
      showToast(getClipboardFailureMessage('复制提示词失败', err), 'error')
    }
  }

  const usePrompt = (item: PromptSquareItem) => {
    setPrompt(item.prompt)
    setAppMode('gallery')
    setDetailItemId(null)
    showToast('提示词已填入输入框', 'success')
  }

  return (
    <main className="pb-64">
      <div className="safe-area-x mx-auto max-w-7xl">
        <section data-no-drag-select className="mt-6 mb-4 flex gap-3">
          <div className="z-20 flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setFavoriteOnly((value) => !value)}
              className={`rounded-xl border p-2.5 transition-all ${favoriteOnly ? 'border-yellow-400 bg-yellow-50 text-yellow-500 dark:bg-yellow-500/10' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:bg-white/[0.06]'}`}
              title="仅本次浏览有效，后续提示词库版本可持久化"
              aria-label={favoriteOnly ? '显示全部提示词' : '仅看本地标记'}
            >
              <FavoriteIcon filled={favoriteOnly} className="h-5 w-5" />
            </button>
            <div className="relative w-28 sm:w-32">
              <Select
                value={category}
                onChange={(value) => setCategory(String(value))}
                options={categoryOptions}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm transition hover:bg-gray-50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:bg-white/[0.06]"
              />
            </div>
          </div>
          <div className="relative z-10 flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="搜索标题、提示词、标签..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-4 pl-10 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-gray-900"
            />
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>共 {visibleItems.length} 个模板 · {mediaLabel(mediaType)}{favoriteOnly ? ' · 本地标记' : ''}</span>
        </div>

        {visibleItems.length ? (
          <section className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => (
              <PromptCard
                key={item.id}
                item={item}
                favorite={favoriteIds.includes(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                onCopy={() => void copyPrompt(item)}
                onUse={() => usePrompt(item)}
                onOpen={() => setDetailItemId(item.id)}
              />
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-white/60 py-16 text-center text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-gray-500">
            <PhotoIcon className="mx-auto mb-3 h-10 w-10 opacity-60" />
            <p className="text-sm">没有找到匹配的提示词模板</p>
          </section>
        )}
      </div>

      <div data-no-drag-select className="fixed bottom-[calc(var(--input-bar-clearance,12rem)+0.75rem)] left-1/2 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-3">
        <nav className="mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-gray-200/70 bg-white/90 p-1 text-xs font-medium text-gray-600 shadow-[0_8px_30px_rgb(0,0,0,0.10)] backdrop-blur-xl hide-scrollbar dark:border-white/[0.08] dark:bg-gray-800/90 dark:text-gray-300">
          {MEDIA_FILTERS.map((item) => (
            <MediaFilterButton
              key={item.value}
              value={item.value}
              active={mediaType === item.value}
              onClick={() => setMediaType(item.value)}
            />
          ))}
        </nav>
      </div>

      <PromptDetailModal
        item={detailItem}
        favorite={detailItem ? favoriteIds.includes(detailItem.id) : false}
        onClose={() => setDetailItemId(null)}
        onToggleFavorite={() => {
          if (detailItem) toggleFavorite(detailItem.id)
        }}
        onCopy={() => {
          if (detailItem) void copyPrompt(detailItem)
        }}
        onUse={() => {
          if (detailItem) usePrompt(detailItem)
        }}
      />
    </main>
  )
}
