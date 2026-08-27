/**
 * API 服务层 - 对接 Java 微服务后端 (skylia-cloud)
 *
 * Web：默认请求走同源 `/api/v1`（由 Nginx 反代到网关）。
 * App：可通过 VITE_API_BASE_URL 指向 HTTPS 网关；未配置时仍使用同源路径。
 *
 * 服务路由:
 * - /api/v1/auth/**     -> skylia-auth (8081)
 * - /api/v1/users/**    -> skylia-user (8082)
 * - /api/v1/profiles/** -> skylia-profile (8083)
 * - /api/v1/chat/**     -> skylia-chat (8084)
 * - /api/v1/matches/**  -> skylia-match (8085)
 * - /api/v1/files/**    -> skylia-file (8086)
 * - /api/v1/ai/**       -> skylia-ai (8087)
 * 
 * 移植自 skylia-web/src/lib/api.ts，修正了 Token 刷新 BUG（改为 header 传递）
 */

import {
  MOCK_AUTH_LOGIN_RESPONSE,
  MOCK_USER,
  resetMockRegistrationFlow,
  resolveMockData,
  tryResolveDevMockOnGatewayDown,
} from '@/lib/mock-data'
import { createAiChatApi } from './api/aiChatApi'
import { createChatApi } from './api/chatApi'
import { createMatchApi } from './api/matchApi'
import { createV6PreferenceApi } from './api/v6PreferenceApi'
export type { V6PreferenceEvaluation, V6PreferenceTurn } from './api/v6PreferenceApi'

// 认证错误事件总线（供 React 层监听后执行 navigate，避免直接操作 window.location 丢失 SPA 状态）
export const authErrorBus = new EventTarget();

const API_PATH_PREFIX = '/api/v1'
const DEV_GATEWAY_PORT = '18080'
const LOCAL_VERIFY_CODE = '123456'
const LOCAL_AUTH_SESSION_KEY = 'skylia_local_auth_session'

/** 仅用于错误提示：开发为 Vite 代理目标，生产为当前站点 origin（与 fetch 同源一致） */
function normalizeGatewayOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '')
}

function configuredApiBaseUrl(): string | null {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  return configured ? configured.replace(/\/+$/, '') : null
}

function configuredDevGatewayOrigin(): string | null {
  if (!import.meta.env.DEV) return null
  const configured = (import.meta.env.VITE_JAVA_GATEWAY_URL as string | undefined)?.trim()
  return configured ? normalizeGatewayOrigin(configured) : null
}

function currentHostDevGatewayOrigin(): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !window.location?.hostname) return null
  const { protocol, hostname } = window.location
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  const gatewayHost = isLocalHost ? 'localhost' : hostname
  return `${protocol || 'http:'}//${gatewayHost}:${DEV_GATEWAY_PORT}`
}

function devDirectGatewayOrigin(): string | null {
  return configuredDevGatewayOrigin() ?? currentHostDevGatewayOrigin()
}

function gatewayDisplayHint(): string {
  const configuredApiBase = configuredApiBaseUrl()
  if (configuredApiBase) return configuredApiBase
  if (import.meta.env.DEV) {
    return devDirectGatewayOrigin() ?? 'http://localhost:18080'
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return '当前站点'
}

function buildApiUrl(endpoint: string, opts?: { directGateway?: boolean }): string {
  const configuredApiBase = configuredApiBaseUrl()
  if (configuredApiBase) return `${configuredApiBase}${endpoint}`
  if (opts?.directGateway && import.meta.env.DEV) {
    const gateway = devDirectGatewayOrigin()
    if (gateway) return `${gateway}${API_PATH_PREFIX}${endpoint}`
  }
  return `${API_PATH_PREFIX}${endpoint}`
}

function isLocalVerifyCode(code: string): boolean {
  return import.meta.env.DEV && code.trim() === LOCAL_VERIFY_CODE
}

type AuthSessionResponse = typeof MOCK_AUTH_LOGIN_RESPONSE

function isLocalAuthSession(): boolean {
  return import.meta.env.DEV && localStorage.getItem(LOCAL_AUTH_SESSION_KEY) === '1'
}

function setAuthSession(res: AuthSessionResponse, opts?: { local?: boolean }): void {
  const effectiveGender = res.gender ?? (res.role === 'lia' ? 2 : (res.role === 'sky' ? 1 : undefined))
  TokenManager.setTokens(res.accessToken, res.refreshToken)
  TokenManager.setUser({
    id: String(res.userId),
    email: res.email,
    phone: res.phone,
    nickname: res.nickname || res.displayName,
    avatarUrl: res.avatarUrl,
    gender: effectiveGender,
    role: res.role,
    displayName: res.displayName,
    isNewUser: res.isNewUser,
  })
  if (opts?.local) {
    localStorage.setItem(LOCAL_AUTH_SESSION_KEY, '1')
  } else {
    localStorage.removeItem(LOCAL_AUTH_SESSION_KEY)
  }
}

function buildLocalAuthSession({
  email,
  phone,
  isNewUser,
}: {
  email?: string
  phone?: string
  isNewUser: boolean
}): AuthSessionResponse {
  const res = {
    ...MOCK_AUTH_LOGIN_RESPONSE,
    email: email || MOCK_AUTH_LOGIN_RESPONSE.email,
    phone: phone || MOCK_AUTH_LOGIN_RESPONSE.phone,
    isNewUser,
  }
  setAuthSession(res, { local: true })
  return res
}

// Token 存储 Key
const TOKEN_KEY = 'skylia_access_token'
const REFRESH_TOKEN_KEY = 'skylia_refresh_token'
const USER_KEY = 'skylia_user'

type AndroidSecureStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function androidSecureStorage(): AndroidSecureStorage | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { SkyliaSecureStorage?: AndroidSecureStorage }).SkyliaSecureStorage
}

