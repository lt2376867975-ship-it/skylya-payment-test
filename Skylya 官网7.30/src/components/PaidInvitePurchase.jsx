import { useState } from 'react'

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export default function PaidInvitePurchase() {
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const simulatePayment = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请先输入正确的 11 位手机号')
      return
    }
    setState('processing')
    setError('')
    setResult(null)
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    try {
      const response = await fetch(`${API_BASE}/auth/invite-codes/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.code !== 200 || !body.data?.inviteCode) {
        throw new Error(body.message || '邀请码生成失败，请稍后再试')
      }
      setResult(body.data)
      setState('done')
    } catch (requestError) {
      setError(requestError.message || '邀请码生成失败，请稍后再试')
      setState('idle')
    }
  }

  return (
    <section className="warm-invite-purchase" aria-labelledby="invite-purchase-title">
      <div className="warm-invite-purchase__copy">
        <p>PAID INVITATION · PROTOTYPE</p>
        <h2 id="invite-purchase-title">购买一次性邀请码</h2>
        <span>当前先模拟付款确认。真实支付接入后，只有到账订单才能生成邀请码；每个邀请码仅可完成一次注册。</span>
      </div>
      <div className="warm-invite-purchase__card">
        <label htmlFor="invite-phone">接收短信的手机号</label>
        <input
          id="invite-phone"
          type="tel"
          inputMode="numeric"
          maxLength="11"
          value={phone}
          disabled={state === 'processing'}
          onChange={(event) => {
            setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))
            setError('')
          }}
          placeholder="请输入手机号"
        />
        <button type="button" onClick={simulatePayment} disabled={state === 'processing'}>
          {state === 'processing' ? <><i aria-hidden="true" /> 正在确认付款…</> : '我已付款'}
        </button>
        {error && <p className="warm-invite-purchase__error" role="alert">{error}</p>}
        {result && (
          <div className="warm-invite-purchase__message" role="status">
            <small>{result.smsStatus === 'ACCEPTED' ? '短信已提交发送' : '短信模拟发送成功'}</small>
            <strong>您的邀请码是：{result.inviteCode}</strong>
            <span>已发送至 {result.phoneMask} · 仅可使用一次</span>
          </div>
        )}
      </div>
    </section>
  )
}
