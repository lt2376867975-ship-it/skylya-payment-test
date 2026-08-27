import { useState } from 'react'
import manifest from '../data/type-manifest.json'
import { SKYLIA_TYPE_COPY } from '../data/skylia-type-copy'
import { ipPortrait } from '../lib/ipPortraits'

const typeByCode = Object.fromEntries(manifest.types.map((type) => [type.code, type]))

export default function TypeFlipCard({ code, index, onOpen, compact = false }) {
  const [flipped, setFlipped] = useState(false)
  const type = typeByCode[code]
  const copy = SKYLIA_TYPE_COPY[code]
  const world = code[0] === 'L' ? 'lead' : 'companion'

  return (
    <article data-reveal-item className={`reveal-item type-flip type-flip--${world} ${compact ? 'type-flip--compact' : ''}`}>
      <div className="type-flip__media">
        <button
          type="button"
          className="type-flip__stage"
          aria-pressed={flipped}
          aria-label={`${flipped ? '返回' : '翻开'}${type.publicName}人格卡`}
          onClick={() => setFlipped((value) => !value)}
        >
          <span className={`type-flip__inner ${flipped ? 'is-flipped' : ''}`}>
            <span className="type-flip__face type-flip__face--front">
              <img src={ipPortrait(code)} alt={`${type.publicName}人物形象`} loading={index < 2 ? 'eager' : 'lazy'} />
            </span>
            <span className="type-flip__face type-flip__face--back">
              <span className="type-flip__back-kicker">HOW I COME CLOSER</span>
              <b>我如何靠近</b>
              <span className="type-flip__back-copy">{copy.description}</span>
              <span className="type-flip__traits">
                {copy.traits.slice(0, 3).map((trait) => <i key={trait}>{trait}</i>)}
              </span>
              <span className="type-flip__turn">轻触翻回 <i aria-hidden="true">↺</i></span>
            </span>
          </span>
        </button>
        <button type="button" className="type-flip__open" onClick={() => onOpen(code)} aria-label={`查看${type.publicName}详情`}>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="type-flip__footer">
        <span><b>{code}</b></span>
        <button type="button" onClick={() => onOpen(code)}>完整人格 <i aria-hidden="true">↗</i></button>
      </div>
    </article>
  )
}
