// Bottom tab bar on mobile (app-like), slim top bar on desktop. Drives the
// App's `tab` state — no anchors, no snap, no scroll gymnastics.
import SkylyaLogo from './SkylyaLogo'

const TABS = [
  { id: 'home', label: '主页', icon: IconHome },
  { id: 'types', label: '人格', icon: IconGrid },
  { id: 'test', label: '测试', icon: IconSpark },
  { id: 'app', label: 'Skylya', icon: IconHeart },
]

function IconHome({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}
function IconGrid({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </svg>
  )
}
function IconSpark({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.45 1.45M16.55 16.55 18 18M18 6l-1.45 1.45M7.45 16.55 6 18" />
    </svg>
  )
}
function IconHeart({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.85} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
    </svg>
  )
}
export default function AppNav({ active, onChange, onOpenMembership }) {
  return (
    <nav
      className="app-nav"
      aria-label="主导航"
    >
      <div className="app-nav__inner">
        <a href="#home" onClick={(e) => { e.preventDefault(); onChange('home') }} className="app-nav__brand" aria-label="Skylya 主页">
          <SkylyaLogo />
        </a>
        <div className="app-nav__tabs">
          {TABS.map((t) => {
            const on = active === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? 'page' : undefined}
                className={`app-nav__tab ${on ? 'is-active' : ''} ${t.primary ? 'app-nav__tab--primary' : ''}`}
              >
                <span className="app-nav__icon"><Icon active={on} /></span>
                <span className="app-nav__label">{t.label}</span>
              </button>
            )
          })}
        </div>
        <button type="button" className="app-nav__cta" aria-label="Skylya App" onClick={onOpenMembership}>
          Skylya App <span aria-hidden="true">↗</span>
        </button>
      </div>
    </nav>
  )
}
