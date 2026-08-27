import useReveal from './useReveal'

export default function SkylyaAppEntry() {
  const ref = useReveal()

  return (
    <section id="app" ref={ref} className="reveal mx-auto max-w-3xl px-5 pt-2 pb-3 sm:px-8 sm:pt-12 sm:pb-20">
      <div className="relative flex flex-row items-center gap-4 rounded-xl glass px-4 py-4 sm:gap-9 sm:px-10 sm:py-10">
        {/* (Removed the four L-corner brackets — decorative noise. 「不要花花」.) */}
        <div className="card-well h-16 w-16 flex-none sm:h-28 sm:w-28" data-code="cbs">
          <img
            src="/ip/320s/cbs.webp"
            srcSet="/ip/320s/cbs.webp 320w, /ip/512s/cbs.webp 512w"
            sizes="(min-width: 640px) 112px, 64px"
            alt="Skylya 角色插画"
            loading="lazy"
            width="320"
            height="320"
            className="h-full w-full max-w-full object-cover"
          />
        </div>

        <div className="min-w-0 text-left">
          <p className="flex items-center gap-2 text-eyebrow font-medium uppercase text-[color:var(--color-text-2)]">
            <span className="tnum">04</span>
            <span className="font-display normal-case tracking-normal text-[color:var(--color-text)]">Skylya</span> <span className="normal-case">App</span> · 次要入口
          </p>
          <h2 className="font-cjk-display mt-1 text-[1.02rem] text-[color:var(--color-text)] sm:mt-2.5 sm:text-h3">
            一次，只认真对待一个人
          </h2>
          {/* Mobile keeps a one-line compressed definition so「了解 Skylya」still
              lands on what Skylya IS (goal.md 体验架构 6); sm+ gets the full copy. */}
          <p className="mt-2 text-[0.75rem] leading-relaxed text-[color:var(--color-text-2)] sm:hidden">
            <strong className="font-medium text-[color:var(--color-text)]">AI 红娘</strong>撮合的真人约会平台<span className="max-[389px]:hidden"> · 双向合适</span>
          </p>
          <p className="mt-3 hidden max-w-md text-caption leading-relaxed text-[color:var(--color-text-2)] sm:block">
            Skylya 是一个由 <strong className="font-medium text-[color:var(--color-text)]">AI 红娘</strong> 撮合的真人约会平台——千人千尺，双向合适，一次只认真对待一个人。把 SkylyaType 里的「理解」，继续走成一段真实的连接。
          </p>
          {/* NB: `.btn` is unlayered CSS (display:inline-flex) and would defeat
              a `hidden` utility — so this stays a single element, sized by btn-sm. */}
          <a href="#brand" className="btn btn-ghost-cream btn-sm mt-2 sm:mt-5">
            我们的理念
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
