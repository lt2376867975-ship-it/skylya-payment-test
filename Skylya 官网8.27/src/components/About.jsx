import useReveal from './useReveal'

// Brand capstone (#brand, F9). Zero legacy mascot naming, zero gender or
// dual-stance framing. Calm near-white editorial band: worldview on the left,
// a nameless ensemble on the right (no names, no stance labels, no pairing).
const ENSEMBLE = ['las', 'cas', 'lad', 'cbd', 'lbs', 'cad', 'lbd', 'cbs']

export default function About() {
  const ref = useReveal()

  return (
    <section
      id="brand"
      ref={ref}
      className="surface-espresso surface-espresso--deep reveal pt-[4.5rem] pb-4 sm:pt-32 sm:pb-20"
    >
      <div className="mx-auto grid max-w-6xl gap-6 px-5 sm:gap-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
        {/* Worldview */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="tnum text-caption text-[color:var(--color-text-2)]">03</span>
            <span className="text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">我们相信的事</span>
          </div>

          <h2
            className="font-cjk-display font-cjk-display-xl mt-3 text-[color:var(--color-text)] sm:mt-6"
            style={{ fontSize: 'clamp(1.9rem, 0.9rem + 5.1vw, 4.2rem)', lineHeight: 1.06 }}
          >
            {/* Per-line masked rise: outer overflow-hidden window, inner span animates
                transform/opacity only (no clip-path — Gen-4 clean animation set). */}
            <span className="brand-mask block" style={{ '--reveal-delay': '0ms' }}>
              <span className="brand-line block">先理解，</span>
            </span>
            <span className="brand-mask block" style={{ '--reveal-delay': '90ms' }}>
              <span className="brand-line block">再连接。</span>
            </span>
          </h2>

          <div className="brand-copy mt-4 max-w-[36em] space-y-2.5 text-sm text-[color:var(--color-text-2)] sm:mt-8 sm:space-y-5 sm:text-body">
            <p className="reveal-item" style={{ '--reveal-delay': '220ms' }}>
              关系里的错过，常常不是因为不够喜欢，而是因为还不够了解——不了解自己在关系里的样子，也读不懂对方真正的节奏。
            </p>
            <p className="reveal-item" style={{ '--reveal-delay': '330ms' }}>
              SkylyaType 想把「理解」放在「连接」之前：先看清自己的位置、情绪与节奏，再带着这份清醒，去靠近一个人。
            </p>
            <p className="brand-p3 reveal-item" style={{ '--reveal-delay': '440ms' }}>
              这也是 Skylya 在做的事——不追求更多的匹配，只认真对待更对的那一次。认真的人，值得一次认真的连接。
            </p>
          </div>

          {/* Focus-singularity (§2.5): the closing viewport carries ONE brick-red
              focus — the footer CTA「开始测试」below. So this slogan stays
              near-black (no accent), keeping the close calm instead of two
              accents fighting. */}
          <p
            className="brand-slogan reveal-item font-cjk-display mt-4 text-[color:var(--color-text)] sm:mt-9"
            style={{ fontSize: '1.25rem', '--reveal-delay': '560ms' }}
          >
            先理解 · 再连接
          </p>
        </div>

        {/* Nameless ensemble — atmosphere only (≥lg; mobile already met all 8
            in the gallery space and the closing space keeps a one-screen budget). */}
        <div className="hidden w-full lg:block">
          <div className="grid grid-cols-4 items-start gap-3 py-6 sm:gap-4">
            {ENSEMBLE.map((code, i) => (
              <div
                key={code}
                data-reveal-item
                className={`reveal-item card-well aspect-square opacity-90 ${i % 4 === 1 || i % 4 === 3 ? 'mt-3' : ''}`}
                style={{ '--reveal-delay': `${i * 60}ms` }}
                data-code={code}
              >
                <img
                  src={`/ip/320s/${code}.webp`}
                  srcSet={`/ip/320s/${code}.webp 320w, /ip/512s/${code}.webp 512w`}
                  // Visible only ≥lg: right column ≈435px, 4 cols + gaps →
                  // ~100px tiles (×2-3 DPR the browser lands on 320s/512s).
                  sizes="(min-width: 1024px) 100px, 25vw"
                  alt="SkylyaType 角色群像"
                  loading="lazy"
                  width="320"
                  height="320"
                  className="h-full w-full max-w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
