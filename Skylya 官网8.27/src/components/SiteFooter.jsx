import SkylyaLogo from './SkylyaLogo'

const FOOTER_LINKS = [
  { id: 'home', label: '首页' },
  { id: 'types', label: '人格图鉴' },
  { id: 'test', label: '关系测试' },
  { id: 'app', label: 'Skylya' },
]

const SUPPORT_EMAIL = 'support@skylya.com'

export default function SiteFooter({ active, onChange }) {
  return (
    <footer className="site-footer" aria-label="底部导航">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <p className="site-footer__logo"><SkylyaLogo /></p>
          <div className="site-footer__contact" aria-label={`联系我们 ${SUPPORT_EMAIL}`}>
            <span>
              <b>联系我们</b>
              <small>{SUPPORT_EMAIL}</small>
            </span>
            <i aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.4" />
                <path d="m5.5 8 6.5 5.4L18.5 8" />
              </svg>
            </i>
          </div>
          <span className="site-footer__note">先理解自己的关系方式，再遇见更适合你的人。</span>
        </div>

        <nav className="site-footer__nav" aria-label="官网导航">
          {FOOTER_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => onChange(link.id)}
              aria-current={active === link.id ? 'page' : undefined}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="site-footer__meta">
          <span className="site-footer__copyright"><span className="site-footer__copyright-mark">©</span> 京ICP备2026037562号</span>
        </div>
      </div>
    </footer>
  )
}
