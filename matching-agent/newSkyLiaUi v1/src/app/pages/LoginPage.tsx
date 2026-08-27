import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import mammoth from 'mammoth'

import { AuthApi, TokenManager, isFrontendPreviewMode } from '@/lib/api'
import { getSafeAuthReturnTo, navigateAfterAuth, navigateAfterSessionRestore } from '@/lib/auth-return'
import {
  isRegisteredAccountError,
  isUnregisteredAccountError,
  readRegisteredAccountLoginHandoff,
  readUnregisteredAccountRegistrationHandoff,
  withRegisteredAccountLoginHandoff,
  withUnregisteredAccountRegistrationHandoff,
} from '@/lib/auth-login-handoff'
import { useResendCountdown } from '@/hooks/useResendCountdown'

import { MobileContainer } from '../components/MobileContainer'
import { ScreenBackChevron } from '../components/ScreenBackChevron'
import { SkyliaBottomButton, SkyliaModalButton } from '../components/SkyliaButton'
import { staticAsset } from '@/lib/static-assets'
import { LEGAL_DOCUMENT_FILES, legalAsset } from '@/lib/legal-assets'

type AuthMode = 'login' | 'signup'
type AuthChannel = 'phone' | 'email'

const SF_BLACK_STACK =
  "'SF Pro Display', 'SF Pro', -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', sans-serif"
const BALOO = "'Baloo Thambi 2', 'Baloo Thambi', 'Arial Rounded MT Bold', sans-serif"
const FLOW_2026_ASSET_ROOT = staticAsset('/figma-assets/flow-2026')

// 与旧 Login.tsx 一致：内测公告 / 协议 / 隐私
const BETA_ANNOUNCEMENT_FILE = LEGAL_DOCUMENT_FILES.announcement
const BETA_USER_AGREEMENT_FILE = LEGAL_DOCUMENT_FILES.userAgreement
const BETA_PRIVACY_FILE = LEGAL_DOCUMENT_FILES.privacyPolicy
const BETA_ANNOUNCEMENT_SEEN_KEY = 'skylia_beta_announcement_seen_v3'
const RESEND_SECONDS = 60

const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const validatePhone = (v: string) => /^1[3-9]\d{9}$/.test(v)

function isInternalErrorMessage(message?: string): boolean {
  if (!message) return false
  return /InternalServerError|FeignClient|during \[POST\]|https?:\/\/|系统异常：/.test(message)
}

function resolveAuthErrorMessage(params: {
  mode: AuthMode
  channel: AuthChannel
  code?: number
  message?: string
}): string {
  const { mode, channel, code, message } = params
  if (mode === 'login' && code === 3012) {
    return '该账号未注册，请返回上一页选择注册'
  }
  if (mode === 'signup' && isRegisteredAccountError(code, message)) {
    return channel === 'phone'
      ? '该手机号已注册，请返回上一页选择登陆'
      : '该邮箱已注册，请返回上一页选择登陆'
  }
  if (isInternalErrorMessage(message)) {
    return mode === 'signup' ? '注册校验暂时不可用，请稍后重试' : '服务暂时不可用，请稍后重试'
  }
  return message || '网络错误，请检查后端服务是否启动'
}

