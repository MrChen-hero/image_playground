import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPromptSquareItems,
  deletePromptSquareItem,
  getAllPromptSquareItems,
  mergePromptSquareItems,
  putPromptSquareItem,
  replacePromptSquareItems,
} from './db'
import type { PromptSquareItem } from '../types'

type StoreRecord = Record<string, unknown>
type MockRequest<T> = {
  result: T
  onsuccess: ((event: { target: MockRequest<T> }) => void) | null
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

function installIndexedDbMock() {
  const indexedDbMock = {
    open: (_name: string, _version: number) => {
      const db = {
        objectStoreNames: {
          contains: (storeName: string) => stores.has(storeName),
        },
        createObjectStore: (storeName: string) => {
          stores.set(storeName, stores.get(storeName) ?? new Map())
        },
        transaction: (storeName: string, _mode: IDBTransactionMode) => {
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
      }
      setTimeout(() => {
        request.onupgradeneeded?.({ target: request })
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

describe('prompt square IndexedDB helpers', () => {
  beforeEach(async () => {
    stores.clear()
    installIndexedDbMock()
    await clearPromptSquareItems()
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
})
