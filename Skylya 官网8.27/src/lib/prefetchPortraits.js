// Shared portrait prefetch — one entry point for TypeGallery + HowItWorks.
// iOS Safari has no requestIdleCallback, so "idle" timers used to fire right
// as the user's first fling started (main-thread + memory-bandwidth contention
// on 8 parallel 1MP decodes). This version waits for window load + a genuine
// scroll-quiet window, then decodes the SMALL (512s) set serially — one image
// per decode chain — and pins references so GC can't drop the decoded bitmaps.
const pinned = []
let started = false

function decodeSerially(urls) {
  let chain = Promise.resolve()
  urls.forEach((url) => {
    chain = chain.then(() => {
      const im = new Image()
      im.decoding = 'async'
      im.src = url
      pinned.push(im)
      return im.decode().catch(() => {})
    })
  })
  return chain
}

export default function prefetchPortraits(urls) {
  if (started) return
  started = true

  const kickoff = () => {
    let quietTimer = 0
    const arm = () => {
      clearTimeout(quietTimer)
      quietTimer = setTimeout(() => {
        window.removeEventListener('scroll', arm)
        decodeSerially(urls)
      }, 500)
    }
    window.addEventListener('scroll', arm, { passive: true })
    arm()
  }

  if (document.readyState === 'complete') kickoff()
  else window.addEventListener('load', kickoff, { once: true })
}