function readAuthStorage(key: string): string | null {
  const secureStorage = androidSecureStorage()
  if (!secureStorage) return localStorage.getItem(key)

  const secureValue = secureStorage.getItem(key)
  if (secureValue !== null) return secureValue

  // One-time migration for users upgrading from an older WebView package.
  const legacyValue = localStorage.getItem(key)
  if (legacyValue !== null) {
    secureStorage.setItem(key, legacyValue)
    localStorage.removeItem(key)
  }
  return legacyValue
}

function writeAuthStorage(key: string, value: string): void {
  const secureStorage = androidSecureStorage()
  if (secureStorage) {
    secureStorage.setItem(key, value)
    localStorage.removeItem(key)
    return
  }
  localStorage.setItem(key, value)
}

function removeAuthStorage(key: string): void {
  androidSecureStorage()?.removeItem(key)
  localStorage.removeItem(key)
}

// ==================== Token 管理 ====================

export const TokenManager = {
  getAccessToken: () => readAuthStorage(TOKEN_KEY),
  getRefreshToken: () => readAuthStorage(REFRESH_TOKEN_KEY),
  
  setTokens: (accessToken: string, refreshToken?: string) => {
    writeAuthStorage(TOKEN_KEY, accessToken)
    if (refreshToken) {
      writeAuthStorage(REFRESH_TOKEN_KEY, refreshToken)
    }
  },
  
  clearTokens: () => {
    removeAuthStorage(TOKEN_KEY)
    removeAuthStorage(REFRESH_TOKEN_KEY)
    removeAuthStorage(USER_KEY)
    localStorage.removeItem(LOCAL_AUTH_SESSION_KEY)
    // DEV：重置为「新注册」进度，避免清 key 后 mock 默认 complete 仍进 /home
    resetMockRegistrationFlow()
  },
  
  isLoggedIn: () => !!readAuthStorage(TOKEN_KEY),
  
  getUser: () => {
    try {
      const user = readAuthStorage(USER_KEY)
      return user ? JSON.parse(user) : null
    } catch {
      removeAuthStorage(USER_KEY)
      return null
    }
  },
  
  setUser: (user: any) => {
    writeAuthStorage(USER_KEY, JSON.stringify(user))
  },
}

export function isFrontendPreviewMode(): boolean {
  if (!import.meta.env.DEV) return false
  const flag = import.meta.env.VITE_FRONTEND_PREVIEW
  if (flag === '1' || flag === 'true') return true
  if (flag === '0' || flag === 'false') return false

  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('preview') === '1' || params.get('frontendPreview') === '1'
}

export function ensureFrontendPreviewSession(): void {
  if (!isFrontendPreviewMode()) return

  if (!TokenManager.getAccessToken()) {
    TokenManager.setTokens(
      MOCK_AUTH_LOGIN_RESPONSE.accessToken,
      MOCK_AUTH_LOGIN_RESPONSE.refreshToken,
    )
  }

  if (!TokenManager.getUser()) {
    TokenManager.setUser({
      ...MOCK_USER,
      id: String(MOCK_USER.id),
      isNewUser: false,
    })
  }
}

/**
 * 从匹配会话状态中解析「对方」用户 ID（与后端 UserMatch / candidate 一致，避免只读 candidate 时指向错误对象）
 */
export function resolveActiveMatchPartnerId(
  session: {
    matchResult?: { userId?: number | string; targetUserId?: number | string } | null
    candidate?: { userId?: number | string } | null
  } | null | undefined,
  currentUserId: number | string | null | undefined,
): string | null {
  if (!session || currentUserId === undefined || currentUserId === null) return null
  const me = String(currentUserId)
  const mr = session.matchResult
  if (mr && mr.userId != null && mr.targetUserId != null) {
    const u = String(mr.userId)
    const t = String(mr.targetUserId)
    if (u === me) return t
    if (t === me) return u
  }
  if (session.candidate?.userId != null) return String(session.candidate.userId)
  return null
}

// ==================== HTTP 请求封装 ====================

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp: number
  traceId?: string
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
  noAuth?: boolean
  rawBody?: boolean // 用于 FormData 等不需要 JSON.stringify 的场景
  /** 内部：避免 401→刷新→重试 无限循环 */
  _authRetry?: boolean
  /** 内部：开发环境下 Vite 代理失败时，改用当前局域网主机直连网关重试一次 */
  _directGatewayRetry?: boolean
  suppressUnauthorizedLogout?: boolean
  /** 请求超时（毫秒），超时后自动 abort */
  timeout?: number
}

function isDevMockOnGatewayDownEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  const flag = import.meta.env.VITE_DEV_MOCK_ON_GATEWAY_DOWN
  return flag === '1' || flag === 'true'
}

function tryDevMockFallback<T>(
  endpoint: string,
  method: string,
  body?: unknown,
): T | null {
  if (!isDevMockOnGatewayDownEnabled()) return null
  return tryResolveDevMockOnGatewayDown(endpoint, method, body) as T | null
}

function tryFrontendPreviewMock<T>(
  endpoint: string,
  method: string,
  body?: unknown,
): T | null {
  if (!isFrontendPreviewMode()) return null
  return resolveMockData(endpoint, method, body) as T | null
}

function tryLocalAuthSessionMock<T>(
  endpoint: string,
  method: string,
  body?: unknown,
): T | null {
  if (!isLocalAuthSession()) return null
  return resolveMockData(endpoint, method, body) as T | null
}

function formatGatewayDownMessage(httpStatus?: number): string {
  const hint = gatewayDisplayHint()
  const statusPart = httpStatus ? `（HTTP ${httpStatus}）` : ''
  return `无法连接后端网关${statusPart}。请确认后端服务已在 ${hint} 启动后重试。`
}

function parseJsonBody(text: string, httpStatus: number): any {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
      throw new Error('服务暂时不可用，请稍后重试')
    }
    if (httpStatus >= 500) {
      throw new Error('服务器内部错误，请稍后重试')
    }
    if (httpStatus === 404) {
      throw new Error('请求的接口不存在，请检查服务是否已启动')
    }
    throw new Error('网络响应异常，请稍后重试')
  }
}

function isAuthFailurePayload(data: any): boolean {
  const code = data?.code
  const message = String(data?.message || '')
  return (
    code === 1001 ||
    code === 401 ||
    /token\s*(无效|失效|过期)|未登录|登录已过期|认证已过期/i.test(message)
  )
}

