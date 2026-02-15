const MAX_CONCURRENT = 3
let running = 0
const queue: (() => void)[] = []

function tryNext() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    running++
    queue.shift()!()
  }
}

/** Request a render slot. Returns a promise that resolves with a release function. */
export function acquireSlot(): Promise<() => void> {
  return new Promise<() => void>((resolve) => {
    const grant = () => {
      let released = false
      resolve(() => {
        if (released) return
        released = true
        running--
        tryNext()
      })
    }
    if (running < MAX_CONCURRENT) {
      running++
      grant()
    } else {
      queue.push(grant)
    }
  })
}
