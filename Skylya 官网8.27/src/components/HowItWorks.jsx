// Instrument (§4.4) — the site's mechanical heart. Three brass-knob axes, each
// truly draggable (PointerCapture) + touch (touch-action:none) + keyboard
// (role="slider", arrows/Page/Home/End), with a midpoint detent so a knob never
// rests on the divide. A live preview cluster resolves the current 2×2×2 combo
// into its type (letter tumbler + portrait crossfade + publicName) mapped exactly
// per content-spec §6. A startup sweep self-checks each knob on first reveal
// (interruptible; skipped under reduced-motion). framer-motion is used ONLY here
// and in TypeGallery (design-spec §3.6).
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import manifest from '../data/type-manifest.json'
import { SKYLIA_TYPE_COPY } from '../data/skylia-type-copy'
import prefetchPortraits from '../lib/prefetchPortraits'
import useReveal from './useReveal'
import { ipPortrait } from '../lib/ipPortraits'

const typeByCode = {}
for (const t of manifest.types) typeByCode[t.code] = t

// One-line axis explainers (content-spec §6.1), keyed by manifest axis id.
const AXIS_LINE = {
  position: '你更常牵引关系的方向，还是托住彼此的节奏？',
  emotion: '情绪起伏时，你是稳住局面的锚，还是化解张力的缓冲？',
  rhythm: '你偏爱可预期的稳定，还是新鲜流动的变化？',
}

// Double-buffered preview portrait (review R7 #5). Keeps up to two stacked
// layers: the previous image stays fully opaque as the base while the newest
// fades in on top (CSS .preview-portrait), then collapses to one on animation
// end. A rapid startup sweep therefore never strands an empty well.
// Sources are the baked-saturation variants (/ip/512s|1024s) — the card-well
// CSS saturate() filter is retired, so the well must ship pre-graded pixels,
// and srcset lets the mobile strip (96px slot) decode the small file.
function PreviewPortrait({ code, publicName, className }) {
  const idRef = useRef(0)
  const [layers, setLayers] = useState(() => [{ id: 0, code }])

  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1]
      if (top.code === code) return prev
      idRef.current += 1
      return [...prev, { id: idRef.current, code }].slice(-2)
    })
  }, [code])

  const collapse = () =>
    setLayers((prev) => (prev.length > 1 ? prev.slice(-1) : prev))

  return (
    <div
      className={`card-well relative aspect-square ${className ?? 'mx-auto mt-6 w-full max-w-[15rem]'}`}
      data-code={code.toLowerCase()}
    >
      {layers.map((layer, i) => {
        const isTop = i === layers.length - 1
        return (
          <img
            key={layer.id}
            src={ipPortrait(layer.code)}
            alt={isTop ? `${publicName} · ${layer.code}` : ''}
            aria-hidden={isTop ? undefined : true}
            width="1024"
            height="1024"
            className="preview-portrait absolute inset-0 h-full w-full max-w-full object-cover"
            style={isTop ? undefined : { opacity: 1, animation: 'none' }}
            onAnimationEnd={isTop ? collapse : undefined}
          />
        )
      })}
    </div>
  )
}

// Default knob positions → initial preview CAS. v < 50 → left pole (L/A/S);
// ≥ 50 → right pole (C/B/D).
const DEFAULTS = [68, 36, 32]

// 21-mark tick scale (5% apart); majors at 0/25/50/75/100, midpoint marker at 50.
const TICKS = Array.from({ length: 21 }, (_, i) => {
  const pos = i * 5
  const cls =
    pos === 50
      ? 'gauge-tick gauge-tick--mid'
      : pos % 25 === 0
        ? 'gauge-tick gauge-tick--major'
        : 'gauge-tick'
  return { pos, cls }
})

const clamp = (n) => Math.max(0, Math.min(100, n))

const SPRING_FIRM = { type: 'spring', stiffness: 260, damping: 30, mass: 1 }
const SPRING_NEEDLE = { type: 'spring', stiffness: 170, damping: 22, mass: 1 }
const DETENT_EASE = [0.25, 1, 0.5, 1]

// ---------------------------------------------------------------------------