function throwAuthExpired(message = '登录状态已过期，请返回登录页重新登录'): never {
  TokenManager.clearTokens()
  authErrorBus.dispatchEvent(new Event('unauthorized'))
  throw new Error(message)
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    noAuth = false,
    rawBody = false,
    _authRetry = false,
    _directGatewayRetry = false,
    suppressUnauthorizedLogout = false,
    timeout,
  } = options

  const previewMocked = tryFrontendPreviewMock<T>(endpoint, method, body)
  if (previewMocked !== null) return previewMocked
  
  const requestHeaders: Record<string, string> = {
    ...headers,
  }
  
  // 非 rawBody 时设置 JSON Content-Type
  if (!rawBody) {
    requestHeaders['Content-Type'] = 'application/json'
  }
  
  // 添加认证 Token
  if (!noAuth) {
    const token = TokenManager.getAccessToken()
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`
    }
  }
  
  let response: Response
  let abortCtrl: AbortController | undefined
  let abortTimer: ReturnType<typeof setTimeout> | undefined
  if (timeout && timeout > 0) {
    abortCtrl = new AbortController()
    abortTimer = setTimeout(() => abortCtrl!.abort(), timeout)
  }
  try {
    response = await fetch(buildApiUrl(endpoint, { directGateway: _directGatewayRetry }), {
      method,
      headers: requestHeaders,
      body: rawBody ? body : (body ? JSON.stringify(body) : undefined),
      signal: abortCtrl?.signal,
    })
  } catch (e: any) {
    if (abortTimer) clearTimeout(abortTimer)
    if (e?.name === 'AbortError') {
      const err = new Error('请求超时，请稍后重试')
      ;(err as any).isTimeout = true
      throw err
    }
    const mocked = tryDevMockFallback<T>(endpoint, method, body)
    if (mocked !== null) return mocked
    if (!_directGatewayRetry && import.meta.env.DEV && devDirectGatewayOrigin()) {
      return request(endpoint, { ...options, _directGatewayRetry: true })
    }
    throw new Error(formatGatewayDownMessage())
  }
  if (abortTimer) clearTimeout(abortTimer)

  const text = await response.text()
  let data: ReturnType<typeof parseJsonBody>
  try {
    data = parseJsonBody(text, response.status)
  } catch (parseErr) {
    if (response.status >= 500) {
      const mocked = tryDevMockFallback<T>(endpoint, method, body)
      if (mocked !== null) return mocked
      if (!_directGatewayRetry && import.meta.env.DEV && devDirectGatewayOrigin()) {
        return request(endpoint, { ...options, _directGatewayRetry: true })
      }
    }
    throw parseErr
  }

  // Token 过期处理（合并刷新请求，避免并发 401 多次 refresh 导致状态错乱）
  if (response.status === 401) {
    if (isLocalAuthSession()) {
      const mocked = tryLocalAuthSessionMock<T>(endpoint, method, body)
      if (mocked !== null) return mocked
    }
    if (suppressUnauthorizedLogout) {
      const err = new Error(data?.message || '认证状态校验失败')
      ;(err as any).code = data?.code || response.status
      throw err
    }
    if (_authRetry) {
      throwAuthExpired()
    }
    const refreshed = await doRefreshToken()
    if (refreshed) {
      return request(endpoint, { ...options, _authRetry: true })
    }
    throwAuthExpired()
  }
  
  if (!response.ok || (data.code && data.code !== 200)) {
    if (isLocalAuthSession()) {
      const mocked = tryLocalAuthSessionMock<T>(endpoint, method, body)
      if (mocked !== null) return mocked
    }
    const gatewayDown =
      !data.message &&
      (response.status >= 500 || response.status === 0 || response.status === 404)
    if (gatewayDown) {
      const mocked = tryDevMockFallback<T>(endpoint, method, body)
      if (mocked !== null) return mocked
      if (!_directGatewayRetry && import.meta.env.DEV && devDirectGatewayOrigin()) {
        return request(endpoint, { ...options, _directGatewayRetry: true })
      }
    }
    if (isAuthFailurePayload(data) && !suppressUnauthorizedLogout) {
      throwAuthExpired()
    }
    const err = new Error(
      data.message ||
        (gatewayDown ? formatGatewayDownMessage(response.status) : '请求失败'),
    )
    ;(err as any).code = data.code || response.status
    throw err
  }
  
  // 兼容两种返回格式：直接返回 data 或 { code, data, message }
  return data.data !== undefined ? data.data : data
}

/**
 * "软" 认证 GET：带 token，但 401 / 业务失败 / 网络异常时只返回 null，
 * **绝不清 token、不广播未授权**。
 * 用于登录后刚写入 token 时的「状态探测」（如 resolvePostAuthLandingRoute），
 * 避免把刚登录的 session 误杀掉。
 */
export async function softAuthenticatedGet<T>(endpoint: string): Promise<T | null> {
  const previewMocked = tryFrontendPreviewMock<T>(endpoint, 'GET')
  if (previewMocked !== null) return previewMocked

  const token = TokenManager.getAccessToken()
  if (!token) return null

  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    const text = await response.text()
    if (!text) {
      const mocked = tryDevMockFallback<T>(endpoint, 'GET')
      return mocked !== null ? mocked : null
    }

    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      const mocked = tryDevMockFallback<T>(endpoint, 'GET')
      return mocked !== null ? mocked : null
    }

    // 401/403/5xx/业务失败 → 静默返回 null，不触发登出
    if (!response.ok || (data.code && data.code !== 200)) {
      if (isLocalAuthSession()) {
        const mocked = tryLocalAuthSessionMock<T>(endpoint, 'GET')
        if (mocked !== null) return mocked
      }
      const gatewayDown =
        !data.message &&
        (response.status >= 500 || response.status === 0 || response.status === 404)
      if (gatewayDown) {
        const mocked = tryDevMockFallback<T>(endpoint, 'GET')
        if (mocked !== null) return mocked
      }
      return null
    }

    return data.data !== undefined ? data.data : data
  } catch {
    if (isLocalAuthSession()) {
      const mocked = tryLocalAuthSessionMock<T>(endpoint, 'GET')
      if (mocked !== null) return mocked
    }
    const mocked = tryDevMockFallback<T>(endpoint, 'GET')
    return mocked !== null ? mocked : null
  }
}

// ==================== 错误码常量 ====================

export const ErrorCodes = {
  ACCOUNT_REGISTERED: 3003,
  ACCOUNT_NOT_REGISTERED: 3012,
  WECHAT_REQUIRED: 4001,
  PROFILE_INCOMPLETE: 4003,
  ACTIVE_SESSION_EXISTS: 4004,
} as const;

export const ErrorMessages = {
  WECHAT_REQUIRED: 'WECHAT_REQUIRED',
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  ACTIVE_SESSION_EXISTS: 'ACTIVE_SESSION_EXISTS',
  // V6 算法字段缺失（后端 startMatching 入池前校验，缺失即返回 error.message）
  ROLE_REQUIRED: 'ROLE_REQUIRED',
  CITY_REQUIRED: 'CITY_REQUIRED',
  BIRTH_DATE_REQUIRED: 'BIRTH_DATE_REQUIRED',
  HEIGHT_REQUIRED: 'HEIGHT_REQUIRED',
  EDUCATION_REQUIRED: 'EDUCATION_REQUIRED',
  SKYLIA_TYPE_REQUIRED: 'SKYLIA_TYPE_REQUIRED',
  PRIMARY_PHOTO_REQUIRED: 'PRIMARY_PHOTO_REQUIRED',
  PRIMARY_PHOTO_PENDING: 'PRIMARY_PHOTO_PENDING',
} as const;

/**
 * 用户友好的错误码 → 中文文案映射（仅用于「字段缺失」类拦截，弹框提示去补齐）。
 */
export const V6FieldMissingHints: Record<string, string> = {
  ROLE_REQUIRED: '请先完成基础信息（性别角色 sky / lia 缺失）',
  CITY_REQUIRED: '请先完善城市信息',
  BIRTH_DATE_REQUIRED: '请先完善出生日期',
  HEIGHT_REQUIRED: '请先完善身高信息',
  EDUCATION_REQUIRED: '请先完善学历信息',
  SKYLIA_TYPE_REQUIRED: '请先完成 Skylya 类型测评',
};

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return ''

  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }

  // Use relative paths so requests go through Vite proxy (dev) or same-origin routing (prod).
  // Constructing absolute URLs to the gateway caused cross-origin issues with <img> tags.
  return url.startsWith('/') ? url : `/${url}`
}

/**
 * Token 刷新
 * 注意：后端 AuthController.refreshToken() 使用 @RequestHeader("X-Refresh-Token")
 * 因此 refreshToken 通过 header 传递而非 body
 */
let refreshInFlight: Promise<boolean> | null = null

async function doRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const token = TokenManager.getRefreshToken()
    if (!token) return false

    try {
      const response = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Refresh-Token': token,
        },
      })
      const text = await response.text()
      let parsed: any = {}
      if (text) {
        try {
          parsed = JSON.parse(text)
        } catch {
          return false
        }
      }

      if (response.ok && parsed.code === 200 && parsed.data?.accessToken) {
        TokenManager.setTokens(parsed.data.accessToken, parsed.data.refreshToken)
        return true
      }
    } catch (error) {
      console.error('Token 刷新失败:', error)
    }

    return false
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

// ==================== 认证 API ====================

export const AuthApi = {
  /**
   * 【登录专用】发送邮箱验证码 - POST /api/v1/auth/send-code
   * 仅已注册邮箱可收到验证码
   */
  sendCode: async (email: string) => {
    try {
      await request<void>('/auth/send-code', {
        method: 'POST',
        body: { email },
        noAuth: true,
      })
      return { success: true as const, code: 200 as number | undefined }
    } catch (error: any) {
      return { success: false as const, message: error.message as string, code: error.code as number | undefined, waitTime: 0 }
    }
  },

  /** 【注册专用】发送邮箱验证码 - POST /api/v1/auth/send-reg-code */
  sendRegCode: async (email: string, inviteCode: string) => {
    try {
      await request<void>('/auth/send-reg-code', {
        method: 'POST',
        body: { email, inviteCode },
        noAuth: true,
      })
      return { success: true as const, code: 200 as number | undefined }
    } catch (error: any) {
      return { success: false as const, message: error.message as string, code: error.code as number | undefined, waitTime: 0 }
    }
  },

  /**
   * 【登录专用】邮箱验证码登录 - POST /api/v1/auth/login
   * 仅已注册用户可登录
   */
  verifyCode: async (email: string, code: string) => {
    try {
      const res = await request<AuthSessionResponse>('/auth/login', {
        method: 'POST',
        body: { email, code },
        noAuth: true,
      })

      if (res?.accessToken) {
        setAuthSession(res)
      }

      return { success: true, ...res }
    } catch (err) {
      throw err
    }
  },

  /** 【注册专用】邮箱验证码注册 - POST /api/v1/auth/register */
  register: async (email: string, code: string, inviteCode: string) => {
    try {
      const res = await request<AuthSessionResponse>('/auth/register', {
        method: 'POST',
        body: { email, code, inviteCode },
        noAuth: true,
      })

      if (res?.accessToken) {
        setAuthSession(res)
      }

      return { success: true, ...res }
    } catch (err) {
      throw err
    }
  },
  
  // ==================== 手机号通道 ====================

  sendPhoneCode: async (phone: string) => {
    try {
      await request<void>('/auth/phone/send-code', {
        method: 'POST',
        body: { phone },
        noAuth: true,
      })
      return { success: true as const, code: 200 as number | undefined }
    } catch (error: any) {
      return { success: false as const, message: error.message as string, code: error.code as number | undefined, waitTime: 0 }
    }
  },

  sendPhoneRegCode: async (phone: string, inviteCode: string) => {
    try {
      await request<void>('/auth/phone/send-reg-code', {
        method: 'POST',
        body: { phone, inviteCode },
        noAuth: true,
      })
      return { success: true as const, code: 200 as number | undefined }
    } catch (error: any) {
      return { success: false as const, message: error.message as string, code: error.code as number | undefined, waitTime: 0 }
    }
  },

  phoneLogin: async (phone: string, code: string) => {
    try {
      const res = await request<AuthSessionResponse>('/auth/phone/login', {
        method: 'POST',
        body: { phone, code },
        noAuth: true,
      })

      if (res?.accessToken) {
        setAuthSession(res)
      }

      return { success: true, ...res }
    } catch (err) {
      throw err
    }
  },

  phoneRegister: async (phone: string, code: string, inviteCode: string) => {
    try {
      const res = await request<AuthSessionResponse>('/auth/phone/register', {
        method: 'POST',
        body: { phone, code, inviteCode },
        noAuth: true,
      })

      if (res?.accessToken) {
        setAuthSession(res)
      }

      return { success: true, ...res }
    } catch (err) {
      throw err
    }
  },

  /** 获取当前用户 - 对应后端 GET /api/v1/users/me */
  me: async () => {
    try {
      const user = await request<{
        id: number | string
        phone: string
        email: string
        nickname: string
        avatarUrl: string
        gender: number
        role: string
        displayName: string
        status: number
      }>('/users/me', { suppressUnauthorizedLogout: true })
      if (user && user.id != null) {
        user.id = String(user.id)
      }
      return { success: true, user }
    } catch (error) {
      return { success: false, user: null }
    }
  },
  
  /** 登出 - 对应后端 POST /api/v1/auth/logout */
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' })
    } finally {
      TokenManager.clearTokens()
    }
  },
}

// ==================== 账号绑定 API ====================

export const AccountApi = {
  requestDeletion: async (reason?: string) => {
    await request<void>('/account/deletion/request', {
      method: 'POST',
      body: { reason: reason?.trim() || null },
    })
  },

  sendBindEmailCode: async (email: string) => {
    await request<void>('/account/bind-email/send-code', {
      method: 'POST',
      body: { target: email },
    })
  },

  confirmBindEmail: async (email: string, code: string) => {
    await request<void>('/account/bind-email/confirm', {
      method: 'POST',
      body: { target: email, code },
    })
  },

  sendBindPhoneCode: async (phone: string) => {
    await request<void>('/account/bind-phone/send-code', {
      method: 'POST',
      body: { target: phone },
    })
  },

  confirmBindPhone: async (phone: string, code: string) => {
    await request<void>('/account/bind-phone/confirm', {
      method: 'POST',
      body: { target: phone, code },
    })
  },
}

// ==================== 用户 API ====================

export const UserApi = {
  /** 获取当前用户信息 */
  getMe: async () => {
    return request<{
      id: number
      phone: string
      email: string
      nickname: string
      avatarUrl: string
      gender: number
      role: string
      displayName: string
      status: number
    }>('/users/me')
  },

  /** 更新昵称（迁移后写入 user_profiles.display_name） */
  updateNickname: async (nickname: string) => {
    return request('/profiles/me', {
      method: 'PUT',
      body: { displayName: nickname },
    })
  },
  
  /** 更新头像（保留兼容，不再写 users） */
  updateAvatar: async (avatarUrl: string) => {
    return Promise.resolve({ avatarUrl })
  },
  
  /** 更新角色（迁移后写入 user_profiles.role） */
  updateGender: async (gender: number) => {
    const role = gender === 2 ? 'lia' : 'sky'
    return request('/profiles/me', {
      method: 'PUT',
      body: { role },
    })
  },

  /** 提交用户反馈或投诉（现有后端 POST /api/v1/users/me/feedback） */
  submitFeedback: async (payload: { category: 'feedback' | 'complaint'; content: string; contact?: string }) => {
    await request<void>('/users/me/feedback', {
      method: 'POST',
      body: payload,
    })
  },

}

// ==================== 画像 API ====================

export const ProfileApi = {
  /** 获取当前用户画像 - 对应后端 GET /api/v1/profiles/me */
  getMyProfile: async () => {
    const raw = await request<{
      userId: number
      displayName: string
      role: string
      birthDate: string
      heightCm: number
      weightKg: number
      educationLevel: string
      industry: string
      salary: string
      monthlySpendBand: string
      datePaymentAttitude: string | null
      dateBudgetBand: string
      gender?: number
      hobbyTop3: string
      sportFrequency: string
      sportTypes: string
      smoking: boolean
      drinking: boolean
      city: string
      province: string
      district: string
      onboardingStep: number
      onboardingComplete: boolean
      /** 后端计算：资料已足够，可直接进主页，不必再走 AI 采集问答 */
      canEnterAppHome?: boolean
      profileCompleteness: number
      wechatId: string | null
      eduCertStatus: string | null
      eduCertUrl: string | null
      eduCertFileId?: number | null
      eduCertRejectCode?: string | null
      eduCertRejectReason?: string | null
      schoolName: string | null
    }>('/profiles/me')

    return {
      ...raw,
      height: raw.heightCm,
      occupation: raw.industry,
    }
  },
  
  /** 更新画像 - 对应后端 PUT /api/v1/profiles/me */
  updateMyProfile: async (data: Record<string, any>) => {
    return request('/profiles/me', {
      method: 'PUT',
      body: data,
    })
  },
  
  /** 更新引导步骤 - 对应后端 PUT /api/v1/profiles/me/onboarding-step?step= */
  updateOnboardingStep: async (step: number) => {
    return request<void>(`/profiles/me/onboarding-step?step=${encodeURIComponent(String(step))}`, {
      method: 'PUT',
    })
  },
  
  /** 完成引导 - 对应后端 POST /api/v1/profiles/me/complete-onboarding */
  completeOnboarding: async () => {
    return request('/profiles/me/complete-onboarding', {
      method: 'POST',
    })
  },

  /** 提交学历材料并等待服务端视觉模型审核 */
  submitEduCert: async (fileId: number) => {
    return request<{
      status: 'certified' | 'rejected'
      rejectCode?: string | null
      rejectReason?: string | null
      institutionName?: string | null
      documentType?: string | null
      confidence?: number | null
    }>('/profiles/me/edu-cert', {
      method: 'POST',
      body: { fileId },
    })
  },

  /** 获取指定用户画像（用于聊天页展示对方资料） */
  getUserProfile: async (userId: number | string) => {
    return request<{
      userId: number
      displayName: string
      role: string
      birthDate: string
      age?: number
      heightCm: number
      height?: number
      weightKg?: number
      city: string
      province?: string
      district?: string
      industry: string
      occupation?: string
      educationLevel?: string
      schoolName?: string | null
      salary?: string
      monthlySpendBand?: string
      datePaymentAttitude?: string | null
      dateBudgetBand?: string | null
      hobbyTop3?: string
      sportFrequency?: string
      sportTypes?: string
      smoking?: boolean | null
      drinking?: boolean | null
    }>(`/profiles/${userId}`)
  },

  /** 获取指定用户照片列表（用于聊天页展示对方头像） */
  getUserPhotos: async (userId: number | string) => {
    return request<Array<{
      id: number
      photoUrl: string
      thumbnailUrl: string
      sortOrder: number
      isMain: boolean
    }>>(`/profiles/${userId}/photos`)
  },

  getUserSkyliaType: async (userId: number | string) => {
    return request<{
      typeCode?: string
      typeName?: string
      dimensionScores?: string
    }>(`/profiles/${userId}/skylia-type`)
  },
}

// ==================== Skylya Type API ====================

export const SkyliaTypeApi = {
  /** 获取 Skylya 类型 - 对应后端 GET /api/v1/profiles/me/skylia-type */
  get: async () => {
    return request<{
      typeCode: string
      typeName: string
      typeDescription: string
      traits: string
      strengths: string
      challenges: string
      compatibleTypes: string
    }>('/profiles/me/skylia-type')
  },
  
  /** 生成 Skylya 类型 - 对应后端 POST /api/v1/ai/skylia-type/generate */
  generate: async () => {
    return request<{
      typeCode: string
      typeName: string
      typeDescription: string
      traits: string
      strengths: string
      challenges: string
      compatibleTypes: string
    }>('/ai/skylia-type/generate', {
      method: 'POST',
    })
  },
}

// ==================== 照片 API ====================

export const PhotosApi = {
  /** 获取照片列表 - 对应后端 GET /api/v1/profiles/me/photos */
  list: async () => {
    return request<Array<{
      id: number
      photoUrl: string
      thumbnailUrl: string
      sortOrder: number
      isMain: boolean
      humanAuditStatus?: string | null
      isHumanPhoto?: boolean | null
      faceDetected?: boolean | null
      canBeScored?: boolean | null
      isFrontFacing?: boolean | null
      isSinglePerson?: boolean | null
      faceQualityPassed?: boolean | null
      canScoreAesthetic?: boolean | null
      canUseAsPrimary?: boolean | null
      rejectCode?: string | null
      rejectReason?: string | null
      aestheticScore?: number | null
    }>>('/profiles/me/photos')
  },
  
  /** 关联已上传的照片到 Profile - 对应后端 POST /api/v1/profiles/me/photos (@RequestParam) */
  upload: async (photoUrl: string, fileKey: string, thumbnailUrl?: string) => {
    const params = new URLSearchParams({ photoUrl, fileKey })
    if (thumbnailUrl) {
      params.set('thumbnailUrl', thumbnailUrl)
    }
    return request(`/profiles/me/photos?${params.toString()}`, {
      method: 'POST',
    })
  },

  
  /** 删除照片 - 对应后端 DELETE /api/v1/profiles/me/photos/{photoId} */
  delete: async (photoId: number) => {
    return request(`/profiles/me/photos/${photoId}`, {
      method: 'DELETE',
    })
  },
  
  /** 设为主照片 - 对应后端 PUT /api/v1/profiles/me/photos/{photoId}/main */
  setMain: async (photoId: number) => {
    return request(`/profiles/me/photos/${photoId}/main`, {
      method: 'PUT',
    })
  },
}

export type FaceVerificationStatus = {
  status: 'NONE' | 'PENDING' | 'PASSED' | 'FAILED' | 'EXPIRED' | 'INVALIDATED' | string
  provider?: string | null
  certifyId?: string | null
  mainPhotoId?: number | null
  livenessPassed?: boolean | null
  similarityScore?: number | null
  threshold?: number | null
  rejectCode?: string | null
  rejectReason?: string | null
  modelVersion?: string | null
  verifiedAt?: string | null
  expiresAt?: string | null
}

export type FaceVerificationSession = {
  sessionToken: string
  provider?: string | null
  certifyId?: string | null
  certifyUrl?: string | null
  challenges?: string[]
  expiresAt: string
}

export const FaceVerificationApi = {
  status: async () => request<FaceVerificationStatus>('/profiles/me/face-verification/status'),
  createSession: async (metaInfo: string, certifyUrlType = 'H5', returnUrl?: string) =>
    request<FaceVerificationSession>('/profiles/me/face-verification/session', {
      method: 'POST',
      body: { metaInfo, certifyUrlType, returnUrl },
    }),
  submit: async (sessionToken: string, payload?: { certifyId?: string | null; response?: string | null }) =>
    request<FaceVerificationStatus>('/profiles/me/face-verification/submit', {
      method: 'POST',
      body: { sessionToken, certifyId: payload?.certifyId, response: payload?.response },
    }),
}

export const FaceVerificationMiniApi = {
  status: async (bridgeToken: string) =>
    request<FaceVerificationStatus>('/profiles/face-verification/mini/status', {
      method: 'POST',
      body: { bridgeToken },
      noAuth: true,
      suppressUnauthorizedLogout: true,
    }),
  createSession: async (bridgeToken: string, metaInfo: string) =>
    request<FaceVerificationSession>('/profiles/face-verification/mini/session', {
      method: 'POST',
      body: { bridgeToken, metaInfo },
      noAuth: true,
      suppressUnauthorizedLogout: true,
    }),
  submit: async (
    bridgeToken: string,
    sessionToken: string,
    payload?: { certifyId?: string | null; response?: string | null },
  ) =>
    request<FaceVerificationStatus>('/profiles/face-verification/mini/submit', {
      method: 'POST',
      body: { bridgeToken, sessionToken, certifyId: payload?.certifyId, response: payload?.response },
      noAuth: true,
      suppressUnauthorizedLogout: true,
    }),
}

// ==================== 文件 API ====================

type FileUploadResult = {
  fileId: number
  fileKey: string
  url: string
  thumbnailUrl: string
}

function mockFileUploadFromLocalFile(file: File): FileUploadResult {
  const objectUrl = URL.createObjectURL(file)
  const mocked = tryDevMockFallback<FileUploadResult>('/files/upload/image', 'POST')
  return {
    fileId: mocked?.fileId ?? 999,
    fileKey: mocked?.fileKey ?? 'mock-file-key',
    url: objectUrl,
    thumbnailUrl: objectUrl,
  }
}

export const FileApi = {
  /** 上传图片（FormData）- 对应后端 POST /api/v1/files/upload/image */
  uploadImage: async (file: File, bizType = 'photo') => {
    const endpoint = `/files/upload/image?bizType=${bizType}`
    if (isFrontendPreviewMode()) return mockFileUploadFromLocalFile(file)

    const formData = new FormData()
    formData.append('file', file)

    const token = TokenManager.getAccessToken()
    let response: Response
    try {
      response = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
    } catch {
      const mocked = tryDevMockFallback<FileUploadResult>('/files/upload/image', 'POST')
      if (mocked !== null) return mockFileUploadFromLocalFile(file)
      throw new Error(formatGatewayDownMessage())
    }

    const text = await response.text()
    let data: ApiResponse<FileUploadResult>
    try {
      data = parseJsonBody(text, response.status) as ApiResponse<FileUploadResult>
    } catch (parseErr) {
      if (import.meta.env.DEV && response.status >= 500) {
        const mocked = tryDevMockFallback<FileUploadResult>('/files/upload/image', 'POST')
        if (mocked !== null) return mockFileUploadFromLocalFile(file)
      }
      throw parseErr
    }

    const gatewayDown =
      !response.ok ||
      (data.code && data.code !== 200 && !data.message && (response.status >= 500 || response.status === 404))

    if (!response.ok || (data.code && data.code !== 200)) {
      if (isLocalAuthSession()) {
        return mockFileUploadFromLocalFile(file)
      }
      if (gatewayDown) {
        const mocked = tryDevMockFallback<FileUploadResult>('/files/upload/image', 'POST')
        if (mocked !== null) return mockFileUploadFromLocalFile(file)
      }
      throw new Error(data.message || '上传失败')
    }

    return data.data as FileUploadResult
  },
  
  /** 删除文件 */
  deleteFile: async (fileId: number) => {
    return request(`/files/${fileId}`, {
      method: 'DELETE',
    })
  },
}

// ==================== 偏好 API ====================

export const PreferencesApi = {
  /** 获取偏好 - 对应后端 GET /api/v1/profiles/me/preferences */
  get: async () => {
    return request<any>('/profiles/me/preferences')
  },
  
  /**
   * 更新偏好 - 对应后端 PUT /api/v1/profiles/me/preferences
   * V6: 接受 prefAgeHard / prefHeightHard / prefEducationHard / prefIncomeHard 四个硬过滤开关。
   */
  update: async (data: Record<string, any>) => {
    return request('/profiles/me/preferences', {
      method: 'PUT',
      body: data,
    })
  },
}

// ==================== V6 偏好对话 / 提炼 API ====================

export const V6PreferenceApi = createV6PreferenceApi(request)

// ==================== 匹配 API ====================

export const MatchApi = createMatchApi(request)

// ==================== 聊天 API ====================

export const ChatApi = createChatApi(request)

// ==================== AI 聊天 API ====================

export const AiChatApi = createAiChatApi(request)

// ==================== 导出 ====================

export default {
  auth: AuthApi,
  user: UserApi,
  profile: ProfileApi,
  match: MatchApi,
  chat: ChatApi,
  file: FileApi,
  aiChat: AiChatApi,
  skyliaType: SkyliaTypeApi,
  photos: PhotosApi,
  faceVerification: FaceVerificationApi,
  preferences: PreferencesApi,
  v6Preference: V6PreferenceApi,
  token: TokenManager,
}
