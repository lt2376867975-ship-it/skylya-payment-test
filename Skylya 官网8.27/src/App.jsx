import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import AppNav from './components/AppNav'
import MembershipModal from './components/MembershipModal'
import SiteIntroModal from './components/SiteIntroModal'
import SiteFooter from './components/SiteFooter'
import HomeView from './views/HomeView'
import TypesView from './views/TypesView'
import TestView from './views/TestView'
import AppView from './views/AppView'
import TypeDetailView from './views/TypeDetailView'

// Own every scroll position ourselves: with 'auto', WebKit async-restores its
// own stale per-history-entry snapshot AFTER history.back() (popstate), landing
// the list ~100px off and overriding the pre-paint restore below.
if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

// App-like shell: four bottom-nav tabs + a full-page type detail. No scroll-snap
// and no scroll-lock modal — a type opens as a plain view swap, so the old
// "close → jump to top → flash back" overlay/history/snap race cannot happen.
// Every scroll save/restore below runs in useLayoutEffect (BEFORE paint), so no
// frame ever shows the wrong position on high-refresh screens.
function App() {
  const [tab, setTab] = useState('home')
  const [detail, setDetail] = useState(null) // type code, or null
  const [introOpen, setIntroOpen] = useState(true)
  const [membershipOpen, setMembershipOpen] = useState(false)
  const detailRef = useRef(null)
  const detailBaseScroll = useRef(0)
  const pendingDetailRestore = useRef(null)
  const pendingTabTop = useRef(false)

  const openMembership = useCallback(() => {
    setIntroOpen(false)
    setMembershipOpen(true)
  }, [])
  const closeMembership = useCallback(() => setMembershipOpen(false), [])
  const closeIntro = useCallback(() => setIntroOpen(false), [])

  // Pre-paint restore with one corrective frame for WebKit's delayed focus /
  // history scroll adjustment.
  const restoreScroll = useCallback((y) => {
    window.scrollTo(0, y)
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y)
    })
  }, [])

  const learnSkylya = useCallback(() => {
    setIntroOpen(false)
    pendingTabTop.current = true
    setTab('app')
    restoreScroll(0)
  }, [restoreScroll])

  // One history entry guards an open detail: system Back / edge-swipe closes it.
  useEffect(() => {
    const wasOpen = detailRef.current !== null
    detailRef.current = detail
    if (detail && !wasOpen && typeof history !== 'undefined' && history.state?.skDetail !== 1) {
      history.pushState({ skDetail: 1 }, '')
    }
  }, [detail])

  useEffect(() => {
    const onPop = () => {
      if (detailRef.current !== null) {
        pendingDetailRestore.current = detailBaseScroll.current
        detailRef.current = null
        setDetail(null)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openType = useCallback((code) => {
    detailBaseScroll.current = window.scrollY
    setDetail(code)
  }, [])

  const switchType = useCallback((code) => setDetail(code), [])

  const closeDetail = useCallback(() => {
    pendingDetailRestore.current = detailBaseScroll.current
    detailRef.current = null
    setDetail(null)
    if (typeof history !== 'undefined' && history.state?.skDetail === 1) history.back()
  }, [])

  const goTab = useCallback((t) => {
    // Never put history.back() inside a React state updater: StrictMode may
    // intentionally invoke updater functions twice in development, which can
    // consume both the detail sentinel and the underlying page entry.
    const wasDetailOpen = detailRef.current !== null
    if (wasDetailOpen) {
      pendingDetailRestore.current = null
      detailRef.current = null
      setDetail(null)
      if (typeof history !== 'undefined' && history.state?.skDetail === 1) history.back()
    }
    pendingTabTop.current = true
    setTab(t)
    restoreScroll(0)
  }, [restoreScroll])

  // Although the list remains mounted under the fixed detail, WebKit can still
  // scroll the document when the focused sticky Back button is removed. Restore
  // the exact open-time position in layout phase so no wrong frame is painted.
  useLayoutEffect(() => {
    if (detail !== null || pendingDetailRestore.current === null) return
    const y = pendingDetailRestore.current
    pendingDetailRestore.current = null
    restoreScroll(y)
  }, [detail, restoreScroll])

  // Nav tab changes always land at the destination page top, including taps on
  // the already-active top/bottom tab.
  useLayoutEffect(() => {
    if (detail !== null) return
    if (!pendingTabTop.current) return
    pendingTabTop.current = false
    restoreScroll(0)
  }, [detail, restoreScroll, tab])

  return (
    <div className="app-shell">
      {/* The active tab STAYS MOUNTED while a detail is open (overlay above it):
          body scroll position survives untouched, no restore, no flash. */}
      <div>
        {tab === 'home' && <HomeView onOpenType={openType} goTab={goTab} />}
        {tab === 'types' && <TypesView onOpenType={openType} />}
        {tab === 'test' && <TestView onOpenType={openType} />}
        {tab === 'app' && <AppView onOpenMembership={openMembership} />}
        <SiteFooter active={tab} onChange={goTab} />
      </div>
      {detail ? (
        <TypeDetailView key={detail} code={detail} onBack={closeDetail} onSwitch={switchType} />
      ) : null}
      <SiteIntroModal open={introOpen} onJoin={openMembership} onLearn={learnSkylya} onCancel={closeIntro} />
      <MembershipModal open={membershipOpen} onClose={closeMembership} />
      <AppNav active={detail ? 'types' : tab} onChange={goTab} onOpenMembership={openMembership} />
    </div>
  )
}

export default App
