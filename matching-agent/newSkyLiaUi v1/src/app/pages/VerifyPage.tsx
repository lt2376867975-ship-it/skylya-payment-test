import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AuthApi } from '@/lib/api'
import { getSafeAuthReturnTo, navigateAfterAuth } from '@/lib/auth-return'
import { useResendCountdown } from '@/hooks/useResendCountdown'

import { MobileContainer } from '../components/MobileContainer'
import { ScreenBackChevron } from '../components/ScreenBackChevron'
import { SkyliaBottomButton } from '../components/SkyliaButton'

interface VerifyState {
  inviteCode: string
  /** 兼容新 UI 旧 demo 字段：登录页传 contact，由我们解析为 email/phone */
  contact?: string
  channel: 'phone' | 'email'
  mode?: 'login' | 'signup'
  email?: string
  phone?: string
  isRegister?: boolean
  autoLoginSwitch?: boolean
  returnTo?: string
}

const RESEND_SECONDS = 60

const SF_BLACK_STACK =
  "'SF Pro Display', 'SF Pro', -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', sans-serif"
const BALOO = "'Baloo Thambi 2', 'Baloo Thambi', 'Arial Rounded MT Bold', sans-serif"

/**
 * 验证码页（Figma 240:242）。
 *
 * UI：完全保留 Figma 像素布局
 * 业务：接入旧 Verify.tsx 的真实 API 调用
 *  - 登录：AuthApi.verifyCode / phoneLogin
 *  - 注册：AuthApi.register / phoneRegister；3003 已注册 → 自动切登录
 *  - 重发：sendCode/sendRegCode/sendPhoneCode/sendPhoneRegCode
 *  - 验证成功后走 resolvePostAuthLandingRoute 跳转
 */