// The physical knob moves continuously, but the relationship letter is a
// deliberate commitment: it changes only when a drag is released. That makes
// the interface feel like an instrument, rather than a slot machine while the
// user is still deciding where to land.
const AxisRail = memo(function AxisRail({ axis, index, mv, reduced, idle, sweepingRef, onLetterChange, onInteract, onAnnounce }) {
  const railRef = useRef(null)
  const animRef = useRef(null)
  // Committed logical value — the source of truth for keyboard steps and aria,
  // decoupled from the in-flight spring so rapid presses stay monotonic.
  const valueRef = useRef(DEFAULTS[index])
  const letterRef = useRef(axis.letters[DEFAULTS[index] < 50 ? 0 : 1])
  // Touch gesture whose axis intent is not yet known (see onPointerDown).
  const pendingTouch = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [letter, setLetter] = useState(letterRef.current)
  const [ariaNow, setAriaNow] = useState(DEFAULTS[index])

  const leftLetter = axis.letters[0]
  const rightLetter = axis.letters[1]
  const isLeft = letter === leftLetter

  // Motion-driven visuals (no per-frame React re-render). The knob rides a
  // TRANSFORM (translateX in px, rail width cached by ResizeObserver) — never
  // `left`: animating a layout property per frame is craft-bar veto 16, and
  // every knob move (entrance sweep / drag / detent / keyboard spring) flows
  // through this one path.
  const railW = useMotionValue(0)
  useEffect(() => {
    const el = railRef.current
    if (!el) return undefined
    railW.set(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(() => railW.set(el.getBoundingClientRect().width))
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const knobX = useTransform([mv, railW], ([v, w]) => (v / 100) * w)
  // Two physical fill segments meet at the midpoint. Unlike a committed-pole
  // class, these values follow the motion value itself, so the accent line
  // remains attached to the knob throughout a drag while the letter/card wait
  // for release.
  const fillLeftScale = useTransform(mv, (v) => clamp((50 - v) / 50))
  const fillRightScale = useTransform(mv, (v) => clamp((v - 50) / 50))

  const commitLetter = useCallback((value) => {
    const next = axis.letters[value < 50 ? 0 : 1]
    if (next === letterRef.current) return null
    letterRef.current = next
    setLetter(next)
    onLetterChange(index, next)
    return next
  }, [axis.letters, index, onLetterChange])

  const stopAnim = () => {
    if (animRef.current) {
      animRef.current.stop()
      animRef.current = null
    }
  }

  const seekTo = (target, transition) => {
    stopAnim()
    if (reduced) {
      mv.set(target)
      return
    }
    animRef.current = animate(mv, target, transition)
  }

  const vFromClientX = (clientX) => {
    const r = railRef.current.getBoundingClientRect()
    return clamp(((clientX - r.left) / r.width) * 100)
  }

  const engage = (e, v) => {
    onInteract(index)
    stopAnim()
    try {
      railRef.current.setPointerCapture(e.pointerId)
    } catch {
      /* no-op */
    }
    setDragging(true)
    valueRef.current = v
  }

  const onPointerDown = (e) => {
    // Touch starting on the OPEN rail: axis intent is unknown — a vertical
    // swipe that merely lands here must scroll the page (rail is
    // touch-action:pan-y) and must NOT rewrite the value. Defer capture/seek
    // until the gesture declares horizontal (onPointerMove) or ends as a
    // clean tap (endDrag). Grabbing the knob itself engages immediately.
    if (e.pointerType === 'touch' && !e.target.closest('.gauge-knob')) {
      pendingTouch.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
      return
    }
    // During the entrance self-test the knob is animating across the rail. A
    // first curious tap/grab must lock to the COMMITTED default value, never
    // commit the knob's transient swept pixel position as the user's choice
    // (retro-g4 static-bias → tap-seek race; hunt-3 tapsweep 4/4 repro). Read
    // sweepingRef BEFORE engage(), which stops the sweep.
    const seekV = sweepingRef?.current ? valueRef.current : vFromClientX(e.clientX)
    engage(e, seekV)
    // Tap on empty rail → spring-firm seek; a drag overrides it 1:1 on move.
    seekTo(seekV, SPRING_FIRM)
  }

  const onPointerMove = (e) => {
    const pend = pendingTouch.current
    if (pend && e.pointerId === pend.id) {
      const dx = Math.abs(e.clientX - pend.x)
      const dy = Math.abs(e.clientY - pend.y)
      if (dy > 8 && dy > dx) {
        pendingTouch.current = null // vertical intent → the page scroll owns it
        return
      }
      if (dx >= 6 && dx >= dy) {
        pendingTouch.current = null // horizontal intent → engage 1:1 drag
        engage(e, vFromClientX(e.clientX))
        mv.set(valueRef.current)
      }
      return
    }
    if (!dragging) return
    stopAnim()
    const v = vFromClientX(e.clientX)
    valueRef.current = v
    mv.set(v) // 1:1 direct drive, no easing
  }

  const settle = (v) => {
    // Detent — never rest on the 46–54 divide.
    const target = v >= 46 && v <= 54 ? (v < 50 ? 42 : 58) : v
    valueRef.current = target
    if (target !== v) seekTo(target, { duration: reduced ? 0 : 0.26, ease: DETENT_EASE })
    setAriaNow(Math.round(target))
    onAnnounce(index, commitLetter(target))
  }

  const endDrag = (e) => {
    const pend = pendingTouch.current
    if (pend && e.pointerId === pend.id) {
      pendingTouch.current = null
      // Clean tap (no scroll, no drag) → classic tap-seek; a pointercancel
      // (browser took the gesture for scrolling) changes nothing.
      if (e.type === 'pointerup') {
        // Same sweep guard as onPointerDown: a deferred rail tap released mid
        // self-test locks to the committed default, not the swept pixel.
        const wasSweeping = sweepingRef?.current
        onInteract(index)
        const v = wasSweeping ? valueRef.current : vFromClientX(e.clientX)
        seekTo(v, SPRING_FIRM)
        settle(v)
      }
      return
    }
    if (!dragging) return
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* no-op */
    }
    settle(valueRef.current)
  }

  const onKeyDown = (e) => {
    let delta = 0
    let abs = null
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        delta = 5
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = -5
        break
      case 'PageUp':
        delta = 20
        break
      case 'PageDown':
        delta = -20
        break
      case 'Home':
        abs = 8
        break
      case 'End':
        abs = 92
        break
      default:
        return
    }
    e.preventDefault()
    onInteract(index)
    let target = abs != null ? abs : clamp(valueRef.current + delta)
    // Detent parity across ALL input modalities (g4v2-r2 D9): pointer paths
    // settle() off the 46–54 divide, but keyboard steps could park the knob
    // dead on the midpoint while announcing a pole. Carry the landing
    // through the dead zone in the direction of travel.
    if (target >= 46 && target <= 54) {
      const dir = delta !== 0 ? delta > 0 : target >= 50
      target = dir ? 58 : 42
    }
    valueRef.current = target
    setAriaNow(Math.round(target))
    seekTo(target, SPRING_NEEDLE)
    onAnnounce(index, commitLetter(target))
  }

  useEffect(() => () => stopAnim(), [])

  return (
    <div data-reveal-item data-axis={axis.id} data-pole={letter} className={`reveal-item warm-axis warm-axis--${axis.id}`}>
      {/* Row head: axis name + one-liner (lg) + live current-letter readout. */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">{axis.label}</span>
          <p className="mt-1.5 hidden max-w-xs text-caption text-[color:var(--color-text-2)] lg:block">
            {AXIS_LINE[axis.id]}
          </p>
        </div>
        <span className="axis-letter font-type leading-none text-[color:var(--color-text)]" style={{ fontSize: '1.5rem' }}>
          {letter}
        </span>
      </div>

      {/* Interactive rail. */}
      <div
        ref={railRef}
        className={`gauge-rail mt-2 sm:mt-3 ${dragging ? 'is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="gauge-ticks" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t.pos} className={t.cls} style={{ left: `${t.pos}%` }} />
          ))}
        </div>
        <div className="gauge-groove" aria-hidden="true">
          <motion.div className={`gauge-fill gauge-fill--${axis.id} gauge-fill--left`} style={{ scaleX: fillLeftScale }} />
          <motion.div className={`gauge-fill gauge-fill--${axis.id} gauge-fill--right`} style={{ scaleX: fillRightScale }} />
        </div>
        <motion.button
          type="button"
          role="slider"
          aria-label={axis.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ariaNow}
          aria-valuetext={`${axis.poles[isLeft ? 0 : 1]} ${letter}`}
          aria-orientation="horizontal"
          className={`gauge-knob ${idle ? 'is-idle' : ''}`}
          style={{ x: knobX }}
          onKeyDown={onKeyDown}
          onKeyUp={onAnnounce}
          onFocus={() => onInteract(index)}
        >
          <span className="gauge-knob__face" />
        </motion.button>
      </div>

      {/* One-liner beneath rail — md only (mobile keeps the one-screen budget;
          lg shows it in the row head). */}
      <p className="mt-3 hidden text-caption text-[color:var(--color-text-2)] md:block lg:hidden">{AXIS_LINE[axis.id]}</p>

      {/* Two-pole labels. */}
      <div className="mt-2 flex items-center justify-between sm:mt-3">
        <span className={`pole-label ${isLeft ? 'is-active' : ''}`}>
          {axis.poles[0]}
          <span key={isLeft ? 'on' : 'off'} className="pole-label__letter">
            {leftLetter}
          </span>
        </span>
        <span className={`pole-label ${!isLeft ? 'is-active' : ''}`}>
          {axis.poles[1]}
          <span key={!isLeft ? 'on' : 'off'} className="pole-label__letter">
            {rightLetter}
          </span>
        </span>
      </div>
    </div>
  )
})

const TumblerCell = memo(function TumblerCell({ letter, reduced, mini = false }) {
  return (
    <div className={`tumbler-cell ${mini ? 'tumbler-cell--mini' : ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={letter}
          className="tumbler-cell__letter"
          initial={reduced ? { opacity: 0 } : { rotateX: 90, opacity: 0 }}
          animate={
            reduced
              ? { opacity: 1, transition: { duration: 0.12 } }
              : { rotateX: 0, opacity: 1, transition: { duration: 0.14 } }
          }
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { rotateX: -90, opacity: 0, transition: { duration: 0.1 } }
          }
        >
          {letter}
        </motion.span>
      </AnimatePresence>
    </div>
  )
})

function LivingTypeCard({ letters, reduced, onOpenType }) {
  const companion = letters[0] === 'C'
  const suffix = `${letters[1]}${letters[2]}`
  const currentCode = `${letters[0]}${suffix}`
  const currentType = typeByCode[currentCode]
  const currentCopy = SKYLIA_TYPE_COPY[currentCode]
  const hoverTimer = useRef(null)
  const [hearts, setHearts] = useState([])

  const addHeart = useCallback(() => {
    const id = `${Date.now()}-${Math.random()}`
    setHearts((current) => [
      ...current.slice(-5),
      {
        id,
        x: 18 + Math.random() * 64,
        y: 18 + Math.random() * 22,
        drift: -10 + Math.random() * 20,
        scale: 0.82 + Math.random() * 0.28,
      },
    ])
  }, [])

  const removeHeart = useCallback((id) => {
    setHearts((current) => current.filter((heart) => heart.id !== id))
  }, [])

  const startHeartHover = useCallback(() => {
    if (reduced || hoverTimer.current) return
    addHeart()
    hoverTimer.current = window.setInterval(addHeart, 360)
  }, [addHeart, reduced])

  const stopHeartHover = useCallback(() => {
    if (!hoverTimer.current) return
    window.clearInterval(hoverTimer.current)
    hoverTimer.current = null
  }, [])

  useEffect(() => stopHeartHover, [stopHeartHover])

  const face = (code, world) => {
    const type = typeByCode[code]
    const copy = SKYLIA_TYPE_COPY[code]
    return (
      <motion.div
        key={code}
        data-testid="preview-face"
        data-code={code}
        className={`living-card__face living-card__face--${world}`}
        initial={reduced ? { opacity: 0 } : { rotateY: 84, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { rotateY: -84, opacity: 0 }}
        transition={{ duration: reduced ? 0.12 : 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="living-card__topline"><span>{world === 'lead' ? 'LEAD' : 'COMPANION'}</span><b>{code}</b></div>
        <PreviewPortrait code={code} publicName={type.publicName} className="living-card__portrait" />
        <div className="living-card__copy"><strong>{type.publicName}</strong><span>{copy.traits.slice(0, 2).join(' · ')}</span></div>
      </motion.div>
    )
  }

  return (
    <div
      className={`living-card ${companion ? 'is-companion' : 'is-lead'} ${reduced ? 'is-reduced' : ''}`}
      data-testid="living-type-card"
      data-code={currentCode}
      onPointerEnter={startHeartHover}
      onPointerLeave={stopHeartHover}
      onBlur={stopHeartHover}
    >
      <div className="living-card__ambient" aria-hidden="true" />
      <div className="living-card__inner">
        <AnimatePresence mode="wait" initial={false}>
          {face(currentCode, companion ? 'companion' : 'lead')}
        </AnimatePresence>
      </div>
      <div className="living-card__heart-field" aria-hidden="true">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="living-card__heart"
            style={{
              left: `${heart.x}%`,
              top: `${heart.y}%`,
              '--heart-drift': `${heart.drift}px`,
              '--heart-scale': heart.scale,
            }}
            onAnimationEnd={() => removeHeart(heart.id)}
          >
            ♥
          </span>
        ))}
      </div>
      <div className="living-card__meta">
        <div className="living-card__letters" data-testid="preview-code">
          {letters.map((letter, index) => <TumblerCell key={index} letter={letter} reduced={reduced} mini />)}
        </div>
        <span><b>{currentType.publicName}</b><small>{currentCopy.traits.slice(0, 2).join(' · ')}</small></span>
        <button type="button" onClick={() => onOpenType?.(currentCode)}>完整人格 <i>↗</i></button>
      </div>
    </div>
  )
}

export default function HowItWorks({ embedded = false, onOpenType }) {
  const ref = useReveal({ stagger: true, step: 90 })
  const reduced = useReducedMotion()

  // Three motion values (fixed count → unconditional hooks).
  const mv0 = useMotionValue(DEFAULTS[0])
  const mv1 = useMotionValue(DEFAULTS[1])
  const mv2 = useMotionValue(DEFAULTS[2])
  const mvs = useRef([mv0, mv1, mv2]).current

  const [letters, setLetters] = useState(['C', 'A', 'S'])
  const [idle, setIdle] = useState(false)
  const [announce, setAnnounce] = useState('')
  const sweepingRef = useRef(false)
  const sweepControls = useRef([])
  // True once the user has touched any rail — an armed-but-not-started sweep
  // (waiting for scroll-quiet) must never fire afterwards.
  const interactedRef = useRef(false)

  const code = letters.join('')
  const codeRef = useRef(code)
  codeRef.current = code

  const onLetterChange = useCallback((i, ch) => {
    setLetters((prev) => (prev[i] === ch ? prev : prev.map((c, j) => (j === i ? ch : c))))
  }, [])

  const stopSweep = useCallback((exceptIndex) => {
    const wasSweeping = sweepingRef.current
    sweepingRef.current = false
    sweepControls.current.forEach((c) => c && c.stop && c.stop())
    sweepControls.current = []
    if (!wasSweeping) return
    // Interrupted mid self-test: return every OTHER knob to its committed
    // default so a stopped sweep never strands a knob (and its pole letter) at
    // a transient swept position — the interacted axis (exceptIndex) locks
    // itself to its default in AxisRail. Without this, tapping one knob during
    // the sweep froze the other two at whatever pixel they'd swept to, silently
    // flipping the preview code (hunt-3 tapsweep).
    mvs.forEach((mv, i) => {
      if (i === exceptIndex) return
      if (Math.abs(mv.get() - DEFAULTS[i]) > 0.5) {
        animate(mv, DEFAULTS[i], { duration: reduced ? 0 : 0.24, ease: DETENT_EASE })
      }
    })
  }, [mvs, reduced])

  const handleInteract = useCallback(() => {
    interactedRef.current = true
    stopSweep()
    setIdle(false)
  }, [stopSweep])

  const handleAnnounce = useCallback((changedIndex, nextLetter) => {
    const chars = codeRef.current.split('')
    if (Number.isInteger(changedIndex) && nextLetter) chars[changedIndex] = nextLetter
    const c = chars.join('')
    const t = typeByCode[c]
    if (t) setAnnounce(`${c} · ${t.publicName}`)
  }, [])

  // Preload the 8 preview portraits + run the startup sweep on first reveal.
  useEffect(() => {
    // Prefetch via the shared scroll-quiet module (module-level once — the
    // twin call in TypeGallery is a no-op). Small baked-saturation set only:
    // the old idle new Image()×8 on /ip/1024 decoded 8MP mid-fling on iOS.
    prefetchPortraits(manifest.types.map((t) => ipPortrait(t.code)))

    const section = ref.current
    if (!section || reduced) return undefined

    let done = false
    let quietTimer = 0
    const startSweep = () => {
      window.removeEventListener('scroll', armSweep)
      // The user grabbed a knob while the sweep was still waiting out the
      // scroll — the self-test is theirs now; never replay it.
      if (interactedRef.current) return
      sweepingRef.current = true
      // Restrained affordance nudge (was a full 0.9s×3 sweep to 92 — read as a
      // product demo, and auto-flipped the letters/figure). Each knob drifts
      // +8 and settles back (~420ms, 70ms stagger): says 「I move」 without the
      // interface performing by itself. +8 from the defaults never crosses the
      // midpoint, so letters and preview stay untouched.
      mvs.forEach((mv, i) => {
        window.setTimeout(() => {
          if (!sweepingRef.current) return
          const ctrl = animate(mv, [DEFAULTS[i], DEFAULTS[i] + 8, DEFAULTS[i]], {
            duration: 0.42,
            times: [0, 0.45, 1],
            ease: ['easeOut', 'easeInOut'],
          })
          sweepControls.current.push(ctrl)
          if (i === mvs.length - 1) {
            ctrl.then(() => {
              if (sweepingRef.current) {
                sweepingRef.current = false
                setIdle(true)
              }
            })
          }
        }, i * 70)
      })
    }
    // Arm on scroll-quiet: the IO threshold often trips MID-FLING on iOS, and
    // three springs compositing over an active scroll is the jank the audit
    // flagged. Each scroll event re-arms a 250ms quiet window; the sweep only
    // fires once the page has actually settled.
    const armSweep = () => {
      clearTimeout(quietTimer)
      quietTimer = window.setTimeout(startSweep, 250)
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done) return
        done = true
        io.disconnect()
        window.addEventListener('scroll', armSweep, { passive: true })
        armSweep()
      },
      { threshold: 0.35 }
    )
    io.observe(section)
    return () => {
      clearTimeout(quietTimer)
      window.removeEventListener('scroll', armSweep)
      io.disconnect()
      stopSweep()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  return (
    <section
      id={embedded ? undefined : 'instrument'}
      ref={ref}
      data-world={letters[0] === 'L' ? 'lead' : 'companion'}
      className={`reveal warm-instrument ${embedded ? 'is-embedded' : 'is-standalone'}`}
    >
      <span className="warm-instrument__light warm-instrument__light--lead" aria-hidden="true" />
      <span className="warm-instrument__light warm-instrument__light--companion" aria-hidden="true" />
      <div className="warm-instrument__layout">
        <div className="warm-instrument__controls">
          {!embedded && <header><p>RELATIONSHIP INSTRUMENT</p><h2>移动三条轴，<br />看见你的关系方式。</h2></header>}
          <p className="warm-instrument__guide">从第一反应开始，没有正确答案。</p>
          <div className="warm-axis-stack">
            {manifest.axes.map((axis, i) => (
              <AxisRail
                key={axis.id}
                axis={axis}
                index={i}
                mv={mvs[i]}
                reduced={reduced}
                idle={idle}
                sweepingRef={sweepingRef}
                onLetterChange={onLetterChange}
                onInteract={handleInteract}
                onAnnounce={handleAnnounce}
              />
            ))}
          </div>
        </div>
        <div data-reveal-item className="reveal-item warm-instrument__preview">
          <LivingTypeCard letters={letters} reduced={reduced} onOpenType={onOpenType} />
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </section>
  )
}
