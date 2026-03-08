import { describe, it, expect, vi } from 'vitest'
import { createLocalStorageStore } from '../createStore'

describe('createLocalStorageStore', () => {
  it('returns initial snapshot from load()', () => {
    const store = createLocalStorageStore('test-key', () => ({ count: 0 }))
    expect(store.getSnapshot()).toEqual({ count: 0 })
  })

  it('subscribe notifies on emitChange', () => {
    let val = 0
    const store = createLocalStorageStore('test-key', () => val)
    const cb = vi.fn()
    store.subscribe(cb)

    val = 42
    store.emitChange()

    expect(cb).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toBe(42)
  })

  it('unsubscribe stops notifications', () => {
    const store = createLocalStorageStore('test-key', () => 0)
    const cb = vi.fn()
    const unsub = store.subscribe(cb)

    store.emitChange()
    expect(cb).toHaveBeenCalledTimes(1)

    unsub()
    store.emitChange()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('multiple subscribers all notified', () => {
    const store = createLocalStorageStore('test-key', () => 'x')
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    store.subscribe(cb1)
    store.subscribe(cb2)

    store.emitChange()

    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)
  })

  it('getSnapshot returns latest value after emitChange', () => {
    let counter = 0
    const store = createLocalStorageStore('test-key', () => ++counter)
    expect(store.getSnapshot()).toBe(1)

    store.emitChange()
    expect(store.getSnapshot()).toBe(2)

    store.emitChange()
    expect(store.getSnapshot()).toBe(3)
  })

  it('responds to window storage events for matching key', () => {
    const store = createLocalStorageStore('my-key', () => 'updated')
    const cb = vi.fn()
    store.subscribe(cb)

    // Dispatch matching storage event
    window.dispatchEvent(new StorageEvent('storage', { key: 'my-key' }))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('ignores storage events for different keys', () => {
    const store = createLocalStorageStore('my-key', () => 'val')
    const cb = vi.fn()
    store.subscribe(cb)

    window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }))
    expect(cb).not.toHaveBeenCalled()
  })
})