export function VerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as Partial<VerifyState>
  const returnTo = getSafeAuthReturnTo(location)

  // 解析 channel + email / phone
  const channel = (state.channel ?? 'email') as VerifyState['channel']
  const email = state.email || (channel === 'email' ? state.contact || '' : '')
  const phone = state.phone || (channel === 'phone' ? state.contact || '' : '')
  const target = channel === 'email' ? email : phone
  const isRegister = !!state.isRegister || state.mode === 'signup'
  const inviteCode = String(state.inviteCode || '')
  const autoLoginSwitch = !!state.autoLoginSwitch

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(autoLoginSwitch ? '检测到你已注册，已为你发送登录验证码' : '')

  const inputRef = useRef<HTMLInputElement>(null)
  const submitLockRef = useRef(false)
  const { remaining, canResend, start } = useResendCountdown({ initial: RESEND_SECONDS })

  useEffect(() => {
    if (!target) {
      navigate('/login', { replace: true })
    }
  }, [target, navigate])

  useEffect(() => {
    start(RESEND_SECONDS)
  }, [start])

  // 6 位填满即自动提交
  useEffect(() => {
    if (code.length === 6 && !loading && !submitLockRef.current) {
      handleSubmit(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const channelLabel = channel === 'email' ? '邮箱' : '手机'

  const handleSubmit = async (codeStr: string = code) => {
    if (loading || submitLockRef.current) return
    if (codeStr.length !== 6) return
    submitLockRef.current = true
    setError('')
    setInfo((prev) => (prev === '检测到你已注册，已为你发送登录验证码' ? '' : prev))
    setLoading(true)

    try {
      let result
      if (channel === 'email') {
        if (isRegister) {
          try {
            result = await AuthApi.register(email, codeStr, inviteCode)
          } catch (regErr: any) {
            if (regErr?.code === 3003) {
              setInfo('该账号已注册，正在自动登录…')
              result = await AuthApi.verifyCode(email, codeStr)
            } else {
              throw regErr
            }
          }
        } else {
          result = await AuthApi.verifyCode(email, codeStr)
        }
      } else {
        if (isRegister) {
          try {
            result = await AuthApi.phoneRegister(phone, codeStr, inviteCode)
          } catch (regErr: any) {
            if (regErr?.code === 3003) {
              setInfo('该账号已注册，正在自动登录…')
              result = await AuthApi.phoneLogin(phone, codeStr)
            } else {
              throw regErr
            }
          }
        } else {
          result = await AuthApi.phoneLogin(phone, codeStr)
        }
      }

      if (result.success) {
        try {
          await navigateAfterAuth(navigate, returnTo, { replace: true })
        } catch {
          navigate('/onboarding/gender', { replace: true })
        }
      } else {
        setError((result as { message?: string }).message || '验证失败，请重试')
        setCode('')
        inputRef.current?.focus()
      }
    } catch (err: any) {
      setError(err?.message || '验证失败，请重试')
      setCode('')
      inputRef.current?.focus()
    } finally {
      submitLockRef.current = false
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!canResend || loading) return
    setError('')
    setInfo('')
    try {
      let result
      if (channel === 'email') {
        result = isRegister
          ? await AuthApi.sendRegCode(email, inviteCode)
          : await AuthApi.sendCode(email)
      } else {
        result = isRegister
          ? await AuthApi.sendPhoneRegCode(phone, inviteCode)
          : await AuthApi.sendPhoneCode(phone)
      }
      if (result.success) {
        start(RESEND_SECONDS)
      } else {
        setError(result.message || '发送失败，请稍后重试')
      }
    } catch (err: any) {
      setError(err?.message || '网络错误，请稍后重试')
    }
  }

  const ctaText = isRegister ? '选择你的身份' : '登录'

  const handleBack = () => {
    navigate(isRegister ? '/register' : '/login', { replace: true })
  }

  const focusInput = () => inputRef.current?.focus()
  const slots = Array.from({ length: 6 }, (_, i) => code[i] ?? '')
  const activeIndex = Math.min(code.length, 5)

  // 显示用：手机号脱敏
  const displayTarget = channel === 'phone' && phone.length === 11
    ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    : (target || '—')

  return (
    <MobileContainer>
      <div
        className="relative size-full overflow-hidden bg-[#fbf4eb]"
        data-node-id="686:4648"
        data-name="验证码"
      >
        <ScreenBackChevron
          onClick={handleBack}
          className="z-10"
          aria-label={isRegister ? '返回注册' : '返回登陆'}
        />

        <h1
          className="absolute left-1/2 top-[170px] -translate-x-1/2 whitespace-nowrap text-center text-[48px] leading-none tracking-[0.48px] text-[#333]"
          style={{ fontFamily: BALOO, fontWeight: 800 }}
          data-node-id="686:4654"
        >
          Skylya
        </h1>

        <p
          className="absolute left-1/2 top-[266px] -translate-x-1/2 whitespace-nowrap text-center text-[16px] text-[#333]"
          style={{ fontFamily: "'Abril Fatface', Georgia, serif", fontWeight: 400 }}
        >
          AI Dating app with IP
        </p>

        <p
          className="absolute left-1/2 top-[324px] -translate-x-1/2 whitespace-nowrap text-center text-[18px] leading-[23px] tracking-[0.18px] text-[#333]"
          style={{ fontFamily: SF_BLACK_STACK, fontWeight: 1000 }}
          data-node-id="686:4653"
        >
          请输入验证码
        </p>

        <p
          className="absolute left-1/2 top-[357px] w-[279px] -translate-x-1/2 text-center text-[16px] leading-[20px] tracking-[0.16px] text-[#666]"
          style={{ fontFamily: SF_BLACK_STACK, fontWeight: 700 }}
          data-node-id="686:4663"
        >
          验证码已发送到你的{channelLabel}
        </p>

        <p
          className="absolute left-1/2 top-[407px] w-[279px] -translate-x-1/2 text-center text-[16px] leading-[20px] tracking-[0.16px] text-[#333]"
          style={{ fontFamily: SF_BLACK_STACK, fontWeight: 510 }}
          data-node-id="686:4665"
        >
          {displayTarget}
        </p>

        {/* OTP 6 段 */}
        <div
          className="absolute left-[78px] top-[471px] flex h-[28px] w-[247px] cursor-text items-end justify-between"
          onClick={focusInput}
          data-node-id="686:4655"
        >
          {slots.map((char, i) => {
            const isActive = i === activeIndex
            return (
              <div
                key={i}
                className="relative flex h-[28px] w-[29px] items-center justify-center"
              >
                <span
                  className="block text-center text-[16px] leading-[20px] tracking-[0.16px] text-[#333]"
                  style={{ fontFamily: SF_BLACK_STACK, fontWeight: 700 }}
                >
                  {char}
                </span>
                <span
                  className="absolute bottom-[3px] left-0 right-0 block bg-[#e3ddd2]"
                  style={{ height: isActive ? '2px' : '1px', backgroundColor: isActive ? '#d4cbbb' : '#e9e4da' }}
                />
              </div>
            )
          })}
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            maxLength={6}
            value={code}
            disabled={loading}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError('')
            }}
            autoComplete="one-time-code"
            autoFocus
            className="absolute inset-0 h-full w-full cursor-text border-0 bg-transparent text-transparent caret-transparent outline-none"
            aria-label="6 位验证码"
          />
        </div>

        {/* 重发 */}
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend || loading}
          className="absolute left-1/2 top-[519px] -translate-x-1/2 cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-center text-[14px] leading-[18px] tracking-[0.14px] disabled:cursor-not-allowed"
          style={{
            fontFamily: SF_BLACK_STACK,
            fontWeight: 510,
            color: canResend && !loading ? '#333' : '#999',
          }}
          data-node-id="686:4664"
        >
          {canResend
            ? '重新发送验证码'
            : `重新发送验证码(${remaining}s)`}
        </button>

        {/* 提示 / 错误：紧贴 Slogan 上方 */}
        {info && (
          <p
            className="absolute left-1/2 top-[700px] -translate-x-1/2 max-w-[360px] text-center text-[12px] leading-[16px] tracking-[0.12px] text-[#2F2E2B]"
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 700 }}
          >
            {info}
          </p>
        )}
        {error && (
          <p
            className="absolute left-1/2 top-[720px] -translate-x-1/2 max-w-[360px] text-center text-[12px] leading-[16px] tracking-[0.12px] text-[#d4183d]"
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 600 }}
            role="alert"
          >
            {error}
          </p>
        )}

        <SkyliaBottomButton
          disabled={loading || code.length !== 6}
          onClick={() => handleSubmit()}
          left={32}
          data-node-id="686:4676"
          textDataNodeId="686:4679"
        >
          {loading ? '提交中…' : ctaText}
        </SkyliaBottomButton>

      </div>
    </MobileContainer>
  )
}
