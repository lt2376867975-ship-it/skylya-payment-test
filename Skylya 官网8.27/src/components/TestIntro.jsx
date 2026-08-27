import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import manifest from '../data/type-manifest.json'

const SPRING_FIRM = { type: 'spring', stiffness: 260, damping: 30, mass: 1 }
const EASE_IN_OUT_QUART = [0.76, 0, 0.24, 1]

// 「开始测试」lands here instead of doing a full-document navigation to the
// placeholder /type/start route. The old <a href="/type/start"> triggered a
// hard reload (no router) that re-served index.html and bounced the visitor to
// the hero top — the site's single conversion target had zero reachable path
// (craft-bar veto §9 dead control). This is a real, designed transition: it
// frames the test, then hands off to a LIVE in-app destination (the three-axis
// instrument the visitor can actually play with today) — no reload, no bounce.
export default function TestIntro({ open, onDismiss }) {
  const reduced = useReducedMotion()
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  // Skip focus-restore when we hand off to a section (restoring focus to the
  // off-screen opener would scroll it back into view and undo the hand-off).
  const handedOff = useRef(false)

  useEffect(() => {
    if (!open) return undefined
    handedOff.current = false
    const prevFocus = document.activeElement
    closeRef.current?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onDismiss()
        return
      }
      if (e.key === 'Tab') {
        const f = panelRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!f || f.length === 0) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    // Scroll-lock owned centrally by overlayNav (position:fixed iOS lock).
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Return focus to the opener (WCAG 2.4.3) — but not on hand-off, and
      // never scroll it into view.
      if (!handedOff.current && prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) {
        prevFocus.focus({ preventScroll: true })
      }
    }
  }, [open, onDismiss])

  const overlayVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: reduced ? 0.15 : 0.28 } },
    exit: { opacity: 0, transition: { duration: reduced ? 0.12 : 0.26 } },
  }
  const panelVariants = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      }
    : {
        initial: { opacity: 0, y: 24, scale: 0.965 },
        animate: { opacity: 1, y: 0, scale: 1, transition: SPRING_FIRM },
        exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.22, ease: EASE_IN_OUT_QUART } },
      }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="test-intro"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          // Neutral ink scrim (iron rule: no blur on the scrim on mobile);
          // the desktop static overlay may still frost (lg:backdrop-blur-md).
          // touch-none + overscroll-contain: the body scroll lock is deferred
          // ~350ms past the entrance spring (see overlayNav), so during that
          // window the scrim itself must swallow pans on the background. The
          // panel is its own scroll container, so its internal scrolling is
          // unaffected by the scrim's touch-action.
          className="touch-none overscroll-contain fixed inset-0 z-[110] flex items-center justify-center px-4 py-8 lg:backdrop-blur-md"
          style={{ background: 'rgba(22,21,15,0.35)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onDismiss()
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-intro-title"
            variants={panelVariants}
            className="modal-panel overscroll-contain relative z-[111] max-h-[calc(100svh-4rem)] w-full max-w-[540px] overflow-y-auto rounded-3xl p-6 sm:p-9"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onDismiss}
              aria-label="关闭"
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-line)] text-lg text-[color:var(--color-text-2)] transition-colors hover:border-[color:var(--color-text)] hover:text-[color:var(--color-text)]"
            >
              ×
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">SkylyaType 测试</span>
            </div>
            <h2
              id="test-intro-title"
              className="font-cjk-display mt-3 text-balance text-h3 text-[color:var(--color-text)] sm:text-h2"
            >
              完整测试即将上线
            </h2>
            <p className="mt-3 max-w-md text-body text-[color:var(--color-text-2)]">
              <span className="tnum">12</span> 道情境题的正式版本正在打磨中。在它上线之前，你可以先用三条关系轴，试试看自己更像哪一种相处方式。
            </p>

            <hr className="rule-brass my-6" />

            <p className="text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">测试会看这三件事</p>
            <div className="mt-3 space-y-2.5">
              {manifest.axes.map((axis) => (
                <div key={axis.id} className="flex items-center gap-x-3 gap-y-1 text-caption">
                  <span className="w-24 flex-none text-[color:var(--color-text)]">{axis.label}</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[color:var(--color-text-2)]">
                    <span className="font-type text-[color:var(--color-text)]">{axis.letters[0]}</span>
                    {axis.poles[0].split(' ')[0]}
                  </span>
                  <span aria-hidden="true" className="text-[color:var(--color-text-3)]">·</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[color:var(--color-text-2)]">
                    <span className="font-type text-[color:var(--color-text)]">{axis.letters[1]}</span>
                    {axis.poles[1].split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>

            {/* Value anchor — visible on every viewport (the hero/instrument
                copies of this line are lg/sm-only; mobile visitors never saw
                the time cost + shareable payoff, round-4 med). */}
            <p className="mt-6 text-caption text-[color:var(--color-text-2)]">
              约 <span className="tnum">3</span> 分钟 · 一张可分享的人格名片
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  handedOff.current = true
                  onDismiss('instrument')
                }}
                className="btn btn-cta btn-lg"
              >
                先试试看
                <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handedOff.current = true
                  onDismiss('gallery')
                }}
                className="btn btn-ghost-cream btn-sm focus-cream"
              >
                看看 8 种人格
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
