import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useDragControls, useReducedMotion } from 'framer-motion'
import manifest from '../data/type-manifest.json'
import { SKYLIA_TYPE_COPY } from '../data/skylia-type-copy'
import useReveal from './useReveal'
import { openOverlay, closeOverlay } from '../lib/overlayNav'
import prefetchPortraits from '../lib/prefetchPortraits'

const typeByCode = {}
for (const t of manifest.types) typeByCode[t.code] = t

// Fixed 01–08 order (content-spec §2.2). We NEVER render in the manifest array
// order — it is a CAD-first alpha sort, the exact disorder F5 complained about.
// Rows read as a 2×4 matrix: columns share emotion×rhythm, the two rows differ
// only in the first axis (L 主导 / C 陪伴).
const ORDER = ['LAS', 'LAD', 'LBS', 'LBD', 'CAS', 'CAD', 'CBS', 'CBD']

// Matrix column headers (lg) — the emotion×rhythm sub-cell each column shares.
const COLUMN_LABELS = ['想靠近 · 稳定', '想靠近 · 新鲜', '先退一步 · 稳定', '先退一步 · 新鲜']

const SPRING_FIRM = { type: 'spring', stiffness: 260, damping: 30, mass: 1 }
const EASE_IN_OUT_QUART = [0.76, 0, 0.24, 1]

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Three-axis tendency mini-viz (§4.3 / content-spec §5.2). Static diagram (no
// knob) — the modal echo of the instrument. The active pole is decoded from the
// three letters: L/A/S → left, C/B/D → right.
function AxisTendency({ code }) {
  return (
    <div className="space-y-3">
      {manifest.axes.map((axis, i) => {
        const leftActive = code[i] === axis.letters[0]
        return (
          <div key={axis.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-caption">
            <span className="w-full text-[color:var(--color-text-2)] sm:w-24 sm:flex-none">{axis.label}</span>
            <span className={`pole-tag ${leftActive ? 'is-active' : ''}`}>{axis.poles[0]}</span>
            <span className="axis-mini">
              <span className="rule-brass !absolute inset-0" />
              <span className={`axis-mini__half ${leftActive ? 'is-left' : 'is-right'}`} />
            </span>
            <span className={`pole-tag ${!leftActive ? 'is-active' : ''}`}>{axis.poles[1]}</span>
          </div>
        )
      })}
    </div>
  )
}

function MatchChips({ codes, onSwitch }) {
  return (
    <div className="flex flex-wrap gap-2">
      {codes.map((c) => {
        const match = typeByCode[c]
        return (
          <button
            key={c}
            type="button"
            data-chip-code={c}
            onClick={() => onSwitch(c)}
            aria-label={`查看 ${match ? match.publicName : c}`}
            className="modal-chip"
          >
            <span className="font-type text-[color:var(--color-text)]" style={{ fontSize: '0.9375rem' }}>
              {c}
            </span>
            {match ? <span className="text-caption text-[color:var(--color-text-2)]">{match.publicName}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

function TypeDetail({ code, onClose, onSwitch }) {
  const reduced = useReducedMotion()
  const isLg = useMediaQuery('(min-width: 1024px)')
  const isSheet = useMediaQuery('(max-width: 767px)')

  const dialogRef = useRef(null)
  const closeBtnRef = useRef(null)
  const firstRender = useRef(true)
  const measureRef = useRef(null)
  const heightAnim = useRef(null)
  // Sheet pull-to-dismiss: drag starts only from the grab-handle strip so the
  // scrolling body keeps normal touch behavior.
  const dragControls = useDragControls()

  const type = typeByCode[code]
  const copy = SKYLIA_TYPE_COPY[code]
  const titleId = 'type-detail-title'

  // Open-frame diet: the mount frame only carries the header (grab-handle +
  // portrait row + title); the heavy body blocks mount one rAF later — they
  // all sit below the fold, so the deferral is invisible but takes the big
  // reconcile+layout off the same frame as the open spring (iPhone open jank).
  // `ready` tracks the dialog's MOUNT lifecycle only — chip switches change
  // `code` without remounting TypeDetail, so they never re-run this gate.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Pop-over (non-sheet) panel height glides between chip switches instead of
  // snapping 20–30px in one frame mid-crossfade. The spring writes
  // panel.style.height per frame — sanctioned by the craft-bar veto-16
  // exemption for overlay containers (fixed, outside the scroll flow, zero
  // document reflow, 0 longtasks measured; see craft-bar 一票否决 16, g4v2-r2
  // ruling). Two halves:
  // 1) the moment `code` changes, LOCK the panel at its current pixel height
  //    (layout effect = before the next paint), so the content swap can never
  //    flash the new height;
  // 2) a ResizeObserver on the content wrapper then springs the locked height
  //    to the new value and hands control back (height:'').
  useLayoutEffect(() => {
    if (firstRender.current || isSheet || reduced) return
    const panel = dialogRef.current
    if (!panel) return
    if (!panel.style.height) panel.style.height = `${panel.getBoundingClientRect().height}px`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])
  useEffect(() => {
    if (isSheet) return undefined
    const panel = dialogRef.current
    const inner = measureRef.current
    if (!panel || !inner) return undefined
    let last = inner.offsetHeight
    const ro = new ResizeObserver(() => {
      const next = inner.offsetHeight
      if (!next || next === last) return
      const from = panel.getBoundingClientRect().height
      last = next
      if (reduced) return
      heightAnim.current?.stop()
      panel.style.height = `${from}px`
      heightAnim.current = animate(from, Math.min(next, window.innerHeight * 0.86), {
        type: 'spring',
        stiffness: 320,
        damping: 36,
        onUpdate: (v) => {
          panel.style.height = `${v}px`
        },
        onComplete: () => {
          panel.style.height = ''
        },
      })
    })
    ro.observe(inner)
    return () => {
      ro.disconnect()
      heightAnim.current?.stop()
      panel.style.height = ''
    }
  }, [isSheet, reduced])

  // Focus, trap, Esc, scroll-lock + scrollbar-pad (restore on close).
  useEffect(() => {
    closeBtnRef.current?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    // Scroll-lock is owned centrally by overlayNav (position:fixed — the only
    // lock iOS Safari honours; body.overflow:hidden leaked touch scroll).
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  // On chip switch (not first open), keep focus inside the panel.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    dialogRef.current?.focus()
  }, [code])

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
    : isSheet
      ? {
          initial: { y: '100%' },
          animate: { y: 0, transition: { type: 'spring', stiffness: 300, damping: 32 } },
          exit: { y: '100%', transition: { duration: 0.26, ease: EASE_IN_OUT_QUART } },
        }
      : {
          initial: { opacity: 0, y: 24, scale: 0.965 },
          animate: { opacity: 1, y: 0, scale: 1, transition: SPRING_FIRM },
          exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.22, ease: EASE_IN_OUT_QUART } },
        }

  const bodyVariants = {
    initial: { opacity: 0 },
    enter: {
      opacity: 1,
      transition: { when: 'beforeChildren', staggerChildren: reduced ? 0 : 0.05, duration: reduced ? 0.12 : 0.2 },
    },
    exit: { opacity: 0, transition: { duration: reduced ? 0.1 : 0.14 } },
  }
  const item = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
    enter: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
  }

  // Saturation-baked *s variants — the CSS saturate() on .card-well img is
  // gone, so card-well images MUST come from /ip/{320s,512s,1024s}/.
  const portrait = (size) => {
    const c = code.toLowerCase()
    return (
      <div className={`card-well ${size}`} data-code={c}>
        <img
          src={`/ip/512s/${c}.webp`}
          srcSet={`/ip/320s/${c}.webp 320w, /ip/512s/${c}.webp 512w, /ip/1024s/${c}.webp 1024w`}
          sizes="(min-width:1024px) 320px, (min-width:768px) 128px, 96px"
          alt={`${type.publicName} · ${code}`}
          width="1024"
          height="1024"
          decoding="async"
          className="h-full w-full max-w-full object-cover"
        />
      </div>
    )
  }

  const strengths = (
    <div>
      <h4 className="text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">情感优势</h4>
      <ul className="mt-3 space-y-2.5">
        {copy.strengths.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-caption leading-relaxed text-[color:var(--color-text-2)]">
            <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[color:var(--color-text-3)]" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  const chips = (
    <div>
      <h4 className="text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">较适合的配对</h4>
      <div className="mt-3">
        <MatchChips codes={copy.bestMatches} onSwitch={onSwitch} />
      </div>
    </div>
  )

  // Quiet conversion exit (content-spec §5.6 / g4v2-r2 D7): the modal is the
  // deepest engagement moment on the site — it closes with a low-key test CTA
  // instead of dead-ending back into the gallery. Deliberately a text-level
  // link (not btn-cta) so it never fights the chips for weight.
  const testCta = (
    <div className="border-t border-[color:var(--color-line)] pt-5">
      <a
        href="/type/start"
        className="group/cta inline-flex min-h-11 items-center gap-1.5 text-caption font-medium text-[color:var(--color-accent)] transition-colors hover:text-[color:var(--color-text)]"
      >
        测测你是不是这一型
        <span aria-hidden="true" className="transition-transform duration-300 group-hover/cta:translate-x-1">→</span>
      </a>
    </div>
  )

  return (
    <motion.div
      variants={overlayVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`fixed inset-0 z-[100] flex px-0 sm:px-4 ${
        isSheet ? 'items-end' : 'items-center justify-center sm:py-8'
      }`}
      style={{
        // §3 modal scrim — neutral pure-colour dim, no blur (mobile craft rule).
        background: 'rgba(20,19,15,0.35)',
        // Touch兜底 for the ~350ms window before overlayNav's deferred scroll
        // lock lands: touches landing on the scrim (or non-scrolling panel
        // chrome) must not pan/rubber-band the page behind. Does NOT affect
        // the inner overflow-y-auto scroller — touch-action only intersects
        // up to the nearest scrolling element.
        touchAction: 'none',
        overscrollBehavior: 'contain',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-active-code={code}
        tabIndex={-1}
        variants={panelVariants}
        {...(isSheet
          ? {
              // Pull-down-to-dismiss: 1:1 follow below the rest point, spring
              // back under threshold, close past 140px or a fast fling.
              // transform-only (drag drives `y`), so iron-rule 16 holds.
              drag: 'y',
              dragControls,
              dragListener: false,
              dragConstraints: { top: 0, bottom: 0 },
              dragElastic: { top: 0, bottom: 1 },
              dragMomentum: false,
              onDragEnd: (_, info) => {
                if (info.offset.y > 140 || info.velocity.y > 600) onClose()
              },
            }
          : {})}
        className={`modal-panel relative z-[101] w-full overflow-hidden focus:outline-none ${
          isSheet
            ? 'max-h-[94svh] rounded-t-3xl'
            : 'max-h-[86vh] rounded-3xl sm:max-w-[640px] lg:max-w-[880px]'
        }`}
      >
        {isSheet && (
          <div
            className="flex min-h-11 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <span className="sheet-handle" />
          </div>
        )}

        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="关闭详情"
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-line)] text-lg text-[color:var(--color-text-2)] transition-colors hover:border-[color:var(--color-line-2)] hover:text-[color:var(--color-text)]"
        >
          ×
        </button>

        <div ref={measureRef}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={code} variants={bodyVariants} initial="initial" animate="enter" exit="exit">
            {isLg ? (
              /* ≥1024 — double column: portrait pillar + scrolling content. */
              <div className="grid grid-cols-[320px_1fr]">
                <motion.div variants={item} className="flex flex-col border-r border-[color:var(--color-line)] p-7">
                  {portrait('aspect-square w-full')}
                  <p className="font-type mt-4 text-[color:var(--color-text)]" style={{ fontSize: '2.5rem' }}>
                    {code}
                  </p>
                  <p className="mt-1 text-pretty text-caption text-[color:var(--color-text-2)]">{copy.enTagline}</p>
                  {/* Letter decode — one quiet row per axis letter. Fills the
                      pillar's lower half (was a dead zone) with the code's own
                      meaning; the right column keeps the full gauge diagram. */}
                  <div className="mt-5 space-y-3">
                    {manifest.axes.map((axis, i) => (
                      <div key={axis.id} className="flex items-baseline gap-2.5 text-caption">
                        <span className="font-type text-[0.9375rem] leading-none text-[color:var(--color-text)]">{code[i]}</span>
                        <span className="text-[color:var(--color-text)]">
                          {code[i] === axis.letters[0] ? axis.poles[0] : axis.poles[1]}
                        </span>
                        <span className="ml-auto text-right text-[color:var(--color-text-2)]">{axis.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
                <div className="max-h-[86vh] overflow-y-auto p-7 pr-8">
                  <motion.h3
                    variants={item}
                    id={titleId}
                    className="font-cjk-display text-h2 text-[color:var(--color-text)]"
                  >
                    {type.publicName}
                  </motion.h3>
                  {ready && (
                    <>
                      <motion.div variants={item} className="mt-5">
                        <AxisTendency code={code} />
                      </motion.div>
                      <hr className="rule-brass my-6" />
                      <motion.p variants={item} className="text-body text-[color:var(--color-text-2)]">
                        {copy.description}
                      </motion.p>
                      <motion.div variants={item} className="mt-6">
                        {strengths}
                      </motion.div>
                      <motion.div variants={item} className="mt-6">
                        {chips}
                      </motion.div>
                      <motion.div variants={item} className="mt-6">
                        {testCta}
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* <1024 — single column (sheet on <768 / centered 640 on 768).
                 Sheet scroller height derives from the SAME unit as the shell
                 (92svh − 44px handle − 2px border): the old 86vh scroller vs
                 92svh shell mismatch cut ~159px off the bottom on real iPhone
                 Safari, where vh reads the LARGE viewport (g4v2-r2 D12). */
              <div
                className={`overflow-y-auto p-6 pt-8 sm:p-7 ${
                  isSheet ? 'max-h-[calc(92svh-46px)]' : 'max-h-[86vh]'
                }`}
              >
                <motion.div variants={item} className="flex items-center gap-4">
                  {portrait(isSheet ? 'h-24 w-24 flex-none' : 'h-32 w-32 flex-none')}
                  <div>
                    <p className="font-type text-2xl tracking-wide text-[color:var(--color-text)]">{code}</p>
                    <h3 id={titleId} className="font-cjk-display mt-1 text-h3 text-[color:var(--color-text)]">
                      {type.publicName}
                    </h3>
                  </div>
                </motion.div>
                {ready && (
                  <>
                    <motion.div variants={item} className="mt-6">
                      <AxisTendency code={code} />
                    </motion.div>
                    <hr className="rule-brass my-6" />
                    <motion.p variants={item} className="text-body text-[color:var(--color-text-2)]">
                      {copy.description}
                    </motion.p>
                    <motion.div variants={item} className="mt-6">
                      {strengths}
                    </motion.div>
                    <motion.div variants={item} className="mt-6">
                      {chips}
                    </motion.div>
                    <motion.div variants={item} className="mt-6">
                      {testCta}
                    </motion.div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

// memo + a stable `onOpen(code, el)` from the parent: setActiveCode, modal
// open/close and chip switches re-render the gallery, but the 8 cards must
// reconcile ZERO times (every card prop is referentially stable).
const TypeCard = memo(function TypeCard({ type, copy, index, onOpen }) {
  const idx = String(index + 1).padStart(2, '0')
  const c = type.code.toLowerCase()

  return (
    <button
      type="button"
      data-reveal-item
      onClick={(e) => onOpen(type.code, e.currentTarget)}
      className="type-card reveal-item group"
      aria-label={`${type.publicName} · ${type.code}，查看详情`}
    >
      {/* Compact vertical tile at every width (4-across on mobile). */}
      <div className="flex flex-col">
        {/* Image well — uniform treatment, flush corners clipped by the card. */}
        <div
          className="card-well relative aspect-square w-full"
          style={{ '--well-radius': '0px' }}
          data-code={c}
        >
          <img
            src={`/ip/512s/${c}.webp`}
            srcSet={`/ip/320s/${c}.webp 320w, /ip/512s/${c}.webp 512w, /ip/1024s/${c}.webp 1024w`}
            sizes="(min-width:1024px) 254px, (min-width:640px) 45vw, 22vw"
            alt={`${type.publicName} · ${type.code}`}
            loading="lazy"
            decoding="async"
            width="1024"
            height="1024"
            className="type-card__img h-full w-full max-w-full object-cover"
          />
          <span className="tnum absolute left-2 top-1.5 z-10 text-[0.7rem] font-semibold text-[color:var(--color-text)] sm:left-3 sm:top-2.5 sm:text-caption">
            {idx}
          </span>
          {/* (Removed the 3-diamond axis fingerprint — decorative noise; the
              code + name already identify the type. 「不要花花」.) */}
        </div>

        {/* Body — horizontal card content column on mobile (code/name/traits/
            action all visible, aesthetic §3.7), full vertical tile ≥ sm. */}
        {/* Compact tile on mobile (code + tiny name); full card ≥ sm. */}
        <div className="type-card__body flex flex-1 flex-col p-2 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-type text-[1.05rem] tracking-wide text-[color:var(--color-text)] sm:text-[1.75rem]">
              {type.code}
            </p>
            <span className="hidden text-eyebrow font-medium uppercase text-[color:var(--color-text-3)] sm:inline">
              SkylyaType
            </span>
          </div>

          <h3 className="font-cjk-display mt-0.5 truncate text-[0.72rem] leading-tight text-[color:var(--color-text)] sm:mt-2.5 sm:text-[1.375rem]">
            {type.publicName}
          </h3>

          <p className="mt-2 hidden line-clamp-1 text-caption text-[color:var(--color-text-2)] sm:mt-2 sm:line-clamp-2 sm:block">
            {copy.traits.slice(0, 2).join(' · ')}
          </p>

          <span className="type-card__action mt-auto hidden items-center gap-1.5 pt-4 text-caption font-medium sm:flex">
            查看这一型
            <span className="type-card__arrow">→</span>
          </span>
        </div>
      </div>
    </button>
  )
})

function FamilyHeader({ name, en, note }) {
  return (
    <div className="family-head col-span-full flex items-center gap-3 py-1.5 sm:py-4 lg:sticky lg:top-16 lg:z-40 lg:-mx-1 lg:rounded-b-lg lg:bg-[color:var(--color-bg)] lg:px-1">
      <span className="font-cjk-display whitespace-nowrap text-[color:var(--color-text)]" style={{ fontSize: '1.125rem' }}>
        {name} <span className="font-type text-caption tracking-wide text-[color:var(--color-text-2)]">· {en}</span>
      </span>
      <span className="hidden whitespace-nowrap text-caption text-[color:var(--color-text-2)] sm:inline">{note}</span>
      {/* Bottom-edge hairline — a clean ledge under the sticky family header. */}
      <hr className="rule-brass absolute inset-x-0 bottom-0" />
    </div>
  )
}

export default function TypeGallery() {
  const ref = useReveal({ stagger: true, step: 70 })
  const [activeCode, setActiveCode] = useState(null)
  const triggerRef = useRef(null)

  // Shared prefetch entry (once/load-quiet/serial decode handled inside):
  // warms the SMALL 512s set so a modal open never decodes mid-spring.
  useEffect(() => {
    prefetchPortraits(ORDER.map((code) => `/ip/512s/${code.toLowerCase()}.webp`))
  }, [])

  // History-guarded via the SHARED overlay stack (overlayNav): system Back /
  // iPhone edge-swipe closes the modal instead of leaving the site, and a
  // TestIntro hand-off (closeAllOverlays) closes this too so it never strands.
  const modalOpen = activeCode != null
  useEffect(() => {
    if (!modalOpen) return undefined
    const close = () => {
      setActiveCode(null)
      triggerRef.current?.focus()
    }
    openOverlay(close)
    return () => closeOverlay(close)
  }, [modalOpen])

  const openType = useCallback((code, triggerEl) => {
    triggerRef.current = triggerEl || null
    setActiveCode(code)
  }, [])

  const closeType = useCallback(() => {
    setActiveCode(null)
    triggerRef.current?.focus()
  }, [])

  // Instrument's preview cluster opens the same modal via a decoupled event.
  useEffect(() => {
    const handler = (e) => {
      const { code, trigger } = e.detail || {}
      if (code && typeByCode[code]) openType(code, trigger)
    }
    window.addEventListener('skylya:opentype', handler)
    return () => window.removeEventListener('skylya:opentype', handler)
  }, [openType])

  const lead = ORDER.slice(0, 4)
  const companion = ORDER.slice(4)

  const renderCard = (code, i) => (
    <TypeCard
      key={code}
      type={typeByCode[code]}
      copy={SKYLIA_TYPE_COPY[code]}
      index={i}
      onOpen={openType}
    />
  )

  return (
    <section id="gallery" ref={ref} className="snap-space reveal relative mx-auto max-w-6xl px-5 pb-10 pt-20 sm:px-8 sm:py-28">
      {/* Section nameplate 01 */}
      <div className="flex flex-col gap-3 sm:gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2.5">
            <span className="tnum text-caption text-[color:var(--color-text-2)]">01</span>
            <span className="text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">8 型人格画廊</span>
          </div>
          <h2 className="font-cjk-display mt-2 text-balance text-[1.4rem] text-[color:var(--color-text)] sm:mt-4 sm:text-h2">
            八种人，八种在关系里的样子
          </h2>
        </div>
        <p className="hidden max-w-sm text-body text-[color:var(--color-text-2)] sm:block">
          SkylyaType 用三条关系轴，描出八种在亲密关系里的样子。点开任意一张，看看这一型的模样，以及最合拍的对象。
        </p>
      </div>

      {/* Mobile = single-column horizontal cards (aesthetic §3.7): the 4-across
          tiles shrank each IP to an ~85px thumbnail with code+name crushed
          together. One column lets the well breathe (38%) and the content
          column carry code/name/traits/action at readable size. ≥sm returns to
          the 2/4-col vertical tile matrix. */}
      {/* 4-across so each family = ONE scannable row and the 4+4 two-faction
          split reads at a glance in one screen (user-locked structure; the
          aesthetic loop wrongly reverted this to single-column big cards). */}
      <div className="mt-4 grid grid-cols-4 gap-2 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {/* L family header */}
        <FamilyHeader
          name="L 主动推进型"
          en="Lead"
          note="更常主动联系、安排见面、推动关系向前的四型"
        />

        {/* Matrix column labels (lg only) */}
        <div className="col-span-full hidden grid-cols-4 gap-6 lg:grid">
          {COLUMN_LABELS.map((label) => (
            <p
              key={label}
              className="border-b border-[color:var(--color-line)] pb-2 text-center text-caption text-[color:var(--color-text-2)]"
            >
              {label}
            </p>
          ))}
        </div>

        {lead.map((code, i) => renderCard(code, i))}

        {/* Teaching band — the ONLY divider: teaches the first axis, between
            04 (LBD) and 05 (CAS). */}
        <div className="teach-wrap col-span-full py-2 sm:py-4">
          <div className="teach-band flex flex-col items-center gap-2 rounded-xl bg-[color:var(--color-surface-2)] px-4 py-4 text-center sm:gap-6 sm:px-5 sm:py-14">
            <p
              className="reveal-item text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]"
              style={{ '--reveal-delay': '90ms' }}
            >
              谁更主动 · 三条关系轴之一
            </p>
            <p
              className="reveal-item font-cjk-display max-w-2xl text-balance text-[1rem] leading-snug text-[color:var(--color-text)] sm:text-h3"
              style={{ '--reveal-delay': '180ms' }}
            >
              有些人喜欢把关系往前推，有些人更习惯顺着彼此的节奏来。这条轴，看的是你在关系里通常有多主动。
            </p>
            {/* Static axis diagram — no knob, no cursor (not a control). */}
            <div
              className="reveal-item mx-auto flex w-full max-w-[240px] items-center justify-between gap-3"
              style={{ '--reveal-delay': '270ms' }}
            >
              <span className="flex items-center gap-1.5 text-caption text-[color:var(--color-text-2)]">
                <span className="font-type text-[color:var(--color-text)]">L</span>主动
              </span>
              <span className="relative h-px flex-1">
                <span className="rule-brass rule-brass--capped !absolute inset-0" />
              </span>
              <span className="flex items-center gap-1.5 text-caption text-[color:var(--color-text-2)]">
                顺着来<span className="font-type text-[color:var(--color-text)]">C</span>
              </span>
            </div>
            <p
              className="teach-note reveal-item max-w-md text-caption text-[color:var(--color-text-2)]"
              style={{ '--reveal-delay': '360ms' }}
            >
              主动不等于管着对方，顺着来也不等于没想法——只是两种不同的相处方式。
            </p>
          </div>
        </div>

        {/* C family header */}
        <FamilyHeader
          name="C 顺着相处型"
          en="Companion"
          note="更常观察对方、配合节奏、让关系慢慢自然发生的四型"
        />

        {companion.map((code, i) => renderCard(code, i + 4))}
      </div>

      {/* Space cue — quiet chevron cascade into the instrument (mobile). */}
      <a href="#instrument" aria-label="向下 · 怎么测" className="space-cue lg:hidden">
        <span className="cue-chevron top-0" />
        <span className="cue-chevron top-2.5" style={{ animationDelay: '260ms' }} />
      </a>

      <AnimatePresence>
        {activeCode && (
          <TypeDetail key="type-dialog" code={activeCode} onClose={closeType} onSwitch={setActiveCode} />
        )}
      </AnimatePresence>
    </section>
  )
}
