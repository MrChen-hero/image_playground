import type { AgentConversation, PromptSquareFavoriteCollection, PromptSquareItem, TaskRecord, StoredImage, StoredImageThumbnail } from '../types'

const DB_NAME = 'gpt-image-playground'
const DB_VERSION = 5
const STORE_TASKS = 'tasks'
const STORE_IMAGES = 'images'
const STORE_THUMBNAILS = 'thumbnails'
const STORE_AGENT_CONVERSATIONS = 'agentConversations'
const STORE_PROMPT_SQUARE_ITEMS = 'promptSquareItems'
const STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS = 'promptSquareFavoriteCollections'
const STORE_PROMPT_SQUARE_FAVORITE_META = 'promptSquareFavoriteMeta'
const PROMPT_SQUARE_DEFAULT_FAVORITE_COLLECTION_META_ID = 'defaultCollectionId'
const THUMBNAIL_MAX_SIZE = 720
const THUMBNAIL_QUALITY = 0.9
const THUMBNAIL_VERSION = 2
const REQUIRED_OBJECT_STORES = [
  STORE_TASKS,
  STORE_IMAGES,
  STORE_THUMBNAILS,
  STORE_AGENT_CONVERSATIONS,
  STORE_PROMPT_SQUARE_ITEMS,
  STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS,
  STORE_PROMPT_SQUARE_FAVORITE_META,
] as const

export const CURRENT_THUMBNAIL_VERSION = THUMBNAIL_VERSION

function createMissingObjectStores(db: IDBDatabase) {
  for (const storeName of REQUIRED_OBJECT_STORES) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: 'id' })
    }
  }
}

function hasRequiredObjectStores(db: IDBDatabase) {
  return REQUIRED_OBJECT_STORES.every((storeName) => db.objectStoreNames.contains(storeName))
}

function openDBAtVersion(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = typeof version === 'number' ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      createMissingObjectStores(db)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another open connection'))
  })
}

async function openDB(): Promise<IDBDatabase> {
  let db: IDBDatabase
  try {
    db = await openDBAtVersion(DB_VERSION)
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'VersionError') throw error
    db = await openDBAtVersion()
  }

  if (hasRequiredObjectStores(db)) return db

  const nextVersion = db.version + 1
  db.close()
  const upgradedDb = await openDBAtVersion(nextVersion)
  if (!hasRequiredObjectStores(upgradedDb)) {
    upgradedDb.close()
    throw new Error('IndexedDB schema is missing required object stores')
  }
  return upgradedDb
}

function dbTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

// ===== Tasks =====

export function getAllTasks(): Promise<TaskRecord[]> {
  return dbTransaction(STORE_TASKS, 'readonly', (s) => s.getAll())
}

export function putTask(task: TaskRecord): Promise<IDBValidKey> {
  return dbTransaction(STORE_TASKS, 'readwrite', (s) => s.put(task))
}

export function deleteTask(id: string): Promise<undefined> {
  return dbTransaction(STORE_TASKS, 'readwrite', (s) => s.delete(id))
}

export function clearTasks(): Promise<undefined> {
  return dbTransaction(STORE_TASKS, 'readwrite', (s) => s.clear())
}

// ===== Prompt Square items =====

export function getAllPromptSquareItems(): Promise<PromptSquareItem[]> {
  return dbTransaction(STORE_PROMPT_SQUARE_ITEMS, 'readonly', (s) => s.getAll())
}

export function putPromptSquareItem(item: PromptSquareItem): Promise<IDBValidKey> {
  return dbTransaction(STORE_PROMPT_SQUARE_ITEMS, 'readwrite', (s) => s.put(item))
}

export function deletePromptSquareItem(id: string): Promise<undefined> {
  return dbTransaction(STORE_PROMPT_SQUARE_ITEMS, 'readwrite', (s) => s.delete(id))
}

export function clearPromptSquareItems(): Promise<undefined> {
  return dbTransaction(STORE_PROMPT_SQUARE_ITEMS, 'readwrite', (s) => s.clear())
}

export function replacePromptSquareItems(items: PromptSquareItem[]): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROMPT_SQUARE_ITEMS, 'readwrite')
        const store = tx.objectStore(STORE_PROMPT_SQUARE_ITEMS)
        store.clear()
        for (const item of items) store.put(item)
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export function mergePromptSquareItems(items: PromptSquareItem[]): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROMPT_SQUARE_ITEMS, 'readwrite')
        const store = tx.objectStore(STORE_PROMPT_SQUARE_ITEMS)
        for (const item of items) store.put(item)
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

// ===== Prompt Square favorite collections =====

export function getAllPromptSquareFavoriteCollections(): Promise<PromptSquareFavoriteCollection[]> {
  return dbTransaction(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS, 'readonly', (s) => s.getAll())
}

