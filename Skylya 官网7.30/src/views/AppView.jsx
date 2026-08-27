import { ipPortrait } from '../lib/ipPortraits'
import ScrollRevealSection from '../components/ScrollRevealSection'
import PaidInvitePurchase from '../components/PaidInvitePurchase'

export default function AppView() {
  return (
    <div className="tab-view warm-app-view">
      <header className="warm-app-hero">
        <div className="warm-app-hero__inner">
          <div className="warm-app-hero__copy">
            <h1><span>在 Skylya 的世界，</span><span>遇见更适合你的人。</span></h1>
            <span>让理解优于匹配，让注意力回到真实的人身上。</span>
            <a href="/app/" className="warm-button warm-button--light">进入 Skylya <i>↗</i></a>
          </div>
          <figure className="warm-app-hero__art" aria-label="Skylya 关系人物">
            <img src="/ip-next/app-ensemble.png" alt="不同关系人格聚在一起" />
            <figcaption>Two people. One considered introduction.</figcaption>
          </figure>
        </div>
      </header>

      <ScrollRevealSection className="warm-app-story">
        <div className="warm-app-story__copy">
          <p>FROM PORTRAIT TO CONNECTION</p>
          <h2>理解不是筛选条件，<br />而是相识的起点。</h2>
          <span>关系方式被看见，才能让每一次介绍、回应和真正的见面更接近真实的你。</span>
        </div>
        <div className="warm-phone" aria-label="Skylya App 概念界面">
          <div className="warm-phone__island" aria-hidden="true" />
          <div className="warm-phone__status"><span>9:41</span><span>● ● ●</span></div>
          <div className="warm-phone__screen">
            <p>Tonight's introduction</p>
            <h3>有一个人，<br />值得你认真了解。</h3>
            <div className="warm-phone__portrait"><img src={ipPortrait('CAS', 'f')} alt="今晚的认真介绍" /></div>
            <div className="warm-phone__match"><span><b>CAS</b><small>温柔连接者</small></span><i>与你的节奏自然互补</i></div>
            <button type="button">了解这次介绍 <span>→</span></button>
          </div>
        </div>
      </ScrollRevealSection>

      <PaidInvitePurchase />

      <ScrollRevealSection className="warm-app-values">
        <article><span>01</span><h2>少一点选择噪音</h2><p>不制造无止境的滑动，把注意力还给一个真实的人。</p></article>
        <article><span>02</span><h2>多一点双向理解</h2><p>不只看条件，也理解两个人如何靠近、回应与保留空间。</p></article>
        <article><span>03</span><h2>把隐私当作设计</h2><p>克制展示、谨慎介绍，让认真本身成为一种稀缺体验。</p></article>
      </ScrollRevealSection>

      <ScrollRevealSection className="warm-app-coda">
        <div className="warm-app-coda__copy">
          <p>NEXT STEP</p>
          <h2>把关系画像，带进真实介绍。</h2>
          <span>完成测试后，你可以带着自己的关系节奏进入 Skylya，让介绍从更清楚的理解开始。</span>
        </div>
        <div className="warm-app-coda__actions">
          <a href="/app/" className="warm-button warm-button--companion">访问 Skylya <i>↗</i></a>
        </div>
      </ScrollRevealSection>
    </div>
  )
}