/**
 * 登录 / 注册表单页（Figma 404:1658 登陆 / 404:1675 注册）。
 * 入口为 AuthEntryPage（349:921）：/login 仅登陆、/register 仅注册；左上返回 → /auth。
 *
 * UI：完全保留新 UI Figma 像素布局（402×874，绝对定位）
 * 业务：接入真实 API
 *  - 登录：AuthApi.sendCode / AuthApi.sendPhoneCode
 *  - 注册：发现账号已存在时自动发送登录验证码并切换到登录态
 *  - 已登录直接走 resolvePostAuthLandingRoute 跳转
 *  - 失败时显示错误（保持视觉位置不变）
 *  - 首次访问拉取内测公告（旧 Login.tsx 的能力，叠加浮层）
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = getSafeAuthReturnTo(location)

  // 个人 App 中访问登录/注册路由不等于用户确认退出。已有会话继续按资料状态落地，
  // 只有设置页的明确“退出账号”操作可以清理 Token。
  useEffect(() => {
    if (isFrontendPreviewMode()) return
    if (!TokenManager.isLoggedIn()) return
    let cancelled = false
    void navigateAfterSessionRestore(navigate, returnTo, {
      replace: true,
      shouldContinue: () => !cancelled,
    }).catch(() => {
      if (!cancelled) navigate('/home', { replace: true })
    })
    return () => { cancelled = true }
  }, [navigate, returnTo])

  const mode: AuthMode = location.pathname === '/register' ? 'signup' : 'login'
  const [channel, setChannel] = useState<AuthChannel>('phone')
  const [contact, setContact] = useState('')
  const [verificationVisible, setVerificationVisible] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [smsCode, setSmsCode] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [autoSubmitOnCodeComplete, setAutoSubmitOnCodeComplete] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const smsCodeInputRef = useRef<HTMLInputElement>(null)
  const handledLoginHandoffRef = useRef<number | null>(null)
  const handledRegistrationHandoffRef = useRef<number | null>(null)
  const { remaining, canResend, start: startResendCountdown } = useResendCountdown({ initial: RESEND_SECONDS })

  useEffect(() => {
    if (mode !== 'login') return

    const handoff = readRegisteredAccountLoginHandoff(location.state)
    if (!handoff || handledLoginHandoffRef.current === handoff.id) return
    handledLoginHandoffRef.current = handoff.id

    setChannel(handoff.channel)
    setContact(handoff.contact)
    setVerificationVisible(true)
    setCodeSent(handoff.codeSent)
    setSmsCode('')
    setInviteCode('')
    setAutoSubmitOnCodeComplete(handoff.codeSent)
    setError(handoff.error || '')
    if (handoff.codeSent) startResendCountdown(RESEND_SECONDS)
    window.setTimeout(() => smsCodeInputRef.current?.focus(), 260)
  }, [location.state, mode, startResendCountdown])

  useEffect(() => {
    if (mode !== 'signup') return

    const handoff = readUnregisteredAccountRegistrationHandoff(location.state)
    if (!handoff || handledRegistrationHandoffRef.current === handoff.id) return
    handledRegistrationHandoffRef.current = handoff.id

    setChannel(handoff.channel)
    setContact(handoff.contact)
    setVerificationVisible(true)
    setCodeSent(handoff.codeSent)
    setSmsCode('')
    setAutoSubmitOnCodeComplete(false)
    setError(handoff.error || '')
    if (handoff.codeSent) startResendCountdown(RESEND_SECONDS)
    window.setTimeout(() => smsCodeInputRef.current?.focus(), 260)
  }, [location.state, mode, startResendCountdown])

  // 内测公告
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [announcementHtml, setAnnouncementHtml] = useState<string | null>(null)
  const [announcementLoading, setAnnouncementLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(BETA_ANNOUNCEMENT_SEEN_KEY)) return

    let cancelled = false
    setAnnouncementOpen(true)
    setAnnouncementLoading(true)

    ;(async () => {
      try {
        const res = await fetch(legalAsset(BETA_ANNOUNCEMENT_FILE))
        if (!res.ok) throw new Error('fetch failed')
        const buf = await res.arrayBuffer()
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (!cancelled) setAnnouncementHtml(value || '<p>（暂无正文）</p>')
      } catch {
        if (!cancelled) {
          setAnnouncementHtml('<p>公告内容暂时无法加载，请刷新页面重试。</p>')
        }
      } finally {
        if (!cancelled) setAnnouncementLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const dismissAnnouncement = () => {
    try {
      window.localStorage.setItem(BETA_ANNOUNCEMENT_SEEN_KEY, '1')
    } catch {
      /* ignore quota / private mode */
    }
    setAnnouncementOpen(false)
  }

  const ctaText = codeSent ? (mode === 'login' ? '登录' : '注册') : '获取验证码'
  const contactLabel = channel === 'phone' ? '手机号' : '邮箱'
  const goToAuthMode = (targetMode: AuthMode) => {
    setError('')
    setContact('')
    setVerificationVisible(false)
    setCodeSent(false)
    setSmsCode('')
    setAutoSubmitOnCodeComplete(false)
    navigate(targetMode === 'login' ? '/login' : '/register')
  }

  const renderError = () => {
    if (mode === 'login' && error.includes('未注册')) {
      return (
        <>
          {`该${contactLabel}尚未注册，请先`}
          <button
            type="button"
            onClick={() => goToAuthMode('signup')}
            className="inline cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-[16px] tracking-[0.12px] text-[#d4183d] underline underline-offset-2"
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 800 }}
          >
            注册
          </button>
        </>
      )
    }

    if (mode === 'signup' && error.includes('已注册')) {
      return (
        <>
          {`该${contactLabel}已注册，请前往`}
          <button
            type="button"
            onClick={() => goToAuthMode('login')}
            className="inline cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-[16px] tracking-[0.12px] text-[#d4183d] underline underline-offset-2"
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 800 }}
          >
            登录页登录
          </button>
        </>
      )
    }

    return error
  }

  const sendOneTimeCode = async (target: string) => {
    setLoading(true)
    try {
      let result
      if (mode === 'login') {
        const loginResult = channel === 'email'
          ? await AuthApi.sendCode(target)
          : await AuthApi.sendPhoneCode(target)

        const shouldSwitchPhoneToRegistration = channel === 'phone'
          && !loginResult.success
          && isUnregisteredAccountError(loginResult.code, loginResult.message)

        if (shouldSwitchPhoneToRegistration) {
          setVerificationVisible(true)
          navigate('/register', {
            replace: true,
            state: withUnregisteredAccountRegistrationHandoff(location.state, {
              id: Date.now(),
              channel: 'phone',
              contact: target,
              codeSent: false,
              error: '该手机号尚未注册，请填写付费邀请码后获取验证码',
            }),
          })
          return
        }

        result = loginResult
      } else {
        const registrationResult = channel === 'email'
          ? await AuthApi.sendRegCode(target, inviteCode.trim())
          : await AuthApi.sendPhoneRegCode(target, inviteCode.trim())

        const registrationSaysAccountExists = !registrationResult.success
          && isRegisteredAccountError(registrationResult.code, registrationResult.message)
        if (registrationSaysAccountExists) {
          const loginResult = channel === 'email'
            ? await AuthApi.sendCode(target)
            : await AuthApi.sendPhoneCode(target)

          if (registrationSaysAccountExists || loginResult.success) {
            const loginError = loginResult.success
              ? undefined
              : resolveAuthErrorMessage({
                  mode: 'login',
                  channel,
                  code: loginResult.code,
                  message: loginResult.message || '登录验证码发送失败，请重新发送',
                })

            setVerificationVisible(true)
            navigate('/login', {
              replace: true,
              state: withRegisteredAccountLoginHandoff(location.state, {
                id: Date.now(),
                channel,
                contact: target,
                codeSent: loginResult.success,
                error: loginError,
              }),
            })
            return
          }
        }

        result = registrationResult
      }

      if (result.success) {
        setVerificationVisible(true)
        setCodeSent(true)
        setSmsCode('')
        setAutoSubmitOnCodeComplete(mode === 'login')
        startResendCountdown(RESEND_SECONDS)
        window.setTimeout(() => smsCodeInputRef.current?.focus(), 260)
        return
      }

      setError(resolveAuthErrorMessage({
        mode,
        channel,
        code: result.code,
        message: result.message || '发送失败，请稍后重试',
      }))
    } catch (err: any) {
      setError(resolveAuthErrorMessage({
        mode,
        channel,
        code: err?.code,
        message: err?.message,
      }))
    } finally {
      setLoading(false)
    }
  }

  const validateBeforeSendingCode = () => {
    const trimmed = contact.trim()

    if (channel === 'email') {
      if (!trimmed) { setError('请输入邮箱地址'); return null }
      if (!validateEmail(trimmed)) { setError('邮箱格式不正确'); return null }
    } else {
      if (!trimmed) { setError('请输入手机号'); return null }
      if (!validatePhone(trimmed)) { setError('手机号格式不正确'); return null }
    }

    if (mode === 'signup' && !/^[A-Za-z0-9-]{8,32}$/.test(inviteCode.trim())) {
      setError('请输入有效的邀请码')
      return null
    }

    return { trimmed }
  }

  const handleInlineCodeAction = async () => {
    if (codeSent) {
      await handleResend()
      return
    }
    const values = validateBeforeSendingCode()
    if (!values) return
    await sendOneTimeCode(values.trimmed)
  }

  /**
   * 真实业务接入：
   * - 登录模式：sendCode / sendPhoneCode 发送登录验证码
   * - 注册模式：手机号/邮箱校验通过后直接发送短信验证码
   * - 短信发送后直接在当前页完成 6 位验证码校验
   */
  const handleSubmit = async () => {
    if (loading) return
    setError('')

    const trimmed = contact.trim()

    if (channel === 'email') {
      if (!trimmed) { setError('请输入邮箱地址'); return }
      if (!validateEmail(trimmed)) { setError('邮箱格式不正确'); return }
    } else {
      if (!trimmed) { setError('请输入手机号'); return }
      if (!validatePhone(trimmed)) { setError('手机号格式不正确'); return }
    }
    if (codeSent) {
      if (!/^\d{6}$/.test(smsCode)) {
        setError('请输入 6 位验证码')
        return
      }

      setLoading(true)
      try {
        let result
        if (channel === 'email') {
          if (mode === 'signup') {
            try {
              result = await AuthApi.register(trimmed, smsCode, inviteCode.trim())
            } catch (registerError: any) {
              if (!isRegisteredAccountError(registerError?.code, registerError?.message)) throw registerError
              result = await AuthApi.verifyCode(trimmed, smsCode)
            }
          } else {
            result = await AuthApi.verifyCode(trimmed, smsCode)
          }
        } else if (mode === 'signup') {
          try {
            result = await AuthApi.phoneRegister(trimmed, smsCode, inviteCode.trim())
          } catch (registerError: any) {
            if (!isRegisteredAccountError(registerError?.code, registerError?.message)) throw registerError
            result = await AuthApi.phoneLogin(trimmed, smsCode)
          }
        } else {
          result = await AuthApi.phoneLogin(trimmed, smsCode)
        }

        if (!result.success) throw new Error((result as { message?: string }).message || '验证失败，请重试')
        try {
          await navigateAfterAuth(navigate, returnTo, { replace: true })
        } catch {
          navigate('/onboarding/gender', { replace: true })
        }
      } catch (err: any) {
        setError(err?.message || '验证失败，请重试')
        setSmsCode('')
        window.setTimeout(() => smsCodeInputRef.current?.focus(), 0)
      } finally {
        setLoading(false)
      }
      return
    }

    const values = validateBeforeSendingCode()
    if (!values) return
    await sendOneTimeCode(values.trimmed)
  }

  useEffect(() => {
    if (
      !autoSubmitOnCodeComplete
      || mode !== 'login'
      || !codeSent
      || smsCode.length !== 6
      || loading
    ) return

    void handleSubmit()
    // handleSubmit reads the latest auth form state; adding it would retrigger on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitOnCodeComplete, codeSent, loading, mode, smsCode])

  const handleResend = async () => {
    if (!codeSent || !canResend || loading) return
    setError('')
    const target = contact.trim()
    await sendOneTimeCode(target)
  }

  const switchChannel = (c: AuthChannel) => {
    if (c === channel) return
    setChannel(c)
    setContact('')
    setVerificationVisible(false)
    setCodeSent(false)
    setSmsCode('')
    setInviteCode('')
    setAutoSubmitOnCodeComplete(false)
    setError('')
  }

  const inlineCodeActionText = canResend ? '重新发送' : `${remaining}s后重发`
  const verificationPlaceholder = smsCode ? '' : '请输入短信验证码'

  return (
    <MobileContainer>
      <div
        className="relative size-full overflow-hidden bg-[#fbf4eb]"
        data-node-id={mode === 'login' ? '686:4603' : '686:4626'}
        data-name="登录页"
      >
        <ScreenBackChevron
          onClick={() => navigate('/auth', { state: { skyliaRouteDirection: 'back' } })}
          aria-label="返回"
          data-node-id={mode === 'login' ? '686:4618' : '686:4641'}
          className="top-[55px]"
        />

        <h1
          className="absolute left-1/2 top-[170px] -translate-x-1/2 whitespace-nowrap text-center text-[48px] leading-none tracking-[0.48px] text-[#333]"
          style={{ fontFamily: BALOO, fontWeight: 800 }}
          data-node-id={mode === 'login' ? '686:4608' : '686:4629'}
        >
          Skylya
        </h1>
<button
          type="button"
          onClick={() => switchChannel('phone')}
          className="absolute left-[21px] top-[415px] h-[24px] w-[143px] cursor-pointer border-0 bg-transparent p-0 text-left text-[18px] leading-[22px] tracking-[0.18px] transition-colors"
          style={{
            fontFamily: SF_BLACK_STACK,
            fontWeight: channel === 'phone' ? 1000 : 700,
            color: channel === 'phone' ? '#333' : '#666',
          }}
          data-node-id={mode === 'login' ? '686:4609' : '686:4630'}
        >
          {mode === 'login' ? '手机号登陆' : '手机号注册'}
        </button>
        <button
          type="button"
          onClick={() => switchChannel('email')}
          className="hidden"
          style={{
            fontFamily: SF_BLACK_STACK,
            fontWeight: channel === 'email' ? 1000 : 700,
            color: channel === 'email' ? '#333' : '#666',
          }}
          data-node-id={mode === 'login' ? '686:4611' : '686:4634'}
        >
          {mode === 'login' ? '邮箱登陆' : '邮箱注册'}
        </button>

        <input
          type={channel === 'email' ? 'email' : 'tel'}
          inputMode={channel === 'email' ? 'email' : 'numeric'}
          name="skylia-contact"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          placeholder={channel === 'email' ? '邮箱' : '手机号'}
          value={contact}
          onChange={(e) => {
            const v = e.target.value
            setContact(channel === 'phone' ? v.replace(/\D/g, '').slice(0, 11) : v)
            setVerificationVisible(false)
            setCodeSent(false)
            setSmsCode('')
            setAutoSubmitOnCodeComplete(false)
            setError('')
          }}
          disabled={loading}
          className="absolute left-[21px] top-[460px] h-[28px] w-[359px] border-0 bg-transparent p-0 text-[16px] leading-[28px] tracking-[-0.26px] text-[#333] outline-none placeholder:text-[#999] placeholder:opacity-100 disabled:opacity-60"
          style={{ fontFamily: SF_BLACK_STACK, fontWeight: 590 }}
          data-node-id={mode === 'login' ? '686:4610' : '686:4632'}
          data-name="contact-input"
        />
        <div
          className="absolute left-[21.5px] top-[496px] h-px w-[359px] bg-[#d9d0c3]"
          data-node-id={mode === 'login' ? '686:4612' : '686:4635'}
        />

        {mode === 'signup' && (
          <>
            <p
              className="absolute left-[21px] top-[516px] h-[24px] text-left text-[18px] leading-[22px] tracking-[0.18px] text-[#333]"
              style={{ fontFamily: SF_BLACK_STACK, fontWeight: 1000 }}
            >
              邀请码
            </p>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              name="skylia-invite-code"
              placeholder="付款后短信收到的邀请码"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, 32))
                setError('')
              }}
              disabled={loading || codeSent}
              className="absolute left-[21px] top-[552px] h-[28px] w-[359px] border-0 bg-transparent p-0 text-[16px] leading-[28px] tracking-[0.4px] text-[#333] outline-none placeholder:text-[#999] placeholder:opacity-100 disabled:opacity-60"
              style={{ fontFamily: SF_BLACK_STACK, fontWeight: 590 }}
              aria-label="邀请码"
            />
            <div className="absolute left-[21.5px] top-[588px] h-px w-[359px] bg-[#d9d0c3]" />
          </>
        )}

        {/* 点击获取验证码后，在当前页面淡入输入模块。 */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-out ${verificationVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[8px] opacity-0'}`}
          aria-hidden={!verificationVisible}
        >
          <p
            className={`absolute left-[21px] h-[24px] text-left text-[18px] leading-[22px] tracking-[0.18px] text-[#333] ${mode === 'signup' ? 'top-[606px]' : 'top-[516px]'}`}
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 1000 }}
            data-node-id="686:4631"
          >
            验证码
          </p>

          <input
            ref={smsCodeInputRef}
            type="tel"
            inputMode="numeric"
            autoCapitalize="off"
            autoComplete="one-time-code"
            name="skylia-verification"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            maxLength={6}
            value={smsCode}
            disabled={loading || !verificationVisible}
            onChange={(e) => {
              setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError('')
            }}
            placeholder={verificationPlaceholder}
            className={`absolute left-[21px] h-[28px] w-[230px] border-0 bg-transparent p-0 text-left text-[16px] leading-[28px] tracking-[-0.26px] text-[#333] outline-none placeholder:text-[#999] placeholder:opacity-100 disabled:opacity-60 ${mode === 'signup' ? 'top-[651px]' : 'top-[561px]'}`}
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 590 }}
            data-node-id="686:4633"
          />

          <button
            type="button"
            onClick={handleInlineCodeAction}
            disabled={loading || !canResend}
            className={`absolute right-[21px] flex h-[40px] w-[118px] cursor-pointer items-center justify-center rounded-[10px] border-0 bg-[#2e231f] p-0 text-center text-[13px] leading-[18px] tracking-[0.13px] text-white shadow-[0_4px_5.3px_rgba(0,0,0,0.20)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${mode === 'signup' ? 'top-[642px]' : 'top-[552px]'}`}
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 590 }}
            aria-label={inlineCodeActionText}
          >
            {inlineCodeActionText}
          </button>

          <div
            className={`absolute left-[22.5px] h-px w-[359px] bg-[#d9d0c3] ${mode === 'signup' ? 'top-[687px]' : 'top-[597px]'}`}
            data-node-id="686:4636"
          />
        </div>

        {/* 错误提示 — 紧贴在 Slogan 上方，不破坏 Figma 主视觉 */}
        {error && (
          <p
            className="absolute left-1/2 top-[710px] -translate-x-1/2 max-w-[360px] text-center text-[13px] leading-[20px] tracking-[0.13px] text-[#d4183d]"
            style={{ fontFamily: SF_BLACK_STACK, fontWeight: 590 }}
            role="alert"
          >
            {renderError()}
          </p>
        )}

        <p
          className="absolute left-1/2 top-[742px] -translate-x-1/2 whitespace-nowrap text-center text-[14px] leading-[28px] tracking-[-0.26px] text-[#2e231f]"
          style={{ fontFamily: SF_BLACK_STACK, fontWeight: 400 }}
        >
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            type="button"
            onClick={() => goToAuthMode(mode === 'login' ? 'signup' : 'login')}
            className="ml-[2px] border-0 bg-transparent p-0 text-[14px] font-bold leading-[28px] tracking-[-0.26px] text-[#2e231f]"
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
<SkyliaBottomButton
          disabled={loading || (codeSent && smsCode.length !== 6)}
          onClick={handleSubmit}
          left={36}
          data-node-id={mode === 'login' ? '1031:895' : '1031:895'}
        >
          {loading ? (codeSent ? '验证中…' : '发送中…') : ctaText}
        </SkyliaBottomButton>
      </div>

      {/* 内测公告 modal — 旧业务能力保留 */}
      {announcementOpen && (
        <div
          className="skylia-modal-overlay fixed inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="beta-announcement-title"
        >
          <div
            className="skylia-modal-paper absolute left-1/2 top-[135px] h-[640px] w-[313px] -translate-x-1/2 overflow-hidden rounded-[12px] bg-[#fbf4eb] shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
            data-skylia-modal-card="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Keep this paper texture layer: it is the designed background of the beta announcement modal. */}
            <img
              src={`${FLOW_2026_ASSET_ROOT}/schedule-confirm-modal-bg.png`}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full rounded-[20px] object-cover"
            />
            <h2
              id="beta-announcement-title"
              className="absolute left-0 top-[22px] z-[1] w-full text-center text-[18px] leading-[27px] tracking-[0.4px] text-[#333]"
              style={{ fontFamily: SF_BLACK_STACK, fontWeight: 700 }}
            >
                内测公告
            </h2>
            <div className="absolute left-[1px] top-[67px] z-[1] h-px w-[311px] bg-[#ded6c9]" />
            <div className="absolute left-[17px] top-[78px] z-[1] h-[462px] w-[278px] overflow-y-auto pr-[4px]">
              {announcementLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-[#a1866a]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[14px]">加载中…</span>
                </div>
              ) : (
                <div
                  className="text-[16px] font-normal leading-[1.595] tracking-[0.16px] text-[#a1866a] [&_p]:mb-0 [&_strong]:font-normal [&_ul]:my-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_td]:border [&_td]:border-[#ded6c9] [&_td]:p-2 [&_th]:border [&_th]:border-[#ded6c9] [&_th]:p-2"
                  style={{ fontFamily: SF_BLACK_STACK, fontWeight: 400 }}
                  dangerouslySetInnerHTML={{ __html: announcementHtml ?? '' }}
                />
              )}
            </div>
            <SkyliaModalButton
              onClick={dismissAnnouncement}
              disabled={announcementLoading}
              fullWidth={false}
              height={54}
              className="absolute left-1/2 top-[553px] z-[2] -translate-x-1/2 rounded-[10px]"
            >
              我知道了
            </SkyliaModalButton>
            <img
              src={`${FLOW_2026_ASSET_ROOT}/schedule-confirm-modal-corner.png`}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-0 z-[1] h-[49px] w-[58px] object-fill"
            />
          </div>
        </div>
      )}

    </MobileContainer>
  )
}