export function putPromptSquareFavoriteCollection(collection: PromptSquareFavoriteCollection): Promise<IDBValidKey> {
  return dbTransaction(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS, 'readwrite', (s) => s.put(collection))
}

export function deletePromptSquareFavoriteCollection(id: string): Promise<undefined> {
  return dbTransaction(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS, 'readwrite', (s) => s.delete(id))
}

export function clearPromptSquareFavoriteCollections(): Promise<undefined> {
  return dbTransaction(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS, 'readwrite', (s) => s.clear())
}

export function replacePromptSquareFavoriteCollections(collections: PromptSquareFavoriteCollection[]): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS, 'readwrite')
        const store = tx.objectStore(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS)
        store.clear()
        for (const collection of collections) store.put(collection)
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export function mergePromptSquareFavoriteCollections(collections: PromptSquareFavoriteCollection[]): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS, 'readwrite')
        const store = tx.objectStore(STORE_PROMPT_SQUARE_FAVORITE_COLLECTIONS)
        for (const collection of collections) store.put(collection)
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export async function getPromptSquareDefaultFavoriteCollectionId(): Promise<string | null> {
  const record = await dbTransaction<{ id: string; value: string | null } | undefined>(
    STORE_PROMPT_SQUARE_FAVORITE_META,
    'readonly',
    (s) => s.get(PROMPT_SQUARE_DEFAULT_FAVORITE_COLLECTION_META_ID),
  )
  return typeof record?.value === 'string' ? record.value : null
}

export function putPromptSquareDefaultFavoriteCollectionId(defaultCollectionId: string | null): Promise<IDBValidKey> {
  return dbTransaction(STORE_PROMPT_SQUARE_FAVORITE_META, 'readwrite', (s) => s.put({
    id: PROMPT_SQUARE_DEFAULT_FAVORITE_COLLECTION_META_ID,
    value: defaultCollectionId,
  }))
}

// ===== Agent conversations =====

export function getAllAgentConversations(): Promise<AgentConversation[]> {
  return dbTransaction(STORE_AGENT_CONVERSATIONS, 'readonly', (s) => s.getAll())
}

export function putAgentConversation(conversation: AgentConversation): Promise<IDBValidKey> {
  return dbTransaction(STORE_AGENT_CONVERSATIONS, 'readwrite', (s) => s.put(conversation))
}

export function deleteAgentConversation(id: string): Promise<undefined> {
  return dbTransaction(STORE_AGENT_CONVERSATIONS, 'readwrite', (s) => s.delete(id))
}

export function clearAgentConversations(): Promise<undefined> {
  return dbTransaction(STORE_AGENT_CONVERSATIONS, 'readwrite', (s) => s.clear())
}

export function replaceAgentConversations(conversations: AgentConversation[]): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_AGENT_CONVERSATIONS, 'readwrite')
        const store = tx.objectStore(STORE_AGENT_CONVERSATIONS)
        store.clear()
        for (const conversation of conversations) store.put(conversation)
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

// ===== Images =====

export function getImage(id: string): Promise<StoredImage | undefined> {
  return dbTransaction(STORE_IMAGES, 'readonly', (s) => s.get(id))
}

export function getStoredImageThumbnail(id: string): Promise<StoredImageThumbnail | undefined> {
  return dbTransaction(STORE_THUMBNAILS, 'readonly', (s) => s.get(id))
}

export async function getStoredFreshImageThumbnail(id: string): Promise<StoredImageThumbnail | undefined> {
  const thumbnail = await getStoredImageThumbnail(id)
  return thumbnail?.thumbnailVersion === THUMBNAIL_VERSION ? thumbnail : undefined
}

export function putImageThumbnail(thumbnail: StoredImageThumbnail): Promise<IDBValidKey> {
  return dbTransaction(STORE_THUMBNAILS, 'readwrite', (s) => s.put(thumbnail))
}

export async function getImageThumbnail(id: string): Promise<StoredImageThumbnail | undefined> {
  const existingThumbnail = await getStoredImageThumbnail(id)
  if (existingThumbnail?.thumbnailVersion === THUMBNAIL_VERSION) {
    const image = await getImage(id)
    if (image && (!image.width || !image.height) && existingThumbnail.width && existingThumbnail.height) {
      await putImage({ ...image, width: existingThumbnail.width, height: existingThumbnail.height })
    }
    return existingThumbnail
  }

  const image = await getImage(id)
  if (!image) return undefined
  const legacyImage = image as StoredImage & Partial<StoredImageThumbnail>
  if (legacyImage.thumbnailDataUrl && legacyImage.thumbnailVersion === THUMBNAIL_VERSION) {
    const thumbnail: StoredImageThumbnail = {
      id,
      thumbnailDataUrl: legacyImage.thumbnailDataUrl,
      width: legacyImage.width,
      height: legacyImage.height,
      thumbnailVersion: THUMBNAIL_VERSION,
    }
    await putImageThumbnail(thumbnail)
    if ((!image.width || !image.height) && thumbnail.width && thumbnail.height) {
      await putImage({ ...image, width: thumbnail.width, height: thumbnail.height })
    }
    return thumbnail
  }

  const metadata = await safeCreateImageThumbnail(image.dataUrl)
  if (!metadata.thumbnailDataUrl) return undefined
  const thumbnail: StoredImageThumbnail = {
    id,
    thumbnailDataUrl: metadata.thumbnailDataUrl,
    width: metadata.width,
    height: metadata.height,
    thumbnailVersion: THUMBNAIL_VERSION,
  }
  await putImageThumbnail(thumbnail)
  if (metadata.width && metadata.height && (image.width !== metadata.width || image.height !== metadata.height)) {
    await putImage({ ...image, width: metadata.width, height: metadata.height })
  }
  return thumbnail
}

