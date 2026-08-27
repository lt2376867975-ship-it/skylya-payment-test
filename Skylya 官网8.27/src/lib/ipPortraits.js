const DEFAULT_VARIANT = {
  LAD: 'm',
  LBS: 'f',
  LBD: 'm',
  LAS: 'f',
  CBS: 'm',
  CAS: 'f',
  CBD: 'f',
  CAD: 'm',
}

const IP_ASSET_VERSION = '20260730-2'

export function ipPortrait(code, variant = 'primary') {
  const normalized = String(code || 'LAS').toUpperCase()
  const resolved = variant === 'primary' ? DEFAULT_VARIANT[normalized] || 'm' : variant
  return `/ip-next/${normalized.toLowerCase()}-${resolved}.png?v=${IP_ASSET_VERSION}`
}

export function alternateVariant(code) {
  return DEFAULT_VARIANT[String(code || '').toUpperCase()] === 'f' ? 'm' : 'f'
}
