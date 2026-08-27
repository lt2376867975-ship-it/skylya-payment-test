import { useEffect, useRef, useState } from 'react'

const LINKS = [
  { href: '#gallery', label: '8 型人格', id: 'gallery' },
  { href: '#instrument', label: '怎么测', id: 'instrument' },
  { href: '#brand', label: '关于', id: 'brand' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState(null)
  const progressRef = useRef(null)
  const menuBtnRef = useRef(null)
  const scrolledRef = useRef(false)

  // Scrolled state + rAF-driven scroll-progress bar (gauge language).
  // iPhone 流畅度: scrollHeight is cached (reading it every frame can force
  // layout mid-scroll) and re-measured on resize; setScrolled uses hysteresis
  // (>48 on, <16 off) behind a ref guard so scroll frames never touch React
  // state while the value is unchanged, and the threshold can't flap.
  useEffect(() => {
    let frame = 0
    let maxScroll = 0
    const measure = () => {
      maxScroll = document.documentElement.scrollHeight - window.innerHeight
    }
    const update = () => {
      frame = 0
      const y = window.scrollY
      let next = scrolledRef.current
      if (y > 48) next = true
      else if (y < 16) next = false
      if (next !== scrolledRef.current) {
        scrolledRef.current = next
        setScrolled(next)
      }
      const bar = progressRef.current
      if (bar) {
        const p = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0
        bar.style.transform = `scaleX(${p.toFixed(4)})`
      }
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }
    const onResize = () => {
      measure()
      onScroll()
    }
    measure()
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Scrollspy — viewport-midline method (g4v2-r2 D2 / design-spec §5.5): the
  // section straddling the 45% line owns the highlight. The old
  // `threshold: 0.5` demanded 50% of the SECTION be visible — mathematically
  // unreachable for the 1800px+ gallery in a 900px viewport, so 「8 型人格」
  // never lit. Functional clear on exit so leaving all sections (hero) drops
  // the highlight regardless of entry order within an IO batch.
  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean)
    if (sections.length === 0) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
          else setActive((prev) => (prev === entry.target.id ? null : prev))
        })
      },
      { rootMargin: '-45% 0px -55% 0px', threshold: 0 }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  // Drawer light-dismiss (g4v2-r2 D8): Escape closes (focus back to the
  // hamburger), and scrolling a meaningful distance away auto-collapses so
  // the drawer never rides the sticky header over the next chapter.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    const startY = window.scrollY
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 120) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [menuOpen])

  return (
    /* Constant flow height (g4v2-r2 D6): the old py-4→py-2.5 switch re-flowed
       the WHOLE document 12px mid-scroll (every snap target moved under the
       finger; anchor landings double-jumped) and transition-all animated
       padding — a layout property — for 500ms (craft-bar veto 16 adjacency).
       Now only paint properties transition; the height never changes. */
    <header
      className={`sticky top-0 z-50 py-2.5 transition-[background-color] duration-200 ${
        scrolled ? 'bg-[color:var(--color-bg)]' : 'bg-transparent'
      }`}
      style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
    >
      {/* relative z-40: keeps the bar row (logo / CTA / burger) above the
          drawer scrim so they stay one-tap targets while the drawer is open. */}
      <div className="relative z-40 mx-auto flex max-w-6xl items-center justify-between px-5 sm:px-8">
        <a
          href="#hero"
          className="flex min-h-11 items-center text-2xl font-bold tracking-tight text-[color:var(--color-text)]"
        >
          Skylya
        </a>

        <nav className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) => {
            const on = active === l.id
            return (
              <a
                key={l.label}
                href={l.href}
                aria-current={on ? 'true' : undefined}
                className={`relative text-caption font-medium transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-[color:var(--color-text)] after:transition-all after:duration-300 ${
                  on
                    ? 'text-[color:var(--color-text)] after:w-full'
                    : 'text-[color:var(--color-text-2)] after:w-0 hover:text-[color:var(--color-text)] hover:after:w-full'
                }`}
              >
                {l.label}
              </a>
            )
          })}
          {/* Persistent nav CTA — quiet OUTLINE (aesthetic v2 §3): the filled
              brick-red accent is reserved for each screen's one primary CTA
              (hero / TestIntro / footer), so it never doubles with this bar. */}
          <a href="/type/start" className="btn btn-ghost btn-sm">
            开始测试
          </a>
        </nav>

        <div className="flex items-center gap-3 md:hidden">
          <a href="/type/start" className="btn btn-ghost btn-sm">
            开始测试
          </a>
          <button
            ref={menuBtnRef}
            type="button"
            aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-line)] transition-colors hover:border-[color:var(--color-text)]"
          >
            <span className={`block h-0.5 w-4 bg-[color:var(--color-text)] transition-transform duration-300 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-4 bg-[color:var(--color-text)] transition-opacity duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-4 bg-[color:var(--color-text)] transition-transform duration-300 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile drawer — transform-only slide + fade with stepped link fade
          (Gen-4 iron rule: panel motion is transform/opacity only, and mobile
          gets zero backdrop-filter — a solid near-white surface keeps it clean).
          Always mounted so it can animate both ways; interaction gated by
          pointer-events. Absolute overlay (top-full) so the header keeps a flat
          ~76px flow height at every breakpoint — it never balloons the header
          or shoves content down. */}
      {/* Transparent scrim under the drawer (above page content, inside the
          header's z-50 context): tapping anywhere outside the drawer closes
          it — the drawer is no longer modal-sticky (D8). */}
      {menuOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <nav
        aria-hidden={!menuOpen}
        // inert + visibility keep the collapsed drawer out of the focus/AT
        // tree (links were Tab-reachable while invisible — WCAG 2.4.3/4.1.2).
        // visibility rides the transition list so it flips only after the
        // fade-out completes, but immediately on open.
        inert={!menuOpen || undefined}
        className={`absolute inset-x-0 top-full z-40 border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] shadow-[0_12px_24px_rgba(22,21,15,0.06)] transition-[transform,opacity,visibility] duration-300 md:hidden ${
          menuOpen
            ? 'pointer-events-auto visible translate-y-0 opacity-100'
            : 'pointer-events-none invisible -translate-y-2 opacity-0'
        }`}
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        <div className="flex flex-col gap-1 px-5 py-3">
          {LINKS.map((l, i) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-2 py-3 text-body text-[color:var(--color-text)] transition-[background-color,color,opacity] hover:bg-[color:var(--color-surface-2)]"
              style={{
                transitionDelay: menuOpen ? `${i * 40}ms` : '0ms',
                opacity: menuOpen ? 1 : 0,
              }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Hairline seat-edge + scroll-progress line — always mounted, revealed
          by opacity only (iPhone 流畅度: conditional mount re-laid-out the
          header and rebuilt the compositor layer on every threshold cross). */}
      <hr
        className={`rule-brass absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
          scrolled ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <span
        ref={progressRef}
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[color:var(--color-text-3)] will-change-transform transition-opacity duration-200 ${
          scrolled ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transform: 'scaleX(0)' }}
      />
    </header>
  )
}
