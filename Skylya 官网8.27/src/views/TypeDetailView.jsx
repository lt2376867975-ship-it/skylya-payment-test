import { useLayoutEffect, useRef, useState } from 'react'
import manifest from '../data/type-manifest.json'
import { SKYLIA_TYPE_COPY } from '../data/skylia-type-copy'
import { ipPortrait } from '../lib/ipPortraits'

const typeByCode = Object.fromEntries(manifest.types.map((type) => [type.code, type]))
const POLE_GLOSS = {
  L: ['Lead', '更常主动推进'], C: ['Companion', '更愿意顺着相处'],
  A: ['Anchor', '亲近时更想靠近'], B: ['Buffer', '有压力会先退一步'],
  S: ['Stable', '喜欢稳定安排'], D: ['Dynamic', '喜欢新鲜变化'],
}

export default function TypeDetailView({ code, onBack, onSwitch }) {
  const rootRef = useRef(null)
  const [variant, setVariant] = useState('m')
  const type = typeByCode[code]
  const copy = SKYLIA_TYPE_COPY[code]

  useLayoutEffect(() => {
    if (rootRef.current) rootRef.current.scrollTop = 0
    setVariant(code[0] === 'C' ? 'f' : 'm')
  }, [code])

  if (!type || !copy) return null

  return (
    <div className="tab-view next-detail" ref={rootRef}>
      <div className="next-detail__topbar">
        <button type="button" className="next-detail__back" onClick={onBack} aria-label="返回人格列表">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg><span>人格</span>
        </button>
      </div>

      <section className={`next-detail__hero next-detail__hero--${code[0].toLowerCase()}`}>
        <div className="next-detail__halo" aria-hidden="true" />
        <img key={`${code}-${variant}`} src={ipPortrait(code, variant)} alt={`${type.publicName} · ${variant === 'm' ? 'Sky' : 'Lya'}`} />
        <div className="next-detail__identity">
          <div className="next-detail__identity-main">
            <span>{code}</span>
            <div className="next-detail__variant" aria-label="切换人物版本">
              <button type="button" className={variant === 'm' ? 'is-active' : ''} onClick={() => setVariant('m')}>Sky</button>
              <button type="button" className={variant === 'f' ? 'is-active' : ''} onClick={() => setVariant('f')}>Lya</button>
            </div>
          </div>
          <small>SKYLYA</small>
        </div>
      </section>

      <article className="next-detail__content">
        <header>
          <p>{code} · {copy.traits.slice(0, 2).join(' / ')}</p>
          <h1>{type.publicName}</h1>
          <span>{copy.description}</span>
        </header>
        <section className="next-detail__decode" aria-label="人格字母解释">
          {code.split('').map((letter, index) => (
            <div key={letter}>
              <b>{letter}</b>
              <span><strong>{POLE_GLOSS[letter][0]}</strong><small>{POLE_GLOSS[letter][1]} · {manifest.axes[index].label}</small></span>
            </div>
          ))}
        </section>
        <section className="next-detail__section">
          <p>相处里的优点</p>
          <h2>你带进关系里的力量</h2>
          <ul>{copy.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul>
        </section>
        <section className="next-detail__section next-detail__matches">
          <p>比较容易合拍的人</p>
          <h2>可能产生默契的人格</h2>
          <div>{copy.bestMatches.map((match) => <button type="button" key={match} onClick={() => onSwitch(match)}><b>{match}</b><span>{typeByCode[match]?.publicName}</span><i>→</i></button>)}</div>
        </section>
      </article>
    </div>
  )
}
