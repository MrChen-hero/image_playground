import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPromptSquareFavoriteCollections,
  clearPromptSquareItems,
  clearTasks,
  deletePromptSquareFavoriteCollection,
  deletePromptSquareItem,
  getAllTasks,
  getAllPromptSquareFavoriteCollections,
  getAllPromptSquareItems,
  getPromptSquareDefaultFavoriteCollectionId,
  mergePromptSquareFavoriteCollections,
  mergePromptSquareItems,
  putPromptSquareDefaultFavoriteCollectionId,
  putPromptSquareFavoriteCollection,
  putPromptSquareItem,
  putTask,
  replacePromptSquareFavoriteCollections,
  replacePromptSquareItems,
} from './db'
import type { PromptSquareFavoriteCollection, PromptSquareItem, TaskRecord } from '../types'

type StoreRecord = Record<string, unknown>
type MockRequest<T> = {
  result: T
  onsuccess: ((event: { target: MockRequest<T> }) => void) | null
  onerror?: ((event: { target: MockRequest<T> }) => void) | null
  onblocked?: ((event: { target: MockRequest<T> }) => void) | null
  error?: Error | DOMException | null
}
type MockOpenRequest = MockRequest<IDBDatabase> & {
  onupgradeneeded: ((event: { target: MockOpenRequest }) => void) | null
}
type MockTransaction = {
  oncomplete: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  onabort: ((event: Event) => void) | null
  objectStore: () => IDBObjectStore
}

const stores = new Map<string, Map<string, StoreRecord>>()
let dbVersion = 0

function installIndexedDbMock() {
  const indexedDbMock = {
    open: (_name: string, requestedVersion?: number) => {
      const nextVersion = requestedVersion ?? (dbVersion || 1)
      const shouldUpgrade = dbVersion === 0 || nextVersion > dbVersion
      dbVersion = Math.max(dbVersion, nextVersion)
      const db = {
        version: dbVersion,
        objectStoreNames: {
          contains: (storeName: string) => stores.has(storeName),
        },
        createObjectStore: (storeName: string) => {
          stores.set(storeName, stores.get(storeName) ?? new Map())
        },
        close: () => {},
        transaction: (storeName: string, _mode: IDBTransactionMode) => {
          if (!stores.has(storeName)) {
            throw new Error(`Object store ${storeName} does not exist`)
          }
          const tx: MockTransaction = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: () => {
              throw new Error('Object store is not initialized')
            },
          }
          const store = stores.get(storeName) ?? new Map<string, StoreRecord>()
          stores.set(storeName, store)

          const completeSoon = () => {
            setTimeout(() => tx.oncomplete?.(new Event('complete')), 0)
          }

          const createRequest = <T,>(result: T) => {
            const storeRequest: MockRequest<T> = { result, onsuccess: null }
            setTimeout(() => storeRequest.onsuccess?.({ target: storeRequest }), 0)
            return storeRequest as unknown as IDBRequest<T>
          }

          tx.objectStore = () => ({
            get: (id: string) => createRequest(store.get(id)),
            getAll: () => createRequest([...store.values()]),
            getAllKeys: () => createRequest([...store.keys()]),
            put: (value: StoreRecord) => {
              store.set(String(value.id), value)
              completeSoon()
              return createRequest(String(value.id))
            },
            delete: (id: string) => {
              store.delete(id)
              completeSoon()
              return createRequest(undefined)
            },
            clear: () => {
              store.clear()
              completeSoon()
              return createRequest(undefined)
            },
          } as unknown as IDBObjectStore)
          return tx as unknown as IDBTransaction
        },
      } as IDBDatabase

      const request: MockOpenRequest = {
        result: db,
        onsuccess: null,
        onupgradeneeded: null,
        onerror: null,
        onblocked: null,
        error: null,
      }
      setTimeout(() => {
        if (shouldUpgrade) request.onupgradeneeded?.({ target: request })
        request.onsuccess?.({ target: request })
      }, 0)
      return request as unknown as IDBOpenDBRequest
    },
  }

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: indexedDbMock as unknown as IDBFactory,
  })
}

