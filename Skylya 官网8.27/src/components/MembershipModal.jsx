import { useEffect, useMemo, useState } from 'react'

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

const PLANS = [
  {
    id: 'month',
    name: '1 个月',
    price: '19.9',
    note: '适合先体验 Skylya 的一对一精准匹配服务，完成关系画像后获得专属入会资格。',
    tag: '入门',
  },
  {
    id: 'quarter',
    name: '一季度',
    price: '49.9',
    note: '连续 3 个月保留服务资格，持续接收匹配推荐与择偶偏好分析反馈。',
    tag: '推荐',
  },
  {
    id: 'year',
    name: '一年',
    price: '168',
    note: '长期使用 AI 红娘匹配与关系画像服务，全年保留会员身份与后续推荐权益。',
    tag: '长期',
  },
]

const BENEFITS = [
  'AI 红娘一对一精准匹配',
  '关系画像与择偶偏好分析',
  '专属入会码进入 Skylya 服务',
  '匹配服务期内持续保留资格',
]

const COMPANY_ACCOUNT = {
  name: '演示模式（非真实收款账户）',
  bank: '暂未接入真实对公转账',
  number: '请勿进行真实转账',
}

export default function MembershipModal({ open, onClose }) {
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0])
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [transferDone, setTransferDone] = useState(false)
  const [copied, setCopied] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [phoneConfirmed, setPhoneConfirmed] = useState(false)
  const [paymentState, setPaymentState] = useState('idle')
  const [paymentResult, setPaymentResult] = useState(null)
  const [paymentError, setPaymentError] = useState('')

  const normalizedPhone = phone.replace(/\s/g, '')
  const phoneValid = /^1[3-9]\d{9}$/.test(normalizedPhone)
  const accountText = useMemo(() => (
    `手机号：${normalizedPhone}\n户名：${COMPANY_ACCOUNT.name}\n开户行：${COMPANY_ACCOUNT.bank}\n账号：${COMPANY_ACCOUNT.number}\n转账金额：¥${selectedPlan.price}`
  ), [normalizedPhone, selectedPlan.price])

  const confirmPhone = () => {
    setPhoneTouched(true)
    if (!phoneValid) return
    setPhoneConfirmed(true)
    setPaymentError('')
  }

  const simulatePayment = async () => {
    if (!phoneConfirmed || !phoneValid || paymentState === 'processing') return
    setPaymentState('processing')
    setPaymentError('')
    setPaymentResult(null)
    setTransferDone(false)

    await new Promise((resolve) => window.setTimeout(resolve, 900))

    try {
      const response = await fetch(`${API_BASE}/auth/invite-codes/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.code !== 200 || !body.data?.inviteCode) {
        throw new Error(body.message || '邀请码生成失败，请稍后再试')
      }
      setPaymentResult(body.data)
      setTransferDone(true)
      setPaymentState('done')
    } catch (requestError) {
      setPaymentError(requestError.message || '邀请码生成失败，请稍后再试')
      setPaymentState('idle')
    }
  }

  const copyText = async (label, value) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = value
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setCopied('复制失败')
      window.setTimeout(() => setCopied(''), 1800)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.classList.add('membership-modal-open')
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('membership-modal-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) return
    setPaymentOpen(false)
    setTransferDone(false)
    setCopied('')
    setPhone('')
    setPhoneTouched(false)
    setPhoneConfirmed(false)
    setPaymentState('idle')
    setPaymentResult(null)
    setPaymentError('')
    setSelectedPlan(PLANS[0])
  }, [open])

  if (!open) return null

  return (
    <div className="membership-modal" role="dialog" aria-modal="true" aria-labelledby="membership-title">
      <button type="button" className="membership-modal__scrim" aria-label="关闭入会服务" onClick={onClose} />
      <section className="membership-modal__panel">
        <button type="button" className="membership-modal__close" aria-label="关闭" onClick={onClose}>×</button>

        <div className="membership-modal__hero">
          <p>SKYLYA MEMBERSHIP</p>
          <h2 id="membership-title">
            <span>购买入会服务，</span>
            <span>获得 Skylya 入会码。</span>
          </h2>
          <span>Skylya 是 AI 红娘一对一精准匹配服务平台。入会后可使用关系画像、择偶偏好分析与匹配推荐服务。</span>
        </div>

        <div className="membership-modal__grid">
          <div className="membership-modal__plans" aria-label="入会服务周期">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`membership-plan ${selectedPlan.id === plan.id ? 'is-selected' : ''}`}
                onClick={() => {
                  setSelectedPlan(plan)
                  setPaymentOpen(false)
                  setTransferDone(false)
                  setCopied('')
                  setPhone('')
                  setPhoneTouched(false)
                  setPhoneConfirmed(false)
                  setPaymentState('idle')
                  setPaymentResult(null)
                  setPaymentError('')
                }}
              >
                <span>{plan.tag}</span>
                <b>{plan.name}</b>
                <strong><small>¥</small>{plan.price}</strong>
                <i>{plan.note}</i>
              </button>
            ))}
          </div>

          <div className="membership-modal__summary">
            <p>服务包含</p>
            <ul>
              {BENEFITS.map((benefit) => <li key={benefit}>{benefit}</li>)}
            </ul>

            <button type="button" className="warm-button warm-button--companion membership-pay" onClick={() => setPaymentOpen(true)}>
              立即支付 ¥{selectedPlan.price}
              <i>→</i>
            </button>
          </div>
        </div>

        {paymentOpen ? (
          <div className="company-payment" role="dialog" aria-modal="true" aria-labelledby="company-payment-title">
            <button
              type="button"
              className="company-payment__scrim"
              aria-label="返回入会服务"
              onClick={() => setPaymentOpen(false)}
            />
            <section className="company-payment__sheet">
              <button
                type="button"
                className="company-payment__close"
                aria-label="关闭对公转账信息"
                onClick={() => setPaymentOpen(false)}
              >
                ×
              </button>

              <div className="company-payment__header">
                <p>PAYMENT DEMO</p>
                <h3 id="company-payment-title">填写手机号后，模拟付款确认。</h3>
                <span>当前不会产生真实扣款。确认后系统会签发只能使用一次的入会码，并尝试发送短信。</span>
              </div>

              <div className="company-payment__phone">
                <label htmlFor="membership-phone">接收入会码手机号</label>
                <div>
                  <input
                    id="membership-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    placeholder="请输入 11 位手机号"
                    value={phone}
                    onBlur={() => setPhoneTouched(true)}
                    onChange={(event) => {
                      setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))
                      setPhoneConfirmed(false)
                      setTransferDone(false)
                      setPaymentState('idle')
                      setPaymentResult(null)
                      setPaymentError('')
                    }}
                  />
                  <button type="button" disabled={!phoneValid} onClick={confirmPhone}>
                    {phoneConfirmed ? '已确认' : '确认'}
                  </button>
                </div>
                {phoneTouched && !phoneValid ? <small>请填写正确的 11 位手机号，支付前必须确认。</small> : null}
              </div>

              <div className="company-payment__amount">
                <span>应付金额</span>
                <b><small>¥</small>{selectedPlan.price}</b>
                <i>{selectedPlan.name} · {selectedPlan.tag}</i>
              </div>

              {phoneConfirmed ? (
                <div className="company-payment__account" aria-label="对公账户信息">
                  {[
                    ['户名', COMPANY_ACCOUNT.name],
                    ['开户行', COMPANY_ACCOUNT.bank],
                    ['账号', COMPANY_ACCOUNT.number],
                  ].map(([label, value]) => (
                    <div className="company-payment__row" key={label}>
                      <span>{label}</span>
                      <b>{value}</b>
                      <button type="button" onClick={() => copyText(label, value)}>
                        {copied === label ? '已复制' : '复制'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="company-payment__account company-payment__account--locked">
                  <b>请先填写并确认手机号</b>
                  <span>确认后将显示演示信息，用于模拟付款流程。</span>
                </div>
              )}

              <button type="button" className="company-payment__copy-all" disabled={!phoneConfirmed} onClick={() => copyText('全部信息', accountText)}>
                {copied === '全部信息' ? '已复制全部转账信息' : '复制全部转账信息'}
              </button>

              <div className={`membership-code ${transferDone || paymentState === 'processing' || paymentError ? 'is-visible' : ''}`} aria-live="polite">
                {paymentError ? (
                  <>
                    <span>付款模拟失败</span>
                    <b role="alert">{paymentError}</b>
                    <small>请检查手机号或稍后重试。</small>
                  </>
                ) : paymentState === 'processing' ? (
                  <>
                    <span>正在确认模拟付款</span>
                    <b>正在生成一次性邀请码…</b>
                    <small>请稍候，不要重复点击。</small>
                  </>
                ) : paymentResult ? (
                  <>
                    <span>{paymentResult.smsStatus === 'ACCEPTED' ? '短信已提交发送' : '邀请码已生成'}</span>
                    <b>您的邀请码是：{paymentResult.inviteCode}</b>
                    <small>已发送至 {paymentResult.phoneMask} · 仅可使用一次</small>
                  </>
                ) : (
                  <>
                    <span>入会码发送方式</span>
                    <b>{phoneConfirmed ? normalizedPhone : '确认手机号后继续'}</b>
                    <small>模拟付款成功后，将生成一次性邀请码并尝试发送短信。</small>
                  </>
                )}
              </div>

              <button
                type="button"
                className="warm-button warm-button--companion company-payment__done"
                disabled={!phoneConfirmed || paymentState === 'processing' || transferDone}
                onClick={simulatePayment}
              >
                {paymentState === 'processing' ? '正在确认付款…' : transferDone ? '邀请码已生成' : '模拟我已付款'}
                <i>→</i>
              </button>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  )
}
