import TypeFlipCard from '../components/TypeFlipCard'

const TYPES = ['LAD', 'LBS', 'LBD', 'LAS', 'CAS', 'CBS', 'CBD', 'CAD']

export default function TypesView({ onOpenType }) {
  return (
    <div className="tab-view warm-types-view">
      <header className="warm-types-head">
        <p className="warm-types-kicker">Skylya Type</p>
        <h1>八种恋爱人格，<br />八种相处方式。</h1>
        <span>轻触人物让卡片翻面。三个字母不是标签，而是你决定方向、回应情绪与感受变化的方式。</span>
      </header>
      <div className="warm-axis-key" aria-label="三条关系轴">
        <span className="is-lead"><b>L</b><small>牵引方向</small></span>
        <span className="is-companion"><b>C</b><small>托住彼此</small></span>
        <span><b>A / B</b><small>情绪角色</small></span>
        <span><b>S / D</b><small>节奏偏好</small></span>
      </div>
      <section className="warm-types-all" aria-label="八种关系人格">
        <div className="warm-type-grid">
          {TYPES.map((code, index) => <TypeFlipCard key={code} code={code} index={index} onOpen={onOpenType} />)}
        </div>
      </section>
    </div>
  )
}
