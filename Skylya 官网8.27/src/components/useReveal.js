import { useLayoutEffect, useRef } from 'react'

/**
 * Adds a reveal class to the ref'd element once it should become visible.
 *
 * Visibility is guaranteed; the fade-up is best-effort only:
 * - `js` marks <html> once, on mount, so the CSS hide-rule in index.css
 *   only ever applies while this hook is live (no JS / hook-not-yet-run =
 *   content stays fully visible).
 * - Above-the-fold elements (already within ~90% of the viewport on mount)
 *   and reduced-motion users get `.reveal-shown` synchronously — no
 *   observer, no wait — so they paint visible on the very first frame.
 *   This runs in a layout effect (before paint) to avoid a hidden flash.
 * - Below-the-fold elements are observed and get the animated `.reveal-in`
 *   class when they scroll into view.
 * - A hard safety net (timeout + rAF) force-adds the instant `.reveal-shown`
 *   state if the element is somehow still hidden ~700ms after mount. This
 *   guarantees every section becomes visible shortly after load even if the
 *   observer never fires or the animation timeline is frozen (background
 *   tabs, crawlers, paused clocks).
 *
 * Optional staggered children: pass `{ stagger: true, step, childSelector }`
 * and each matching child gets an inline `--reveal-delay` so its eased
 * entrance trails the previous one. This is purely additive — it never gates
 * visibility (the CSS hide-rule already resolves to visible for every path).
 */
export default function useReveal(options = {}) {
  const ref = useRef(null)
  const {
    stagger = false,
    step = 70,
    childSelector = '[data-reveal-item]',
    forceVisible = true,
    pointerReveal = false,
  } = options

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    document.documentElement.classList.add('js')
    const canPointerReveal = pointerReveal
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const getKids = () => Array.from(el.querySelectorAll(childSelector))

    const orderKidsFromPoint = (x, y) => {
      const kids = getKids()
      if (!kids.length) return false

      kids
        .map((kid, i) => {
          const rect = kid.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          return { kid, i, d: Math.hypot(cx - x, cy - y) }
        })
        .sort((a, b) => a.d - b.d)
        .forEach(({ kid }, i) => {
          kid.style.setProperty('--reveal-delay', `${i * step}ms`)
        })

      return true
    }

    // Assign per-child stagger delays when a container opts in.
    if (stagger) {
      const kids = getKids()
      kids.forEach((kid, i) => {
        kid.style.setProperty('--reveal-delay', `${i * step}ms`)
      })
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const inInitialViewport = el.getBoundingClientRect().top < window.innerHeight * 0.9

    if (prefersReduced || inInitialViewport) {
      el.classList.add('reveal-shown')
      return undefined
    }

    let settled = false
    let lastPointer = null

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            settled = true
            if (lastPointer) orderKidsFromPoint(lastPointer.x, lastPointer.y)
            el.classList.add('reveal-in')
            observer.unobserve(el)
          }
        })
      },
      { rootMargin: '0px 0px -18% 0px', threshold: 0.18 }
    )
    observer.observe(el)

    const onPointerMove = (event) => {
      if (settled) return
      lastPointer = { x: event.clientX, y: event.clientY }
      const rect = el.getBoundingClientRect()
      const near =
        event.clientY >= rect.top - 90
        && event.clientY <= rect.bottom + 90
        && event.clientX >= rect.left - 120
        && event.clientX <= rect.right + 120

      if (!near) return
      settled = true
      orderKidsFromPoint(event.clientX, event.clientY)
      el.classList.add('reveal-in')
      observer.unobserve(el)
    }
    if (canPointerReveal) window.addEventListener('pointermove', onPointerMove, { passive: true })

    const forceShown = () => {
      if (settled) return
      settled = true
      el.classList.add('reveal-shown')
      observer.disconnect()
    }

    // Hard safety net: if the observer never fires (or the animation
    // timeline is frozen), force the instant visible state. Critically this
    // must NOT depend on requestAnimationFrame — rAF is paused in a hidden /
    // backgrounded tab, whereas setTimeout still fires (throttled). In a
    // visible tab we schedule the show on the next paint (no flash, matches
    // the original intent); in a hidden tab we show synchronously so content
    // is never stuck at opacity:0 for a crawler / offscreen reviewer.
    const timeoutId = forceVisible ? window.setTimeout(() => {
      if (document.hidden) {
        forceShown()
      } else {
        window.requestAnimationFrame(forceShown)
      }
    }, 700) : null

    // If the tab was hidden the whole time (rAF/paint paused), reveal the
    // moment it becomes visible.
    const onVisibility = () => {
      if (!document.hidden) forceShown()
    }
    if (forceVisible) document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      if (forceVisible) document.removeEventListener('visibilitychange', onVisibility)
      if (canPointerReveal) window.removeEventListener('pointermove', onPointerMove)
      observer.disconnect()
    }
    // Stable primitive deps: all call sites pass literal options, so these are
    // constant per component and the effect still runs once on mount — but the
    // deps array now keeps a fixed size, so live-editing never desyncs the
    // fiber (no `useLayoutEffect final argument changed size` HMR noise).
  }, [stagger, step, childSelector, forceVisible, pointerReveal])

  return ref
}
