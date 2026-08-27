const LINKS = [
  { href: '#gallery', label: '8 型人格' },
  { href: '#instrument', label: '怎么测' },
  { href: '#brand', label: '关于' },
  { href: '#app', label: '了解 Skylya' },
]

export default function Footer() {
  return (
    // role="contentinfo" is explicit: nested in <main> (the closing snap space
    // keeps brand/app/footer as ONE chamber) the implicit footer mapping is
    // suppressed — the explicit role keeps it in the AT landmark list.
    <footer role="contentinfo" className="surface-espresso">
      {/* Top hairline boundary from #app above (hidden inside the mobile closing
          chamber via .closing-space). */}
      <hr className="rule-double" />

      <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8 sm:py-20">
        <div className="flex flex-row items-end justify-between gap-4 sm:gap-8">
          <div>
            <p className="font-display text-[1.5rem] text-[color:var(--color-text)] sm:text-[2.25rem]">
              Skylya
            </p>
            <p className="mt-1 text-caption text-[color:var(--color-text-2)] sm:mt-2.5">先理解 · 再连接</p>
          </div>

          <a href="/type/start" className="btn btn-cta btn-sm focus-cream">
            开始测试
          </a>
        </div>

        {/* Each link gets a ≥44px hit box via padding + negative margin, so the
            visual text row stays exactly as designed (Gen-4 §6 touch targets).
            gap-x-5 (20px) minus 2×10px extension = adjacent hit boxes touch, never overlap. */}
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 sm:mt-10 sm:gap-x-7">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="-mx-2.5 -my-3 inline-flex min-h-11 min-w-11 items-center justify-center px-2.5 py-3 text-caption text-[color:var(--color-text-2)] transition-colors hover:text-[color:var(--color-text)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <p className="mt-4 flex items-center gap-2.5 text-caption text-[color:var(--color-text-2)] sm:mt-8">
          <span>
            <span className="tnum">© 2026</span> Skylya · SkylyaType
          </span>
        </p>
        <p className="mt-3 hidden text-caption text-[color:var(--color-text-2)] sm:block">认真的人，值得一次认真的连接。</p>
      </div>
    </footer>
  )
}
