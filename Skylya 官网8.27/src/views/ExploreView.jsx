import HowItWorks from '../components/HowItWorks'

export default function ExploreView({ onOpenType, goTab }) {
  return (
    <div className="tab-view warm-explore">
      <header className="warm-explore__head">
        <p className="warm-kicker"><span /> TEST PREVIEW</p>
        <h1>12题关系测试，<br />从第一反应开始。</h1>
        <span>先用三条关系轴预览测试的阅读方式。每次拖动松手后，字母与人格卡会一起翻转；正式结果由 12 道情境题生成。</span>
      </header>
      <HowItWorks embedded onOpenType={onOpenType} />
      <section className="warm-explore__after">
        <p>约 3 分钟完成；结果会生成一张可分享的关系人格画像。</p>
        <button type="button" className="warm-text-link" onClick={() => goTab('types')}>先认识八种人格 <span>→</span></button>
      </section>
    </div>
  )
}
