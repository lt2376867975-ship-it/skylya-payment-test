import { useCallback, useRef, useState } from 'react'
import HowItWorks from '../components/HowItWorks'
import ScrollRevealSection from '../components/ScrollRevealSection'
import TypeFlipCard from '../components/TypeFlipCard'

const FEATURED_TYPES = ['LAD', 'LBS', 'CAS', 'CAD']

export default function HomeView({ onOpenType, goTab }) {
  const artRef = useRef(null)
  const [hearts, setHearts] = useState([])

  const popHeart = useCallback((event) => {
    const art = artRef.current
    if (!art) return

    const rect = art.getBoundingClientRect()
    const id = `${Date.now()}-${Math.random()}`
    setHearts((current) => [
      ...current,
      {
        id,
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      },
    ])
  }, [])

  const removeHeart = useCallback((id) => {
    setHearts((current) => current.filter((heart) => heart.id !== id))
  }, [])

  return (
    <div className="tab-view warm-home">
      <section className="warm-hero">
        <div className="warm-hero__copy">
          <p className="warm-hero-kicker">RELATIONSHIP TEST</p>
          <h1>
            <span>用 12 道情境题，</span>
            <span>看清你的恋爱方式。</span>
          </h1>
          <p className="warm-hero__intro">不是给你贴标签，而是读懂你如何决定方向、回应情绪，以及感受两个人之间的节奏。</p>
          <div className="warm-hero__actions">
            <button type="button" className="warm-button warm-button--test" onClick={() => goTab('test')}>开始测试 <span>→</span></button>
          </div>
          <div className="warm-test-facts" aria-label="测试信息"><span>12 道情境题</span><i>·</i><span>约 3 分钟</span><i>·</i><span>即时生成关系画像</span></div>
        </div>

        <figure className="warm-hero__art" ref={artRef}>
          <span className="warm-hero__halo warm-hero__halo--lead" aria-hidden="true" />
          <span className="warm-hero__halo warm-hero__halo--companion" aria-hidden="true" />
          <div className="warm-hero__ensemble"><img src="/ip-next/hero-ensemble.png" alt="不同关系人格聚在一起" /></div>
          {hearts.map((heart) => (
            <span
              key={heart.id}
              className="warm-float-heart"
              style={{ left: `${heart.x}%`, top: `${heart.y}%` }}
              onAnimationEnd={() => removeHeart(heart.id)}
              aria-hidden="true"
            >
              ♥
            </span>
          ))}
          <button type="button" className="warm-glass-note" onClick={popHeart} aria-label="生成爱心：理解，不会减少浪漫。"><span>理解，不会减少浪漫。</span><small>它让心动更有方向。</small><i className="warm-note-heart" aria-hidden="true">♥</i></button>
          <button type="button" className="warm-glass-note warm-glass-note--aside warm-glass-note--aside-top" onClick={popHeart} aria-label="生成爱心：慢一点，也是在靠近。">慢一点，也是在靠近。<i className="warm-note-heart" aria-hidden="true">♥</i></button>
          <button type="button" className="warm-glass-note warm-glass-note--aside warm-glass-note--aside-bottom" onClick={popHeart} aria-label="生成爱心：把真实留给彼此。">把真实留给彼此。<i className="warm-note-heart" aria-hidden="true">♥</i></button>
        </figure>
      </section>

      <ScrollRevealSection className="warm-instrument-section" id="try-axes">
        <header data-reveal-item className="reveal-item warm-section-head">
          <p>TEST PREVIEW</p>
          <h2>先试一试，<br />三条关系轴。</h2>
          <span>这是测试会读懂你的三种关系倾向。拖动后松手，预览人格才会翻转；正式结果将由 12 道情境题生成。</span>
        </header>
        <HowItWorks embedded onOpenType={onOpenType} />
      </ScrollRevealSection>

      <ScrollRevealSection className="warm-types-preview">
        <header data-reveal-item className="reveal-item warm-section-head warm-section-head--row">
          <div><p>Skylya Type</p><h2>八种恋爱人格，<br />八种靠近的节奏。</h2><span>先认识每一种关系里的自己；三个字母来自方向、情绪与节奏，并不是给人贴标签。</span></div>
          <button type="button" onClick={() => goTab('types')}>查看全部八种恋爱人格 <span>→</span></button>
        </header>
        <div className="warm-type-grid warm-type-grid--home">
          {FEATURED_TYPES.map((code, index) => <TypeFlipCard key={code} code={code} index={index} compact onOpen={onOpenType} />)}
        </div>
      </ScrollRevealSection>
    </div>
  )
}
