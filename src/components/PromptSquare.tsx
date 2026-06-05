import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type SVGProps } from 'react'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import { calculateImageSize, IMAGE_RATIO_OPTIONS } from '../lib/size'
import {
  deletePromptSquareItem,
  getAllPromptSquareFavoriteCollections,
  getAllPromptSquareItems,
  getPromptSquareDefaultFavoriteCollectionId,
  putPromptSquareDefaultFavoriteCollectionId,
  putPromptSquareItem,
  replacePromptSquareFavoriteCollections,
  replacePromptSquareItems,
} from '../lib/db'
import {
  ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID,
  createPromptSquareFavoriteCollection,
  createPromptSquareManifest,
  getPromptSquareFavoriteCollectionTitle,
  getPromptSquareItemFavoriteCollectionIds,
  normalizePromptSquareDraft,
  normalizePromptSquareFavoriteCollectionIds,
  normalizePromptSquareFavoriteCollections,
  normalizePromptSquareFavoriteState,
  parsePromptSquareManifest,
  PROMPT_SQUARE_MEDIA_TYPES,
  promptSquareItemToDraft,
  removePromptSquareFavoriteCollection,
  renamePromptSquareFavoriteCollection,
  sortPromptSquareItems,
  validatePromptSquareDraft,
  type PromptSquareDraft,
} from '../lib/promptSquare'
import { createInputImageFromFile, useStore } from '../store'
import { getActiveApiProfile } from '../lib/apiProfiles'
import { getQualityOptionsForProvider, MAX_REFERENCE_IMAGES } from '../lib/paramOptions'
import type { InputImage, PromptSquareFavoriteCollection, PromptSquareItem, PromptSquareMediaType, TaskParams } from '../types'
import { CloseIcon, CodeIcon, CollectionManageIcon, CopyIcon, DragHandleIcon, EditIcon, ExportIcon, FavoriteIcon, ImportIcon, PhotoIcon, PlusIcon, TrashIcon, WrenchIcon } from './icons'
import { ImageLightboxView } from './Lightbox'
import Select from './Select'

type MediaFilter = PromptSquareMediaType

const ALL_CATEGORIES = 'all'
const DEFAULT_MEDIA_FILTER: MediaFilter = 'image'
const MEDIA_FILTERS: Array<{ value: MediaFilter; label: string }> = PROMPT_SQUARE_MEDIA_TYPES
const DEFAULT_PROMPT_SQUARE_RATIO = '1:1'
const RATIO_OPTIONS = IMAGE_RATIO_OPTIONS
const REFERENCE_IMAGE_LIMIT = MAX_REFERENCE_IMAGES
const EFFECT_IMAGE_LIMIT = MAX_REFERENCE_IMAGES
const MEDIA_FILTER_WIDTH_REM = 4.75

function getSearchText(item: PromptSquareItem) {
  return [item.title, item.prompt, item.category, ...item.tags].join('\n').toLowerCase()
}

function mediaLabel(value: MediaFilter) {
  return PROMPT_SQUARE_MEDIA_TYPES.find((item) => item.value === value)?.label ?? value
}

function getMediaFilterIndex(value: MediaFilter) {
  return Math.max(0, MEDIA_FILTERS.findIndex((item) => item.value === value))
}

function isTaskQuality(value: unknown): value is TaskParams['quality'] {
  return value === 'auto' || value === 'low' || value === 'medium' || value === 'high'
}

function getSelectableQualityValue(
  quality: unknown,
  provider: string,
  codexCli: boolean,
): TaskParams['quality'] {
  if (codexCli) return 'auto'
  if (provider === 'fal') {
    return quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'high'
  }
  return isTaskQuality(quality) ? quality : 'auto'
}

function getPromptSquareSizeForRatio(ratio?: string) {
  return ratio ? calculateImageSize('1K', ratio) : null
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
      className={`relative z-10 inline-flex w-[4.75rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-colors duration-300 ${active ? 'text-white dark:text-gray-900' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
    >
      <MediaFilterIcon value={value} className="h-3.5 w-3.5" />
      <span>{mediaLabel(value)}</span>
    </button>
  )
}

function PromptSquareImageUploadSection({
  title,
  description,
  emptyText,
  images,
  limit,
  altPrefix,
  onAddImages,
  onRemoveImage,
}: {
  title: string
  description: string
  emptyText: string
  images: InputImage[]
  limit: number
  altPrefix: string
  onAddImages: (files: FileList | File[]) => void
  onRemoveImage: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white/70 p-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-gray-400 dark:text-gray-500">{description}</span>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={images.length >= limit}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <PhotoIcon className="h-3.5 w-3.5" />
          上传
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) onAddImages(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      <div
        className={`min-h-28 rounded-xl border border-dashed p-2 transition-colors ${isDragging ? 'border-blue-400 bg-blue-50/70 dark:border-blue-400/70 dark:bg-blue-500/10' : 'border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-white/[0.08] dark:bg-black/10 dark:hover:border-white/[0.16]'}`}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setIsDragging(true)
        }}
        onDragLeave={() => {
          setIsDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))
          if (files.length) onAddImages(files)
        }}
      >
        {images.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
            {images.map((image, index) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <img src={image.dataUrl} alt={`${altPrefix} ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(image.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-100 shadow-sm transition hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`移除${title}`}
                  title={`移除${title}`}
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-3 py-4 text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-300 shadow-sm ring-1 ring-gray-200/70 dark:bg-white/[0.04] dark:text-gray-500 dark:ring-white/[0.08]">
              <PhotoIcon className="h-4 w-4" />
            </span>
            <span>{emptyText}</span>
          </div>
        )}
      </div>
      <div className="mt-1.5 text-right text-[11px] text-gray-400 dark:text-gray-500">
        {images.length}/{limit}
      </div>
    </section>
  )
}