export function getAllImages(): Promise<StoredImage[]> {
  return dbTransaction(STORE_IMAGES, 'readonly', (s) => s.getAll())
}

export function getAllImageIds(): Promise<string[]> {
  return dbTransaction(STORE_IMAGES, 'readonly', (s) => s.getAllKeys()).then((keys) =>
    keys.map(String),
  )
}

export function putImage(image: StoredImage): Promise<IDBValidKey> {
  return dbTransaction(STORE_IMAGES, 'readwrite', (s) => s.put(image))
}

export function deleteImage(id: string): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_IMAGES, STORE_THUMBNAILS], 'readwrite')
        tx.objectStore(STORE_IMAGES).delete(id)
        tx.objectStore(STORE_THUMBNAILS).delete(id)
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export function clearImages(): Promise<undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_IMAGES, STORE_THUMBNAILS], 'readwrite')
        tx.objectStore(STORE_IMAGES).clear()
        tx.objectStore(STORE_THUMBNAILS).clear()
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
      }),
  )
}

// ===== Image hashing & dedup =====

export async function hashDataUrl(dataUrl: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    return hashDataUrlFallback(dataUrl)
  }

  const data = new TextEncoder().encode(dataUrl)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hashDataUrlFallback(dataUrl: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193

  for (let i = 0; i < dataUrl.length; i++) {
    const code = dataUrl.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code
    h2 = Math.imul(h2, 0x27d4eb2d)
  }

  return `fallback-${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * 存储图片，若已存在（按 hash 去重）则跳过。
 * 返回 image id。
 */
export async function storeImage(dataUrl: string, source: NonNullable<StoredImage['source']> = 'upload'): Promise<string> {
  const id = await hashDataUrl(dataUrl)
  const existing = await getImage(id)
  if (!existing) {
    const thumbnail = await safeCreateImageThumbnail(dataUrl)
    await putImage({
      id,
      dataUrl,
      createdAt: Date.now(),
      source,
      width: thumbnail.width,
      height: thumbnail.height,
    })
    if (thumbnail.thumbnailDataUrl) {
      await putImageThumbnail({
        id,
        thumbnailDataUrl: thumbnail.thumbnailDataUrl,
        width: thumbnail.width,
        height: thumbnail.height,
        thumbnailVersion: THUMBNAIL_VERSION,
      })
    }
  } else if ((await getStoredImageThumbnail(id))?.thumbnailVersion !== THUMBNAIL_VERSION) {
    const thumbnail = await safeCreateImageThumbnail(existing.dataUrl)
    if (thumbnail.width && thumbnail.height && (existing.width !== thumbnail.width || existing.height !== thumbnail.height)) {
      await putImage({ ...existing, width: thumbnail.width, height: thumbnail.height })
    }
    if (thumbnail.thumbnailDataUrl) {
      await putImageThumbnail({
        id,
        thumbnailDataUrl: thumbnail.thumbnailDataUrl,
        width: thumbnail.width,
        height: thumbnail.height,
        thumbnailVersion: THUMBNAIL_VERSION,
      })
    }
  }
  return id
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = dataUrl
  })
}

async function createImageThumbnail(dataUrl: string): Promise<Omit<StoredImageThumbnail, 'id'>> {
  const image = await loadImage(dataUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (width <= 0 || height <= 0) throw new Error('图片尺寸无效')

  const scale = Math.min(1, THUMBNAIL_MAX_SIZE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return {
    thumbnailDataUrl: canvas.toDataURL('image/webp', THUMBNAIL_QUALITY),
    width,
    height,
    thumbnailVersion: THUMBNAIL_VERSION,
  }
}

async function safeCreateImageThumbnail(dataUrl: string): Promise<Partial<Omit<StoredImageThumbnail, 'id'>>> {
  try {
    return await createImageThumbnail(dataUrl)
  } catch {
    return {}
  }
}