const item = (overrides: Partial<PromptSquareItem> = {}): PromptSquareItem => ({
  id: 'prompt-a',
  title: 'Title',
  prompt: 'Prompt',
  category: '未分类',
  mediaType: 'image',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

const collection = (overrides: Partial<PromptSquareFavoriteCollection> = {}): PromptSquareFavoriteCollection => ({
  id: 'collection-a',
  name: '默认',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-a',
  prompt: 'Prompt',
  params: {
    size: 'auto',
    quality: 'auto',
    output_format: 'png',
    output_compression: null,
    moderation: 'auto',
    n: 1,
  },
  inputImageIds: [],
  outputImages: [],
  status: 'done',
  error: null,
  createdAt: 1,
  finishedAt: 1,
  elapsed: 1,
  ...overrides,
})

describe('prompt square IndexedDB helpers', () => {
  beforeEach(async () => {
    stores.clear()
    dbVersion = 0
    installIndexedDbMock()
    await clearPromptSquareItems()
    await clearPromptSquareFavoriteCollections()
    await clearTasks()
  })

  it('stores, updates, deletes, merges, and replaces prompt square items', async () => {
    await putPromptSquareItem(item())
    expect(await getAllPromptSquareItems()).toHaveLength(1)

    await putPromptSquareItem(item({ title: 'Updated', updatedAt: 2 }))
    expect((await getAllPromptSquareItems())[0].title).toBe('Updated')

    await mergePromptSquareItems([
      item({ id: 'prompt-a', title: 'Imported update', updatedAt: 3 }),
      item({ id: 'prompt-b', title: 'Imported new', createdAt: 4, updatedAt: 4 }),
    ])
    expect((await getAllPromptSquareItems()).map((entry) => entry.id).sort()).toEqual(['prompt-a', 'prompt-b'])

    await deletePromptSquareItem('prompt-a')
    expect((await getAllPromptSquareItems()).map((entry) => entry.id)).toEqual(['prompt-b'])

    await replacePromptSquareItems([
      item({ id: 'prompt-c', title: 'Replacement', createdAt: 5, updatedAt: 5 }),
    ])
    expect((await getAllPromptSquareItems()).map((entry) => entry.id)).toEqual(['prompt-c'])
  })

  it('stores, updates, deletes, merges, and replaces prompt square favorite collections', async () => {
    await putPromptSquareFavoriteCollection(collection())
    expect(await getAllPromptSquareFavoriteCollections()).toHaveLength(1)

    await putPromptSquareFavoriteCollection(collection({ name: 'Updated', updatedAt: 2 }))
    expect((await getAllPromptSquareFavoriteCollections())[0].name).toBe('Updated')

    await mergePromptSquareFavoriteCollections([
      collection({ id: 'collection-a', name: 'Imported update', updatedAt: 3 }),
      collection({ id: 'collection-b', name: 'Imported new', createdAt: 4, updatedAt: 4 }),
    ])
    expect((await getAllPromptSquareFavoriteCollections()).map((entry) => entry.id).sort()).toEqual(['collection-a', 'collection-b'])

    await deletePromptSquareFavoriteCollection('collection-a')
    expect((await getAllPromptSquareFavoriteCollections()).map((entry) => entry.id)).toEqual(['collection-b'])

    await replacePromptSquareFavoriteCollections([
      collection({ id: 'collection-c', name: 'Replacement', createdAt: 5, updatedAt: 5 }),
    ])
    expect((await getAllPromptSquareFavoriteCollections()).map((entry) => entry.id)).toEqual(['collection-c'])
  })

  it('stores prompt square default favorite collection id independently', async () => {
    expect(await getPromptSquareDefaultFavoriteCollectionId()).toBeNull()

    await putPromptSquareDefaultFavoriteCollectionId('collection-a')
    expect(await getPromptSquareDefaultFavoriteCollectionId()).toBe('collection-a')

    await putPromptSquareDefaultFavoriteCollectionId(null)
    expect(await getPromptSquareDefaultFavoriteCollectionId()).toBeNull()
  })

  it('keeps gallery tasks intact when clearing prompt square items', async () => {
    await putTask(task())
    await putPromptSquareItem(item())

    await clearPromptSquareItems()

    expect(await getAllPromptSquareItems()).toEqual([])
    expect((await getAllTasks()).map((entry) => entry.id)).toEqual(['task-a'])
  })

  it('repairs missing prompt square favorite stores in an existing database version', async () => {
    stores.clear()
    dbVersion = 5
    stores.set('tasks', new Map())
    stores.set('images', new Map())
    stores.set('thumbnails', new Map())
    stores.set('agentConversations', new Map())
    stores.set('promptSquareItems', new Map())
    installIndexedDbMock()

    expect(await getAllPromptSquareFavoriteCollections()).toEqual([])
    await putPromptSquareDefaultFavoriteCollectionId('collection-a')
    expect(await getPromptSquareDefaultFavoriteCollectionId()).toBe('collection-a')
  })
})
