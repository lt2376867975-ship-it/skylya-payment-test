import { useEffect, useRef } from 'react'
import useReveal from './useReveal'

// Hero = 100svh LAS × CAS living specimen of the first axis (关系中的位置).
// Interaction (design-spec §4.1): a single rAF writer composes pointer parallax
// (lerped) with scroll drift into ONE translate3d per element — foreground pair
// pulls apart under the pointer (LAS +16 / CAS -12), ghost L·C drift, and the
// spectrum cursor 「你在哪里?」 glides along the rail. Everything is
// transform/opacity only, demand-scheduled (the rAF loop parks when pointer
// lerp has converged and scroll is still), paused offscreen by IO (which also
// stamps data-offstage so CSS pauses the infinite idle/cue animations), and
// fully disabled under reduced-motion / coarse pointers (touch relies on
// scroll drift + entrance).
export default function Hero() {
  const ref = useReveal()
  const lasRef = useRef(null)
  const casRef = useRef(null)
  const curRef = useRef(null)
  const cueRef = useRef(null)

  useEffect(() => {
    const section = ref.current
    if (!section) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const coarse = window.matchMedia('(hover: none)').matches
    const target = { nx: 0, ny: 0 }
    const pos = { nx: 0, ny: 0 }
    let raf = 0
    let running = false
    let visible = false
    let lastScrollY = -1
    let lastPast = -1

    // Geometry cache — measured once on mount/resize so frames do ZERO
    // getBoundingClientRect (iOS toolbar collapse fires resize, refreshing it).
    let secTop = 0
    let secH = 1
    let vh = 1
    const measure = () => {
      secTop = section.getBoundingClientRect().top + window.scrollY
      secH = section.offsetHeight || 1
      vh = window.innerHeight || 1
    }
    measure()

    const write = (el, x, y) => {
      if (el) el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
    }

    // Demand-driven frame: keeps scheduling itself only while the pointer lerp
    // hasn't converged or the page is still scrolling; otherwise the loop
    // parks and scroll/pointer events wake it (no idle 60–120Hz spin).
    const frame = () => {
      // Pointer easing toward target (0.10 / frame).
      pos.nx += (target.nx - pos.nx) * 0.1
      pos.ny += (target.ny - pos.ny) * 0.1

      // Scroll drift: LAS up, CAS down (opposite → depth), from cached geometry.
      const sy = window.scrollY
      const p = (vh - (secTop - sy)) / (vh + secH)
      const t = Math.max(0, Math.min(1, p)) - 0.5
      const lasDrift = -t * 24
      const casDrift = t * 12

      write(lasRef.current, pos.nx * 16, pos.ny * 8 + lasDrift)
      write(casRef.current, pos.nx * -12, pos.ny * 6 + casDrift)
      if (curRef.current) curRef.current.style.transform = `translate3d(${(pos.nx * 10).toFixed(2)}px, 0, 0) rotate(45deg)`

      // Scroll-cue fades out after >15% of a viewport of scroll. Once fully
      // faded (past 1 → 1) the style write is skipped.
      if (cueRef.current) {
        const past = Math.min(1, Math.max(0, sy / (vh * 0.15)))
        if (!(past === 1 && lastPast === 1)) cueRef.current.style.opacity = String(1 - past)
        lastPast = past
      }

      const settled =
        Math.abs(target.nx - pos.nx) <= 0.001 &&
        Math.abs(target.ny - pos.ny) <= 0.001 &&
        sy === lastScrollY
      lastScrollY = sy
      if (running && !settled) raf = requestAnimationFrame(frame)
      else running = false
    }

    // Wake the loop if parked (IO gate wins: never runs offscreen).
    const wake = () => {
      if (!visible || running) return
      running = true
      raf = requestAnimationFrame(frame)
    }

    const onPointerMove = (e) => {
      const r = section.getBoundingClientRect()
      // Touch (coarse): horizontal glide only — a finger sweep pulls the pair
      // apart while vertical stays free for the snap scroll (touch-action:pan-y).
      target.nx = ((e.clientX - r.left) / r.width - 0.5) * (coarse ? 1.35 : 1)
      target.ny = coarse ? 0 : (e.clientY - r.top) / r.height - 0.5
      wake()
    }
    const onPointerLeave = () => {
      target.nx = 0
      target.ny = 0
      wake()
    }
    const onScroll = () => wake()
    const onResize = () => {
      measure()
      wake()
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true
          // data-offstage gates the CSS infinite animations (hero-idle,
          // cue-chevron): removed → they resume.
          section.removeAttribute('data-offstage')
          wake()
        } else {
          visible = false
          section.setAttribute('data-offstage', '')
          running = false
          cancelAnimationFrame(raf)
        }
      },
      { threshold: 0 }
    )
    io.observe(section)

    // Both pointer types get the parallax; touch also glides back on lift.
    section.addEventListener('pointermove', onPointerMove)
    section.addEventListener('pointerleave', onPointerLeave)
    if (coarse) {
      section.addEventListener('pointerup', onPointerLeave)
      section.addEventListener('pointercancel', onPointerLeave)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      section.removeEventListener('pointermove', onPointerMove)
      section.removeEventListener('pointerleave', onPointerLeave)
      section.removeEventListener('pointerup', onPointerLeave)
      section.removeEventListener('pointercancel', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      section.removeAttribute('data-offstage')
    }
  }, [])

  return (
    <section
      id="hero"
      ref={ref}
      className="surface-obsidian snap-space reveal hero-stagger relative -mt-16 flex min-h-[100svh] flex-col overflow-x-clip px-5 pb-10 pt-24 sm:px-8 lg:grid lg:content-center lg:pb-32 lg:pt-32"
      style={{ touchAction: 'pan-y' }}
    >
      <div className="hero-grid mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 lg:grid lg:flex-none lg:items-center lg:gap-8 lg:grid-cols-[46%_54%]">
        {/* Copy column */}
        <div className="w-full">
          <p
            className="reveal-item spec-label"
            style={{ '--reveal-delay': '0ms' }}
          >
            SkylyaType · 亲密关系人格测试
          </p>

          <h1
            className="reveal-item font-cjk-display font-cjk-display-xl mt-4 text-balance text-display text-[color:var(--color-text)] lg:mt-5"
            style={{ '--reveal-delay': '90ms' }}
          >
            你在亲密关系里，
            <br />
            是哪一种？
          </h1>

          <p
            className="reveal-item mt-4 max-w-[40ch] text-body-lg text-[color:var(--color-text-2)] lg:mt-6"
            style={{ '--reveal-delay': '180ms' }}
          >
            关系里，有人习惯牵引节奏，也有人擅长托住彼此。先看清自己的那一种——<span className="tnum">12</span> 道情境题，读出你在关系里的位置、情绪与节奏。
          </p>

          {/* relative z-30: the CTA/link row must stack ABOVE the art stage —
              on short viewports the figures reach up to this row and a z-20
              image made 85% of the gallery link un-tappable (g4v2-r2 D1). */}
          <div
            className="reveal-item relative z-30 mt-6 flex flex-wrap items-center gap-x-7 gap-y-4 lg:mt-9"
            style={{ '--reveal-delay': '270ms' }}
          >
            <a href="/type/start" className="btn btn-cta btn-lg">
              开始测试 · <span className="tnum">12</span> 题
            </a>
            {/* 44px hit area via min-h + negative margin — visual line height unchanged (Gen-4 §6). */}
            <a
              href="#gallery"
              className="group -my-3 inline-flex min-h-11 items-center gap-2 px-2 -mx-2 text-caption text-[color:var(--color-text-2)] transition-colors hover:text-[color:var(--color-text)]"
            >
              看看 8 种人格
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--color-line)] text-[0.7rem] transition-transform duration-300 group-hover:translate-y-0.5 group-hover:border-[color:var(--color-line-2)]">↓</span>
            </a>
          </div>

          <div
            className="reveal-item mt-6 hidden items-center gap-4 text-caption text-[color:var(--color-text-2)] lg:mt-10 lg:flex"
            style={{ '--reveal-delay': '360ms' }}
          >
            <span className="font-type text-xl text-[color:var(--color-text)]">8</span>
            <span className="h-5 w-px bg-[color:var(--color-line)]" />
            <p>
              8 型人格 · <span className="tnum">3</span> 条关系轴 · 约 <span className="tnum">3</span> 分钟 · 一张可分享的人格名片
            </p>
          </div>
        </div>

        {/* Art stage — full-bleed, no frame: the two figures on one ground line,
            a light product-shot plate behind, neutral spectrum rail below. */}
        <div className="hero-art relative mx-auto w-full max-w-xl flex-1 min-h-[40svh] lg:h-[62svh] lg:min-h-0 lg:flex-none lg:max-h-none">
          {/* Light product-shot plate (§3.7-1) — one very-light-gray floor both
              specimens stand on, isomorphic with the gallery .card-well (no
              spotlight, no warm up-light: whitespace + composition carry it).
              Replaces the old ghost L/C watermark (which read as半可见 noise,
              §3.7-2) and the per-figure floor pools below. z-0, static,
              transform-free. */}
          <div className="hero-cabinet pointer-events-none inset-x-[-2%] bottom-[1%] top-[16%] z-0 md:top-[12%]" />

          {/* LAS — dominant, left, taller, on top (z high). Wrapper owns the
              mount entrance; inner img owns the pointer/scroll parallax. */}
          <div
            className="hero-fig-las reveal-item absolute bottom-[12%] left-[3%] z-20 w-[50%]"
            style={{ '--reveal-delay': '240ms' }}
          >
            {/* Grounding (接光/落地) is now provided by the shared .hero-cabinet
                behind both figures (§3.7-1), matching the gallery well. */}
            <span className="hero-idle relative block">
              <img
                ref={lasRef}
                src="/ip/1024/las.webp"
                alt="从容生活家 · LAS 角色插画"
                width="1024"
                height="1024"
                fetchPriority="high"
                decoding="async"
                className="hero-ip w-full max-w-full will-change-transform"
              />
              {/* Static elliptical ground shadow — replaces the per-pixel CSS
                  drop-shadow filter (GPU-heavy on iPhone); rides the wrapper,
                  zero per-frame cost. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[12%] bottom-[-2%] -z-10 h-5 rounded-full"
                style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(22,21,15,0.12), transparent 70%)' }}
              />
            </span>
          </div>

          {/* CAS — companion, right, overlaps LAS by ~6%, seated slightly lower. */}
          <div
            className="hero-fig-cas reveal-item absolute bottom-[12%] left-[45%] z-10 w-[50%]"
            style={{ '--reveal-delay': '340ms' }}
          >
            <span className="hero-idle relative block" style={{ animationDelay: '1400ms' }}>
              <img
                ref={casRef}
                src="/ip/1024/cas.webp"
                alt="温柔连接者 · CAS 角色插画"
                width="1024"
                height="1024"
                fetchPriority="high"
                decoding="async"
                className="hero-ip w-full max-w-full will-change-transform"
              />
              {/* Static ground shadow (see LAS twin above). */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[12%] bottom-[-2%] -z-10 h-5 rounded-full"
                style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(22,21,15,0.12), transparent 70%)' }}
              />
            </span>
          </div>

          {/* Character nameplate chips */}
          <div
            className="reveal-item absolute bottom-[3%] left-0 z-30 hidden items-center gap-2 glass rounded-[0.85rem] px-3 py-1.5 sm:flex"
            style={{ '--reveal-delay': '400ms' }}
          >
            <span className="font-type text-caption text-[color:var(--color-text)]">LAS</span>
            <span className="text-caption text-[color:var(--color-text-2)]">从容生活家 · 主导</span>
          </div>
          <div
            className="reveal-item absolute bottom-[3%] right-0 z-30 hidden items-center gap-2 glass rounded-[0.85rem] px-3 py-1.5 sm:flex"
            style={{ '--reveal-delay': '500ms' }}
          >
            <span className="font-type text-caption text-[color:var(--color-text)]">CAS</span>
            <span className="text-caption text-[color:var(--color-text-2)]">温柔连接者 · 陪伴</span>
          </div>

          {/* Spectrum rail — the first axis drawn as 「主导 ↔ 陪伴」 with a
              center cursor 「你在哪里?」. Pure diagram: no knob, not a control.
              Desktop only: on the primary mobile surface the big specimens own
              the stage and this rail collided with the scroll cue; the gallery
              teaching-band carries the 主导↔陪伴 axis there. */}
          <div className="absolute inset-x-2 bottom-[-2%] z-0 hidden lg:block">
            <div className="relative flex items-center justify-between text-eyebrow uppercase text-[color:var(--color-text-2)]">
              <span>主导</span>
              <span>陪伴</span>
            </div>
            <div className="relative mt-2">
              <hr className="hero-rail rule-brass rule-brass--capped" style={{ '--reveal-delay': '620ms' }} />
              <span
                ref={curRef}
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rotate-45 bg-[color:var(--color-text)] shadow-[0_0_0_4px_var(--color-bg)]"
                style={{ marginLeft: '-3px', marginTop: '-3px' }}
              />
            </div>
            <p className="hero-rail-q mt-3 text-center text-caption text-[color:var(--color-text-2)]">你在哪里？</p>
          </div>
        </div>
      </div>

      {/* Scroll cue — real link to #gallery, falling chevrons in a neutral tone. */}
      <a
        ref={cueRef}
        href="#gallery"
        aria-label="向下滚动查看 8 种人格"
        className="hero-scrollcue group absolute inset-x-0 bottom-6 z-30 mx-auto flex w-max flex-col items-center gap-1.5 sm:bottom-8"
      >
        <span className="relative block h-7 w-8 text-[color:var(--color-text-3)]">
          <span className="cue-chevron top-0" />
          <span className="cue-chevron top-2.5" style={{ animationDelay: '260ms' }} />
        </span>
        <span className="text-eyebrow uppercase text-[color:var(--color-text-2)] transition-colors group-hover:text-[color:var(--color-text)]">
          向下 · 进入 8 型画廊
        </span>
      </a>
    </section>
  )
}