function PromptVisual({
  item,
  activeIndex = 0,
  variant = 'card',
  onActiveIndexChange,
  onOpenImage,
}: {
  item: PromptSquareItem
  activeIndex?: number
  variant?: 'card' | 'detail'
  onActiveIndexChange?: (index: number) => void
  onOpenImage?: (images: InputImage[], index: number) => void
}) {
  const accent = item.accentColor ?? '#3b82f6'
  const effectImages = item.effectImages ?? []
  const imageCount = effectImages.length
  const currentIndex = imageCount ? Math.min(Math.max(activeIndex, 0), imageCount - 1) : 0
  const effectImage = effectImages[currentIndex]
  const showImageControls = imageCount > 1

  const goToImage = (event: ReactMouseEvent, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    if (!imageCount) return
    const wrapped = ((index % imageCount) + imageCount) % imageCount
    onActiveIndexChange?.(wrapped)
  }

  return (
    <div
      className="group/visual relative flex h-full w-full items-center justify-center overflow-hidden bg-gray-100 dark:bg-black/20"
      style={{
        background: `radial-gradient(circle at 20% 20%, ${accent}33, transparent 32%), linear-gradient(135deg, ${accent}22, rgba(255,255,255,0.88) 48%, ${accent}14)`,
      }}
    >
      {effectImage ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenImage?.(effectImages, currentIndex)
            }}
            className="absolute inset-0 cursor-zoom-in"
            aria-label="放大效果图"
            title="放大效果图"
          >
            <img src={effectImage.dataUrl} alt={`${item.title} 效果图 ${currentIndex + 1}`} className="h-full w-full object-cover transition duration-300 group-hover/visual:scale-[1.03]" />
          </button>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/22 via-transparent to-black/8" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.48),transparent_45%,rgba(0,0,0,0.04))] dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_45%,rgba(255,255,255,0.03))]" />
          <div className="absolute left-5 top-5 h-11 w-11 rounded-xl border border-white/50 bg-white/50 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10" />
          <div className="absolute bottom-5 right-4 h-16 w-24 rounded-xl border border-white/60 bg-white/45 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10" />
          <div className="absolute bottom-8 left-5 h-1.5 w-20 rounded-full bg-white/70 dark:bg-white/20" />
          <div className="absolute bottom-12 left-5 h-1.5 w-12 rounded-full bg-white/70 dark:bg-white/20" />
        </>
      )}
      {item.aspectRatio && (
        <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm sm:text-xs">
          {item.aspectRatio}
        </span>
      )}
      {item.quality && (
        <span className="absolute bottom-1.5 right-1.5 max-w-[80%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm" title={`质量 ${item.quality}`}>
          {item.quality}
        </span>
      )}
      {showImageControls && (
        <>
          <button
            type="button"
            onClick={(event) => goToImage(event, currentIndex - 1)}
            className={`absolute left-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur transition hover:bg-black/65 ${variant === 'detail' ? 'h-8 w-8' : 'h-7 w-7 opacity-0 pointer-events-none group-hover/visual:pointer-events-auto group-hover/visual:opacity-100 focus:pointer-events-auto focus:opacity-100'}`}
            aria-label="上一张效果图"
            title="上一张效果图"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(event) => goToImage(event, currentIndex + 1)}
            className={`absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur transition hover:bg-black/65 ${variant === 'detail' ? 'h-8 w-8' : 'h-7 w-7 opacity-0 pointer-events-none group-hover/visual:pointer-events-auto group-hover/visual:opacity-100 focus:pointer-events-auto focus:opacity-100'}`}
            aria-label="下一张效果图"
            title="下一张效果图"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

function PromptSquareImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: InputImage[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const open = images.length > 0
  const currentIndex = open ? Math.min(Math.max(index, 0), images.length - 1) : 0
  const currentImage = images[currentIndex]
  const showNav = images.length > 1

  useCloseOnEscape(open, onClose)
  usePreventBackgroundScroll(open)

  useEffect(() => {
    if (!open || !showNav) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onIndexChange((currentIndex - 1 + images.length) % images.length)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onIndexChange((currentIndex + 1) % images.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, images.length, onIndexChange, open, showNav])

  if (!open || !currentImage) return null

  const goTo = (nextIndex: number) => {
    onIndexChange(((nextIndex % images.length) + images.length) % images.length)
  }

  return (
    <div data-no-drag-select className="fixed inset-0 z-[120]">
      <ImageLightboxView
        src={currentImage.dataUrl}
        imageId={currentImage.id}
        onClose={onClose}
        showNav={showNav}
        currentIndex={currentIndex}
        total={images.length}
        onPrev={() => goTo(currentIndex - 1)}
        onNext={() => goTo(currentIndex + 1)}
      />
    </div>
  )
}

function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4.172a2 2 0 011.414.586L12 7h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

function getCollectionItems(collectionId: string, items: PromptSquareItem[]) {
  const favoriteItems = items.filter((item) => item.isFavorite)
  if (collectionId === ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID) return favoriteItems
  return favoriteItems.filter((item) => getPromptSquareItemFavoriteCollectionIds(item).includes(collectionId))
}

function getLatestCollectionCoverItem(items: PromptSquareItem[]) {
  return [...items]
    .filter((item) => item.effectImages?.length)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? [...items].sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

function getInitialPromptSquareCheckedCollectionIds(item: PromptSquareItem | null, defaultCollectionId: string | null) {
  if (!item) return []
  const ids = getPromptSquareItemFavoriteCollectionIds(item)
  return ids.length ? ids : defaultCollectionId ? [defaultCollectionId] : []
}

function PromptSquareCollectionCover({ item }: { item?: PromptSquareItem }) {
  if (item?.effectImages?.[0]) {
    return <img src={item.effectImages[0].dataUrl} alt="" className="h-full w-full object-cover" />
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-yellow-50 text-yellow-500 dark:bg-[#2a2211] dark:text-yellow-400">
      <FavoriteIcon filled className="h-8 w-8 opacity-80" />
    </div>
  )
}

function PromptSquareFavoriteCollectionsView({
  items,
  collections,
  defaultCollectionId,
  query,
  onOpenCollection,
  onManage,
}: {
  items: PromptSquareItem[]
  collections: PromptSquareFavoriteCollection[]
  defaultCollectionId: string | null
  query: string
  onOpenCollection: (id: string) => void
  onManage: () => void
}) {
  const cards = useMemo(() => {
    const allItems = getCollectionItems(ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID, items)
    return [
      { id: ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID, name: '全部', items: allItems },
      ...collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        collection,
        items: getCollectionItems(collection.id, items),
      })),
    ]
  }, [collections, items])

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return cards
    return cards.filter((card) => card.name.toLowerCase().includes(normalizedQuery))
  }, [cards, query])

  if (!filteredCards.length) {
    return (
      <div className="py-20 text-center text-sm text-gray-400 dark:text-gray-500">
        没有找到匹配的收藏夹
      </div>
    )
  }

  return (
    <section className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
      {filteredCards.map((card) => {
        const isVirtualAll = card.id === ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID
        const isDefault = card.id === defaultCollectionId
        const coverItem = getLatestCollectionCoverItem(card.items)
        return (
          <article
            key={card.id}
            className="relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition-[box-shadow,border-color,background-color,transform] hover:border-gray-300 hover:shadow-lg dark:border-white/[0.08] dark:bg-gray-900 dark:hover:border-white/[0.18] dark:hover:bg-gray-800/80"
            onClick={() => onOpenCollection(card.id)}
          >
            <div className="flex h-40">
              <div className="h-full w-40 min-w-[10rem] flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-black/20">
                <PromptSquareCollectionCover item={coverItem} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-3">
                <div className="mb-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {isVirtualAll ? <FavoriteIcon filled className="h-4 w-4 shrink-0 text-yellow-500" /> : <FolderIcon className="h-4 w-4 shrink-0 text-gray-400" />}
                    <span className="truncate" title={card.name}>{card.name}</span>
                    {isDefault && !isVirtualAll && (
                      <span className="shrink-0 rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-300">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{card.items.length} 个模板</p>
                </div>
                <div className="mt-auto flex justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onManage()
                    }}
                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                    aria-label="管理收藏夹"
                    title="管理收藏夹"
                  >
                    <CollectionManageIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function PromptSquareFavoritePickerModal({
  item,
  collections,
  defaultCollectionId,
  onClose,
  onCreate,
  onConfirm,
}: {
  item: PromptSquareItem | null
  collections: PromptSquareFavoriteCollection[]
  defaultCollectionId: string | null
  onClose: () => void
  onCreate: (name: string) => Promise<PromptSquareFavoriteCollection | null>
  onConfirm: (item: PromptSquareItem, collectionIds: string[]) => Promise<void>
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const open = Boolean(item)

  useCloseOnEscape(open, onClose)
  usePreventBackgroundScroll(open, modalRef)

  useEffect(() => {
    if (!item) return
    setCheckedIds(getInitialPromptSquareCheckedCollectionIds(item, defaultCollectionId))
    setDraft('')
  }, [defaultCollectionId, item])

  if (!item) return null

  const toggleChecked = (id: string) => {
    setCheckedIds((current) => current.includes(id)
      ? current.filter((entry) => entry !== id)
      : [...current, id])
  }

  const handleCreate = async () => {
    if (!draft.trim()) return
    const collection = await onCreate(draft)
    if (!collection) return
    setCheckedIds((current) => current.includes(collection.id) ? current : [...current, collection.id])
    setDraft('')
  }

  const handleConfirm = () => {
    void onConfirm(item, checkedIds)
  }

  return (
    <div data-no-drag-select className="fixed inset-0 z-[105] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-overlay-in" />
      <div
        ref={modalRef}
        className="relative z-10 flex max-h-[85vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-modal-in dark:border-white/[0.08] dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-6 py-5 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <h2 className="pr-8 text-lg font-semibold text-gray-900 dark:text-gray-100">收藏到</h2>
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400" title={item.title}>{item.title}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {collections.map((collection) => {
            const checked = checkedIds.includes(collection.id)
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => toggleChecked(collection.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.06]"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-transparent dark:border-white/20'}`}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200" title={collection.name}>{collection.name}</span>
                {collection.id === defaultCollectionId && (
                  <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-300">默认</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="border-t border-gray-100 p-5 dark:border-white/[0.08]">
          <div className="mb-4 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCreate()
              }}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-white/10 dark:text-gray-100"
              placeholder="新建收藏夹..."
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!draft.trim()}
              className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
            >
              新建
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.04]">取消</button>
            <button type="button" onClick={handleConfirm} className="flex-1 rounded-xl border border-transparent bg-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600">确认</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromptSquareManageCollectionsModal({
  open,
  collections,
  defaultCollectionId,
  onClose,
  onCreate,
  onRename,
  onReorder,
  onSetDefault,
  onDelete,
}: {
  open: boolean
  collections: PromptSquareFavoriteCollection[]
  defaultCollectionId: string | null
  onClose: () => void
  onCreate: (name: string) => Promise<PromptSquareFavoriteCollection | null>
  onRename: (id: string, name: string) => Promise<void>
  onReorder: (collections: PromptSquareFavoriteCollection[]) => Promise<void>
  onSetDefault: (id: string) => Promise<void>
  onDelete: (collection: PromptSquareFavoriteCollection) => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useCloseOnEscape(open, onClose)
  usePreventBackgroundScroll(open, modalRef)

  useEffect(() => {
    if (!open) return
    setDraft('')
    setEditingId(null)
    setEditingName('')
    setDraggedId(null)
  }, [open])

  if (!open) return null

  const handleCreate = async () => {
    if (!draft.trim()) return
    const created = await onCreate(draft)
    if (created) setDraft('')
  }

  const confirmRename = () => {
    if (editingId && editingName.trim()) void onRename(editingId, editingName)
    setEditingId(null)
    setEditingName('')
  }

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }
    const sourceIndex = collections.findIndex((collection) => collection.id === draggedId)
    const targetIndex = collections.findIndex((collection) => collection.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedId(null)
      return
    }
    const nextCollections = [...collections]
    const [removed] = nextCollections.splice(sourceIndex, 1)
    nextCollections.splice(targetIndex, 0, removed)
    setDraggedId(null)
    void onReorder(nextCollections)
  }

  return (
    <div data-no-drag-select className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-overlay-in" />
      <div
        ref={modalRef}
        className="relative z-10 flex max-h-[85vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-modal-in dark:border-white/[0.08] dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-6 py-5 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <h2 className="pr-8 text-lg font-semibold text-gray-900 dark:text-gray-100">管理收藏夹</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">管理提示词广场收藏夹和排序。</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {collections.map((collection) => {
            const isDefault = collection.id === defaultCollectionId
            const canDelete = collections.length > 1
            return (
              <div
                key={collection.id}
                draggable={editingId !== collection.id}
                onDragStart={(event) => {
                  setDraggedId(collection.id)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', collection.id)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDrop(collection.id)
                }}
                onDragEnd={() => setDraggedId(null)}
                className={`group flex h-12 items-center gap-3 px-4 transition ${draggedId === collection.id ? 'bg-gray-100 opacity-60 dark:bg-white/[0.04]' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'}`}
              >
                <DragHandleIcon className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-400" />
                {editingId === collection.id ? (
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        confirmRename()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        setEditingId(null)
                        setEditingName('')
                      }
                    }}
                    onBlur={confirmRename}
                    className="min-w-0 flex-1 rounded border border-blue-400/50 bg-white px-1.5 py-0 text-[15px] leading-6 text-gray-900 outline-none dark:border-white/20 dark:bg-black/20 dark:text-white"
                    autoFocus
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200" title={collection.name}>{collection.name}</span>
                )}
                <button
                  type="button"
                  onClick={() => void onSetDefault(collection.id)}
                  className={`rounded-md p-1.5 transition ${isDefault ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-500 dark:hover:bg-yellow-500/10'}`}
                  aria-label={isDefault ? '默认收藏夹' : '设为默认收藏夹'}
                  title={isDefault ? '默认收藏夹' : '设为默认收藏夹'}
                >
                  <FavoriteIcon filled={isDefault} className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(collection.id)
                    setEditingName(collection.name)
                  }}
                  className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="重命名"
                  title="重命名"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(collection)}
                  disabled={!canDelete}
                  className={`rounded-md p-1.5 transition ${canDelete ? 'text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10' : 'cursor-not-allowed text-gray-300 dark:text-gray-600'}`}
                  aria-label={canDelete ? '删除收藏夹' : '至少保留一个收藏夹'}
                  title={canDelete ? '删除收藏夹' : '至少保留一个收藏夹'}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="border-t border-gray-100 p-5 dark:border-white/[0.08]">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCreate()
              }}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-white/10 dark:text-gray-100"
              placeholder="新建收藏夹..."
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!draft.trim()}
              className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
            >
              新建
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromptCard({
  item,
  favorite,
  activeImageIndex,
  onActiveImageIndexChange,
  onOpenImage,
  onToggleFavorite,
  onCopy,
  onUse,
  onOpen,
}: {
  item: PromptSquareItem
  favorite: boolean
  activeImageIndex: number
  onActiveImageIndexChange: (index: number) => void
  onOpenImage: (images: InputImage[], index: number) => void
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
        <div className="h-full w-44 min-w-[11rem] flex-shrink-0 overflow-hidden">
          <PromptVisual
            item={item}
            activeIndex={activeImageIndex}
            onActiveIndexChange={onActiveImageIndexChange}
            onOpenImage={onOpenImage}
          />
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
                onClick={onUse}
                className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-950/30"
                aria-label="使用提示词"
                title="使用提示词"
              >
                <PhotoIcon className="h-4 w-4" />
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
                onClick={onToggleFavorite}
                className={`rounded-md p-1.5 transition ${favorite ? 'text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10' : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-400 dark:hover:bg-yellow-500/10'}`}
                aria-label={favorite ? '编辑收藏夹' : '收藏模板'}
                title={favorite ? '编辑收藏夹' : '收藏模板'}
              >
                <FavoriteIcon filled={favorite} className="h-4 w-4" />
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
  activeImageIndex,
  onClose,
  onActiveImageIndexChange,
  onOpenImage,
  onToggleFavorite,
  onCopy,
  onUse,
  onEdit,
  onDelete,
}: {
  item: PromptSquareItem | null
  favorite: boolean
  activeImageIndex: number
  onClose: () => void
  onActiveImageIndexChange: (index: number) => void
  onOpenImage: (images: InputImage[], index: number) => void
  onToggleFavorite: () => void
  onCopy: () => void
  onUse: () => void
  onEdit: () => void
  onDelete: () => void
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
          <PromptVisual
            item={item}
            activeIndex={activeImageIndex}
            variant="detail"
            onActiveIndexChange={onActiveImageIndexChange}
            onOpenImage={onOpenImage}
          />
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
                <span className="text-gray-400 dark:text-gray-500">质量</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">{item.quality ?? 'auto'}</span>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.03]">
                <span className="text-gray-400 dark:text-gray-500">参考图</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">{item.referenceImages?.length ?? 0} 张</span>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[0.03]">
                <span className="text-gray-400 dark:text-gray-500">效果图</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">{item.effectImages?.length ?? 0} 张</span>
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

          <div className="flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onUse}
              className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
            >
              <PhotoIcon className="h-4 w-4" />
              使用
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]"
              title="复制提示词"
              aria-label="复制提示词"
            >
              <CopyIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${favorite ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100 dark:bg-yellow-500/10 dark:hover:bg-yellow-500/20' : 'bg-gray-50 text-gray-400 hover:bg-yellow-50 hover:text-yellow-500 dark:bg-white/[0.04] dark:hover:bg-yellow-500/10'}`}
              title={favorite ? '编辑收藏夹' : '收藏模板'}
              aria-label={favorite ? '编辑收藏夹' : '收藏模板'}
            >
              <FavoriteIcon filled={favorite} className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]"
              title="编辑模板"
              aria-label="编辑模板"
            >
              <EditIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
              title="删除模板"
              aria-label="删除模板"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromptSquareEditModal({
  draft,
  onChange,
  onClose,
  onSave,
  showToast,
  qualityOptions,
  qualityDisabled,
  qualityProvider,
}: {
  draft: PromptSquareDraft | null
  onChange: (draft: PromptSquareDraft) => void
  onClose: () => void
  onSave: () => void
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void
  qualityOptions: Array<{ label: string; value: TaskParams['quality'] }>
  qualityDisabled: boolean
  qualityProvider: string
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  useCloseOnEscape(Boolean(draft), onClose)
  usePreventBackgroundScroll(Boolean(draft), modalRef)

  if (!draft) return null

  const updateDraft = (patch: Partial<PromptSquareDraft>) => onChange({ ...draft, ...patch })
  const effectImages = draft.effectImages ?? []
  const referenceImages = draft.referenceImages ?? []
  const normalizedQuality = getSelectableQualityValue(draft.quality, qualityProvider, qualityDisabled)
  const qualityValue: TaskParams['quality'] = qualityOptions.some((option) => option.value === normalizedQuality)
    ? normalizedQuality
    : qualityOptions[0]?.value ?? 'auto'
  const ratioValue: string = RATIO_OPTIONS.some((option) => option.value === draft.aspectRatio)
    ? String(draft.aspectRatio)
    : DEFAULT_PROMPT_SQUARE_RATIO

  const addPromptSquareImages = async (
    files: FileList | File[] | null,
    imageKey: 'effectImages' | 'referenceImages',
    label: string,
    limit: number,
  ) => {
    if (!files?.length) return
    const currentImages = draft[imageKey] ?? []
    const remaining = limit - currentImages.length
    if (remaining <= 0) {
      showToast(`${label}数量已达上限（${limit} 张）`, 'error')
      return
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) {
      showToast('请选择有效图片', 'error')
      return
    }

    const toAdd = imageFiles.slice(0, remaining)
    const nextImages: InputImage[] = [...currentImages]
    const existingIds = new Set(nextImages.map((image) => image.id))
    let added = 0

    try {
      for (const file of toAdd) {
        const image = await createInputImageFromFile(file)
        if (!image || existingIds.has(image.id)) continue
        existingIds.add(image.id)
        nextImages.push({ id: image.id, dataUrl: image.dataUrl })
        added++
      }
    } catch (error) {
      showToast(`${label}上传失败：${error instanceof Error ? error.message : String(error)}`, 'error')
      return
    }

    if (added > 0) {
      updateDraft({ [imageKey]: nextImages } as Partial<PromptSquareDraft>)
      showToast(`已添加 ${added} 张${label}`, 'success')
    }
    const discarded = imageFiles.length - toAdd.length
    if (discarded > 0) {
      showToast(`已达上限 ${limit} 张，${discarded} 张图片被丢弃`, 'error')
    } else if (added === 0) {
      showToast(`${label}未变化`, 'info')
    }
  }

  const removePromptSquareImage = (imageKey: 'effectImages' | 'referenceImages', id: string) => {
    updateDraft({ [imageKey]: (draft[imageKey] ?? []).filter((image) => image.id !== id) } as Partial<PromptSquareDraft>)
  }

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md animate-overlay-in dark:bg-black/40" />
      <div
        ref={modalRef}
        className="relative z-10 flex h-[min(92vh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/60 bg-white/95 shadow-[0_24px_80px_rgb(15,23,42,0.22)] ring-1 ring-black/5 backdrop-blur-xl animate-modal-in dark:border-white/[0.08] dark:bg-gray-950/95 dark:shadow-[0_24px_80px_rgb(0,0,0,0.48)] dark:ring-white/10 sm:h-auto sm:max-h-[90vh] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100/80 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/70 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">{draft.id ? '编辑提示词' : '新增提示词'}</h2>
            <p className="mt-0.5 hidden text-xs text-gray-400 dark:text-gray-500 sm:block">维护本地提示词模板、预览图和画廊引用图</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-gray-50/80 p-4 dark:bg-black/20 sm:p-6">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">标题</span>
                <input
                  value={draft.title ?? ''}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">提示词</span>
                <textarea
                  value={draft.prompt ?? ''}
                  onChange={(event) => updateDraft({ prompt: event.target.value })}
                  rows={9}
                  className="min-h-44 w-full resize-y rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                />
              </label>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">类型</span>
                  <Select
                    value={draft.mediaType ?? DEFAULT_MEDIA_FILTER}
                    onChange={(value) => updateDraft({ mediaType: value as PromptSquareMediaType })}
                    options={PROMPT_SQUARE_MEDIA_TYPES}
                    className="rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm transition hover:bg-gray-50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:hover:bg-white/[0.06]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">分类</span>
                  <input
                    value={draft.category ?? ''}
                    onChange={(event) => updateDraft({ category: event.target.value })}
                    placeholder="未分类"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">标签</span>
                <input
                  value={draft.tagsText ?? ''}
                  onChange={(event) => updateDraft({ tagsText: event.target.value })}
                  placeholder="商业, 棚拍, 极简"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
            </section>

            <aside className="min-w-0 space-y-4">
              <PromptSquareImageUploadSection
                title="效果图"
                description="用于广场卡片和详情预览"
                emptyText="点击上传，或将效果图拖拽到这里；卡片会展示第一张"
                images={effectImages}
                limit={EFFECT_IMAGE_LIMIT}
                altPrefix="效果图"
                onAddImages={(files) => void addPromptSquareImages(files, 'effectImages', '效果图', EFFECT_IMAGE_LIMIT)}
                onRemoveImage={(id) => removePromptSquareImage('effectImages', id)}
              />

              <PromptSquareImageUploadSection
                title="参考图"
                description="使用模板时同步带入画廊输入框"
                emptyText="点击上传，或将参考图拖拽到这里；可上传多张"
                images={referenceImages}
                limit={REFERENCE_IMAGE_LIMIT}
                altPrefix="参考图"
                onAddImages={(files) => void addPromptSquareImages(files, 'referenceImages', '参考图', REFERENCE_IMAGE_LIMIT)}
                onRemoveImage={(id) => removePromptSquareImage('referenceImages', id)}
              />

              <section className="min-w-0 space-y-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="grid min-w-0 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">质量</span>
                    <Select
                      value={qualityValue}
                      onChange={(value) => updateDraft({ quality: value as TaskParams['quality'] })}
                      options={qualityOptions}
                      disabled={qualityDisabled}
                      className="rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm transition hover:bg-gray-50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:hover:bg-white/[0.06]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">比例</span>
                    <Select
                      value={ratioValue}
                      onChange={(value) => updateDraft({ aspectRatio: String(value) })}
                      options={RATIO_OPTIONS}
                      className="rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm transition hover:bg-gray-50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:hover:bg-white/[0.06]"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">强调色</span>
                    <div className="flex gap-2">
                      <input
                        value={draft.accentColor ?? ''}
                        onChange={(event) => updateDraft({ accentColor: event.target.value })}
                        placeholder="#2563eb"
                        className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                      />
                      <input
                        type="color"
                        value={draft.accentColor || '#2563eb'}
                        onChange={(event) => updateDraft({ accentColor: event.target.value })}
                        className="h-11 w-11 shrink-0 rounded-2xl border border-gray-200 bg-white p-1 dark:border-white/[0.08] dark:bg-gray-950"
                        aria-label="选择强调色"
                      />
                    </div>
                  </label>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-600 dark:border-white/[0.08] dark:bg-black/10 dark:text-gray-300">
                  <span className="font-medium">置顶显示</span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.isFeatured)}
                    onChange={(event) => updateDraft({ isFeatured: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </section>
            </aside>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/85 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 flex-1 rounded-2xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1] sm:flex-none"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            className="min-h-10 flex-1 rounded-2xl bg-gray-950 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 sm:flex-none"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PromptSquare() {
  const setPrompt = useStore((s) => s.setPrompt)
  const setParams = useStore((s) => s.setParams)
  const setInputImages = useStore((s) => s.setInputImages)
  const setAppMode = useStore((s) => s.setAppMode)
  const settings = useStore((s) => s.settings)
  const showToast = useStore((s) => s.showToast)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [mediaType, setMediaType] = useState<MediaFilter>(DEFAULT_MEDIA_FILTER)
  const [showFavoriteCollections, setShowFavoriteCollections] = useState(false)
  const [activeFavoriteCollectionId, setActiveFavoriteCollectionId] = useState<string | null>(null)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [items, setItems] = useState<PromptSquareItem[]>([])
  const [favoriteCollections, setFavoriteCollections] = useState<PromptSquareFavoriteCollection[]>([])
  const [defaultFavoriteCollectionId, setDefaultFavoriteCollectionId] = useState<string | null>(null)
  const [favoritePickerItemId, setFavoritePickerItemId] = useState<string | null>(null)
  const [manageCollectionsOpen, setManageCollectionsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PromptSquareDraft | null>(null)
  const [activeEffectImageByItemId, setActiveEffectImageByItemId] = useState<Record<string, number>>({})
  const [imageLightbox, setImageLightbox] = useState<{ itemId: string; images: InputImage[]; index: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const activeProfile = getActiveApiProfile(settings)
  const qualityOptions = useMemo(() => getQualityOptionsForProvider(activeProfile.provider), [activeProfile.provider])
  const qualityDisabled = activeProfile.provider === 'openai' && activeProfile.codexCli
  const defaultQuality = getSelectableQualityValue(undefined, activeProfile.provider, qualityDisabled)

  const persistPromptSquareFavoriteState = useCallback(async (
    nextItems: PromptSquareItem[],
    nextCollections: PromptSquareFavoriteCollection[],
    nextDefaultCollectionId: string | null,
  ) => {
    await Promise.all([
      replacePromptSquareItems(nextItems),
      replacePromptSquareFavoriteCollections(nextCollections),
      putPromptSquareDefaultFavoriteCollectionId(nextDefaultCollectionId),
    ])
    setItems(nextItems)
    setFavoriteCollections(nextCollections)
    setDefaultFavoriteCollectionId(nextDefaultCollectionId)
  }, [])

  const reloadLibrary = useCallback(async () => {
    setLoading(true)
    try {
      const [storedItems, storedCollections, storedDefaultCollectionId] = await Promise.all([
        getAllPromptSquareItems(),
        getAllPromptSquareFavoriteCollections(),
        getPromptSquareDefaultFavoriteCollectionId(),
      ])
      const normalized = normalizePromptSquareFavoriteState(storedItems, storedCollections, storedDefaultCollectionId)
      setItems(normalized.items)
      setFavoriteCollections(normalized.collections)
      setDefaultFavoriteCollectionId(normalized.defaultCollectionId)
      await Promise.all([
        replacePromptSquareItems(normalized.items),
        replacePromptSquareFavoriteCollections(normalized.collections),
        putPromptSquareDefaultFavoriteCollectionId(normalized.defaultCollectionId),
      ])
    } catch {
      showToast('加载提示词库失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void reloadLibrary()
  }, [reloadLibrary])

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
      if (activeFavoriteCollectionId) {
        if (!item.isFavorite) return false
        if (activeFavoriteCollectionId !== ALL_PROMPT_SQUARE_FAVORITES_COLLECTION_ID && !getPromptSquareItemFavoriteCollectionIds(item).includes(activeFavoriteCollectionId)) return false
      }
      if (!normalizedQuery) return true
      return getSearchText(item).includes(normalizedQuery)
    }))
  }, [activeFavoriteCollectionId, category, items, mediaType, query])
  const detailItem = useMemo(
    () => items.find((item) => item.id === detailItemId) ?? null,
    [detailItemId, items],
  )
  const favoritePickerItem = useMemo(
    () => items.find((item) => item.id === favoritePickerItemId) ?? null,
    [favoritePickerItemId, items],
  )
  const activeFavoriteCollectionTitle = activeFavoriteCollectionId
    ? getPromptSquareFavoriteCollectionTitle(activeFavoriteCollectionId, favoriteCollections)
    : ''

  const getActiveEffectImageIndex = useCallback((itemId: string) => activeEffectImageByItemId[itemId] ?? 0, [activeEffectImageByItemId])

  const setActiveEffectImageIndex = useCallback((itemId: string, index: number) => {
    setActiveEffectImageByItemId((current) => {
      if (current[itemId] === index) return current
      return { ...current, [itemId]: index }
    })
  }, [])

  const openEffectImageLightbox = useCallback((itemId: string, images: InputImage[], index: number) => {
    setActiveEffectImageIndex(itemId, index)
    setImageLightbox({ itemId, images, index })
  }, [setActiveEffectImageIndex])

  const updateEffectImageLightboxIndex = useCallback((index: number) => {
    if (imageLightbox?.itemId) setActiveEffectImageIndex(imageLightbox.itemId, index)
    setImageLightbox((current) => current ? { ...current, index } : current)
  }, [imageLightbox?.itemId, setActiveEffectImageIndex])

  const updateItem = async (item: PromptSquareItem) => {
    try {
      await putPromptSquareItem(item)
      setItems((current) => current.map((entry) => entry.id === item.id ? item : entry))
      return true
    } catch {
      showToast('保存提示词失败', 'error')
      return false
    }
  }

  const updateItemFavoriteCollections = async (item: PromptSquareItem, collectionIds: string[]) => {
    const ids = normalizePromptSquareFavoriteCollectionIds(collectionIds)
      .filter((id) => favoriteCollections.some((collection) => collection.id === id))
    const nextItem: PromptSquareItem = {
      ...item,
      favoriteCollectionIds: ids,
      isFavorite: ids.length > 0,
      updatedAt: Date.now(),
    }
    try {
      const saved = await updateItem(nextItem)
      if (!saved) return
      setFavoritePickerItemId(null)
      showToast(ids.length ? '收藏夹已更新' : '已移出收藏夹', 'success')
    } catch {
      showToast('更新收藏夹失败', 'error')
    }
  }

  const createFavoriteCollectionFromName = async (name: string) => {
    const collection = createPromptSquareFavoriteCollection(favoriteCollections, name)
    if (!collection) {
      showToast('收藏夹名称不能为空', 'error')
      return null
    }
    if (favoriteCollections.some((item) => item.id === collection.id)) {
      showToast('收藏夹已存在', 'info')
      return collection
    }
    const nextCollections = [...favoriteCollections, collection]
    const normalized = normalizePromptSquareFavoriteState(items, nextCollections, defaultFavoriteCollectionId)
    try {
      await persistPromptSquareFavoriteState(normalized.items, normalized.collections, normalized.defaultCollectionId)
      showToast('收藏夹已新建', 'success')
      return collection
    } catch {
      showToast('新建收藏夹失败', 'error')
      return null
    }
  }

  const renameFavoriteCollectionById = async (collectionId: string, name: string) => {
    const nextCollections = renamePromptSquareFavoriteCollection(favoriteCollections, collectionId, name)
    const normalized = normalizePromptSquareFavoriteState(items, nextCollections, defaultFavoriteCollectionId)
    try {
      await persistPromptSquareFavoriteState(normalized.items, normalized.collections, normalized.defaultCollectionId)
      showToast('收藏夹已重命名', 'success')
    } catch {
      showToast('重命名收藏夹失败', 'error')
    }
  }

  const reorderFavoriteCollections = async (nextCollections: PromptSquareFavoriteCollection[]) => {
    const normalized = normalizePromptSquareFavoriteState(items, nextCollections, defaultFavoriteCollectionId)
    try {
      await persistPromptSquareFavoriteState(normalized.items, normalized.collections, normalized.defaultCollectionId)
    } catch {
      showToast('保存收藏夹排序失败', 'error')
    }
  }

  const setDefaultFavoriteCollection = async (collectionId: string) => {
    if (defaultFavoriteCollectionId === collectionId) return
    const normalized = normalizePromptSquareFavoriteState(items, favoriteCollections, collectionId)
    try {
      await persistPromptSquareFavoriteState(normalized.items, normalized.collections, normalized.defaultCollectionId)
      showToast('默认收藏夹已更新', 'success')
    } catch {
      showToast('更新默认收藏夹失败', 'error')
    }
  }

  const requestDeleteFavoriteCollection = (collection: PromptSquareFavoriteCollection) => {
    if (favoriteCollections.length <= 1) return
    const count = getCollectionItems(collection.id, items).length
    setConfirmDialog({
      title: '删除收藏夹',
      message: `确定要删除收藏夹「${collection.name}」吗？这只会移除 ${count} 个模板的收藏关系，不会删除模板本体。`,
      confirmText: '删除',
      cancelText: '取消',
      action: async () => {
        const next = removePromptSquareFavoriteCollection(items, favoriteCollections, defaultFavoriteCollectionId, collection.id)
        try {
          await persistPromptSquareFavoriteState(next.items, next.collections, next.defaultCollectionId)
          if (activeFavoriteCollectionId === collection.id) setActiveFavoriteCollectionId(null)
          showToast('收藏夹已删除', 'success')
        } catch {
          showToast('删除收藏夹失败', 'error')
        }
      },
    })
  }

  const openCreateModal = () => {
    setEditingItemId(null)
    setDraft({
      title: '',
      prompt: '',
      mediaType,
      category: '',
      tagsText: '',
      quality: defaultQuality,
      aspectRatio: DEFAULT_PROMPT_SQUARE_RATIO,
      effectImages: [],
      referenceImages: [],
      accentColor: '',
      isFeatured: false,
    })
  }

  const openEditModal = (item: PromptSquareItem) => {
    setEditingItemId(item.id)
    setDraft(promptSquareItemToDraft(item))
  }

  const saveDraft = async () => {
    if (!draft) return
    const errors = validatePromptSquareDraft(draft)
    if (errors.length) {
      showToast(errors[0], 'error')
      return
    }
    const nextItem = normalizePromptSquareDraft({
      ...draft,
      quality: getSelectableQualityValue(draft.quality, activeProfile.provider, qualityDisabled),
    })
    const existingItem = items.find((item) => item.id === nextItem.id)
    const itemToSave: PromptSquareItem = existingItem
      ? {
          ...nextItem,
          favoriteCollectionIds: getPromptSquareItemFavoriteCollectionIds(existingItem),
          isFavorite: Boolean(existingItem.isFavorite),
        }
      : nextItem
    try {
      await putPromptSquareItem(itemToSave)
      setItems((current) => {
        const exists = current.some((item) => item.id === itemToSave.id)
        return exists
          ? current.map((item) => item.id === itemToSave.id ? itemToSave : item)
          : [...current, itemToSave]
      })
      setDraft(null)
      setEditingItemId(null)
      showToast(editingItemId ? '提示词已更新' : '提示词已新增', 'success')
    } catch {
      showToast('保存提示词失败', 'error')
    }
  }

  const requestDeleteItem = (item: PromptSquareItem) => {
    setConfirmDialog({
      title: '删除提示词',
      message: '确定要删除这个提示词模板吗？此操作不会影响画廊任务。',
      confirmText: '删除',
      cancelText: '取消',
      action: async () => {
        try {
          await deletePromptSquareItem(item.id)
          setItems((current) => current.filter((entry) => entry.id !== item.id))
          setDetailItemId(null)
          setImageLightbox((current) => current?.itemId === item.id ? null : current)
          setActiveEffectImageByItemId((current) => {
            if (!(item.id in current)) return current
            const { [item.id]: _removed, ...rest } = current
            return rest
          })
          setDraft((current) => current?.id === item.id ? null : current)
          setEditingItemId((current) => current === item.id ? null : current)
          showToast('提示词已删除', 'success')
        } catch {
          showToast('删除提示词失败', 'error')
        }
      },
    })
  }

  const exportLibrary = () => {
    const manifest = createPromptSquareManifest(items, favoriteCollections, defaultFavoriteCollectionId)
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prompt-square-${new Date(manifest.exportedAt).toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showToast('提示词库已导出', 'success')
  }

  const importLibraryFile = async (file: File | null) => {
    if (!file) return
    try {
      const parsed = parsePromptSquareManifest(JSON.parse(await file.text()))
      if (!parsed.ok) {
        showToast(parsed.error, 'error')
        return
      }
      const itemMap = new Map(items.map((item) => [item.id, item]))
      for (const item of parsed.items) itemMap.set(item.id, item)
      const importedDefault = parsed.defaultCollectionId ?? defaultFavoriteCollectionId
      const normalized = normalizePromptSquareFavoriteState(
        [...itemMap.values()],
        normalizePromptSquareFavoriteCollections([...favoriteCollections, ...parsed.collections]),
        importedDefault,
      )
      await persistPromptSquareFavoriteState(normalized.items, normalized.collections, normalized.defaultCollectionId)
      showToast(`已导入 ${parsed.items.length} 个提示词`, 'success')
    } catch {
      showToast('导入提示词库失败', 'error')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const openFavoriteView = () => {
    if (activeFavoriteCollectionId) {
      setActiveFavoriteCollectionId(null)
      setShowFavoriteCollections(true)
      return
    }
    setShowFavoriteCollections((value) => !value)
  }

  const openFavoriteCollection = (collectionId: string) => {
    setActiveFavoriteCollectionId(collectionId)
    setShowFavoriteCollections(true)
  }

  const closeFavoriteView = () => {
    setShowFavoriteCollections(false)
    setActiveFavoriteCollectionId(null)
  }

  const inCollectionOverview = showFavoriteCollections && !activeFavoriteCollectionId

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
    const size = getPromptSquareSizeForRatio(item.aspectRatio)
    const paramsPatch: Partial<TaskParams> = {
      quality: getSelectableQualityValue(item.quality, activeProfile.provider, qualityDisabled),
    }
    if (size) paramsPatch.size = size
    setParams(paramsPatch)
    if (item.referenceImages?.length) {
      setInputImages(item.referenceImages.map((image) => ({ ...image })))
    } else {
      setInputImages([])
    }
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
              onClick={openFavoriteView}
              className={`rounded-xl border p-2.5 transition-all ${showFavoriteCollections ? 'border-yellow-400 bg-yellow-50 text-yellow-500 dark:bg-yellow-500/10' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:bg-white/[0.06]'}`}
              title={activeFavoriteCollectionId ? '返回收藏夹总览' : showFavoriteCollections ? '退出收藏夹视图' : '收藏夹'}
              aria-label={activeFavoriteCollectionId ? '返回收藏夹总览' : showFavoriteCollections ? '退出收藏夹视图' : '收藏夹'}
            >
              <FavoriteIcon filled={showFavoriteCollections} className="h-5 w-5" />
            </button>
            {showFavoriteCollections && (
              <button
                type="button"
                onClick={() => setManageCollectionsOpen(true)}
                className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-700 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                title="管理收藏夹"
                aria-label="管理收藏夹"
              >
                <CollectionManageIcon className="h-5 w-5" />
              </button>
            )}
            {!showFavoriteCollections && (
              <>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-700 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                  title="导入提示词库"
                  aria-label="导入提示词库"
                >
                  <ImportIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={exportLibrary}
                  className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-700 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                  title="导出提示词库"
                  aria-label="导出提示词库"
                >
                  <ExportIcon className="h-5 w-5" />
                </button>
              </>
            )}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void importLibraryFile(event.target.files?.[0] ?? null)}
            />
            {!showFavoriteCollections && (
              <div className="relative w-28 sm:w-32">
                <Select
                  value={category}
                  onChange={(value) => setCategory(String(value))}
                  options={categoryOptions}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm transition hover:bg-gray-50 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-gray-900 dark:hover:bg-white/[0.06]"
                />
              </div>
            )}
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
              placeholder={inCollectionOverview ? '搜索收藏夹名称...' : '搜索标题、提示词、标签...'}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-4 pl-10 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-gray-900"
            />
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {inCollectionOverview
              ? `共 ${favoriteCollections.length + 1} 个收藏夹`
              : `共 ${visibleItems.length} 个模板 · ${mediaLabel(mediaType)}${activeFavoriteCollectionTitle ? ` · ${activeFavoriteCollectionTitle}` : ''}`}
          </span>
          {showFavoriteCollections && (
            <button
              type="button"
              onClick={closeFavoriteView}
              className="rounded-lg px-2 py-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            >
              退出收藏夹
            </button>
          )}
        </div>

        {loading ? (
          <section className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">正在加载提示词库...</section>
        ) : inCollectionOverview ? (
          <PromptSquareFavoriteCollectionsView
            items={items}
            collections={favoriteCollections}
            defaultCollectionId={defaultFavoriteCollectionId}
            query={query}
            onOpenCollection={openFavoriteCollection}
            onManage={() => setManageCollectionsOpen(true)}
          />
        ) : visibleItems.length ? (
          <section className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => (
              <PromptCard
                key={item.id}
                item={item}
                favorite={Boolean(item.isFavorite)}
                activeImageIndex={getActiveEffectImageIndex(item.id)}
                onActiveImageIndexChange={(index) => setActiveEffectImageIndex(item.id, index)}
                onOpenImage={(images, index) => openEffectImageLightbox(item.id, images, index)}
                onToggleFavorite={() => setFavoritePickerItemId(item.id)}
                onCopy={() => void copyPrompt(item)}
                onUse={() => usePrompt(item)}
                onOpen={() => setDetailItemId(item.id)}
              />
            ))}
          </section>
        ) : (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            {items.length ? (
              <p className="text-sm">没有找到匹配的提示词模板</p>
            ) : (
              <>
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm">暂无提示词模板，点击底部 + 新增</p>
              </>
            )}
          </div>
        )}
      </div>

      <div data-no-drag-select className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-1/2 z-30 flex w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center justify-center gap-2 px-3">
        <nav className="relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-gray-200/70 bg-white/90 p-1 text-xs font-medium text-gray-600 shadow-[0_8px_30px_rgb(0,0,0,0.10)] backdrop-blur-xl hide-scrollbar dark:border-white/[0.08] dark:bg-gray-800/90 dark:text-gray-300">
          <span
            className="pointer-events-none absolute left-1 top-1 h-8 rounded-full bg-gray-900 shadow-sm transition-transform duration-300 ease-out dark:bg-white"
            style={{
              width: `${MEDIA_FILTER_WIDTH_REM}rem`,
              transform: `translateX(calc(${getMediaFilterIndex(mediaType)} * (${MEDIA_FILTER_WIDTH_REM}rem + 0.25rem)))`,
            }}
          />
          {MEDIA_FILTERS.map((item) => (
            <MediaFilterButton
              key={item.value}
              value={item.value}
              active={mediaType === item.value}
              onClick={() => setMediaType(item.value)}
            />
          ))}
        </nav>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200/70 bg-white/90 text-gray-700 shadow-[0_8px_30px_rgb(0,0,0,0.10)] backdrop-blur-xl transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-gray-800/90 dark:text-gray-200 dark:hover:bg-white/[0.08]"
          aria-label="新增提示词"
          title="新增提示词"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      <PromptDetailModal
        item={detailItem}
        favorite={detailItem ? Boolean(detailItem.isFavorite) : false}
        activeImageIndex={detailItem ? getActiveEffectImageIndex(detailItem.id) : 0}
        onClose={() => setDetailItemId(null)}
        onActiveImageIndexChange={(index) => {
          if (detailItem) setActiveEffectImageIndex(detailItem.id, index)
        }}
        onOpenImage={(images, index) => {
          if (detailItem) openEffectImageLightbox(detailItem.id, images, index)
        }}
        onToggleFavorite={() => {
          if (detailItem) {
            setFavoritePickerItemId(detailItem.id)
            setDetailItemId(null)
          }
        }}
        onCopy={() => {
          if (detailItem) void copyPrompt(detailItem)
        }}
        onUse={() => {
          if (detailItem) usePrompt(detailItem)
        }}
        onEdit={() => {
          if (detailItem) {
            openEditModal(detailItem)
            setDetailItemId(null)
          }
        }}
        onDelete={() => {
          if (detailItem) requestDeleteItem(detailItem)
        }}
      />

      <PromptSquareImageLightbox
        images={imageLightbox?.images ?? []}
        index={imageLightbox?.index ?? 0}
        onIndexChange={updateEffectImageLightboxIndex}
        onClose={() => setImageLightbox(null)}
      />

      <PromptSquareEditModal
        draft={draft}
        onChange={setDraft}
        onClose={() => {
          setDraft(null)
          setEditingItemId(null)
        }}
        onSave={() => void saveDraft()}
        showToast={showToast}
        qualityOptions={qualityOptions}
        qualityDisabled={qualityDisabled}
        qualityProvider={activeProfile.provider}
      />

      <PromptSquareFavoritePickerModal
        item={favoritePickerItem}
        collections={favoriteCollections}
        defaultCollectionId={defaultFavoriteCollectionId}
        onClose={() => setFavoritePickerItemId(null)}
        onCreate={createFavoriteCollectionFromName}
        onConfirm={updateItemFavoriteCollections}
      />

      <PromptSquareManageCollectionsModal
        open={manageCollectionsOpen}
        collections={favoriteCollections}
        defaultCollectionId={defaultFavoriteCollectionId}
        onClose={() => setManageCollectionsOpen(false)}
        onCreate={createFavoriteCollectionFromName}
        onRename={renameFavoriteCollectionById}
        onReorder={reorderFavoriteCollections}
        onSetDefault={setDefaultFavoriteCollection}
        onDelete={requestDeleteFavoriteCollection}
      />
    </main>
  )
}
