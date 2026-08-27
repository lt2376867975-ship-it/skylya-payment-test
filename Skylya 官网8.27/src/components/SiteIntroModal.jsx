import { useEffect, useRef } from 'react'

export default function SiteIntroModal({ open, onJoin, onLearn, onCancel }) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel()
    }
    document.body.classList.add('membership-modal-open')
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('membership-modal-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onCancel])

  useEffect(() => {
    if (!open) return undefined
    const modal = modalRef.current
    if (!modal) return undefined
    const onClick = (event) => {
      const action = event.target.closest('[data-intro-action]')?.dataset.introAction
      if (action === 'join') onJoin()
      if (action === 'learn') onLearn()
      if (action === 'cancel') onCancel()
    }
    modal.addEventListener('click', onClick)
    return () => modal.removeEventListener('click', onClick)
  }, [open, onJoin, onLearn, onCancel])

  if (!open) return null

  return (
    <div ref={modalRef} className="site-intro-modal" role="dialog" aria-modal="true" aria-labelledby="site-intro-title">
      <div className="site-intro-modal__scrim" />
      <section className="site-intro-modal__panel">
        <button type="button" className="site-intro-modal__cancel" data-intro-action="cancel" onClick={onCancel}>
          ×
        </button>
        <div className="site-intro-modal__copy">
          <p>SKYLYA OFFICIAL</p>
          <h2 id="site-intro-title">Skylya 是 AI 红娘一对一精准匹配服务平台。</h2>
          <span>
            我们通过关系画像、择偶偏好分析与 AI 智能匹配，为用户提供更认真、更清晰的婚恋与情感连接服务。
            加入后可获得专属入会码，进入 Skylya 服务流程。
          </span>
        </div>

        <div className="site-intro-modal__points" aria-label="Skylya 服务说明">
          <span><b>AI 红娘</b><small>根据资料与关系偏好进行一对一精准匹配</small></span>
          <span><b>关系画像</b><small>通过 SkylyaType 理解相处节奏与情绪回应</small></span>
          <span><b>入会码进入</b><small>完成入会服务后获得专属服务资格</small></span>
        </div>

        <div className="site-intro-modal__actions">
          <button type="button" className="warm-button warm-button--companion" data-intro-action="join" onClick={onJoin}>
            加入 Skylya
            <i>→</i>
          </button>
          <button type="button" className="warm-button warm-button--light" data-intro-action="learn" onClick={onLearn}>
            <span className="site-intro-modal__button-copy">
              <b>了解 Skylya</b>
              <small>进入官网</small>
            </span>
            <i>↓</i>
          </button>
        </div>
      </section>
    </div>
  )
}
