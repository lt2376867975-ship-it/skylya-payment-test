// Shared overlay ↔ history bridge (round-4 D-high ×2).
//
// Problem 1: opening an overlay (TestIntro / type-detail modal) pushed no
// history entry, so the iOS Safari back-swipe / Android system Back left the
// whole site (about:blank) instead of closing the overlay.
// Problem 2: an overlay opened over another (TestIntro launched from inside a
// type modal) could hand off / dismiss without closing the one beneath it,
// stranding the visitor behind an opaque panel.
//
// One sentinel history entry guards the whole stack: the first overlay pushes
// it, the last to close consumes it. System Back closes the topmost overlay
// (and re-guards if more remain). Programmatic close consumes the sentinel via
// history.back(), flagged so our own popstate is ignored.

const stack = [] // close callbacks, topmost last
let guarded = false // is our sentinel entry currently on the history stack?
let selfPop = false // ignore the one popstate WE trigger via history.back()

// iOS scroll lock. `body{overflow:hidden}` does NOT stop touch scrolling on
// iOS Safari — the page behind an open sheet still scrolls under your finger
// (user-caught). Pinning the body with position:fixed is the only reliable
// lock; the scroll position is saved and restored on unlock.
let locked = false
let savedScrollY = 0
// Lock deferral (iPhone 流畅度): pinning the body (position:fixed) forces a
// full-document reflow, which used to land on the same frame as the overlay's
// entrance spring. Defer the lock past the ~300ms entrance; the overlay scrim
// carries touch-action:none / overscroll-contain to hold the page still during
// the unlocked window. Closing within the window just cancels the timer —
// unlockScroll on a never-locked body is a no-op (guarded by `locked`).
let lockTimer = 0
function lockScroll() {
  if (locked || typeof document === 'undefined') return
  locked = true
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0
  const b = document.body.style
  b.position = 'fixed'
  b.top = `-${savedScrollY}px`
  b.left = '0'
  b.right = '0'
  b.width = '100%'
}
function unlockScroll() {
  if (!locked) return
  locked = false
  const b = document.body.style
  b.position = ''
  b.top = ''
  b.left = ''
  b.right = ''
  b.width = ''
  window.scrollTo(0, savedScrollY)
}
function syncLock() {
  if (stack.length) {
    if (!locked && !lockTimer) {
      lockTimer = setTimeout(() => {
        lockTimer = 0
        lockScroll()
      }, 350)
    }
  } else {
    if (lockTimer) {
      clearTimeout(lockTimer)
      lockTimer = 0
    }
    unlockScroll()
  }
}

function ensureGuard() {
  if (!guarded && typeof history !== 'undefined') {
    history.pushState({ __skylyaOverlay: true }, '')
    guarded = true
  }
}

function consumeGuard() {
  if (guarded && typeof history !== 'undefined') {
    guarded = false
    selfPop = true
    history.back()
  }
}

export function openOverlay(close) {
  stack.push(close)
  ensureGuard()
  syncLock()
}

export function closeOverlay(close) {
  const i = stack.lastIndexOf(close)
  if (i !== -1) stack.splice(i, 1)
  if (stack.length === 0) consumeGuard()
  syncLock()
}

// Close every open overlay (used when one overlay hands off to a section, so
// the panel(s) beneath it never strand — round-4 D-high #2).
export function closeAllOverlays() {
  const all = stack.slice().reverse()
  stack.length = 0
  consumeGuard()
  syncLock()
  all.forEach((c) => c())
}

if (typeof window !== 'undefined') {
  // Own scroll position ourselves: the browser's automatic restoration on
  // history.back() (used to consume our sentinel entry) otherwise yanks the
  // page back to where an overlay was opened, fighting the programmatic
  // hand-off scroll to the target section.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

  window.addEventListener('popstate', () => {
    if (selfPop) {
      selfPop = false
      return
    }
    if (stack.length === 0) return
    // Real Back press: the sentinel entry is already gone.
    guarded = false
    const close = stack.pop()
    close()
    if (stack.length) ensureGuard() // more overlays remain → keep guarding
    syncLock()
  })
}
