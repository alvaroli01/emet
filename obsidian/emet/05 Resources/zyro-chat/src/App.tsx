import { lazy, Suspense, useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { isPortalHash } from './portal/router'
import { Nav } from './components/sections/Nav'
import { Hero } from './components/sections/Hero'
import { LogoStrip } from './components/sections/LogoStrip'
import { Employees } from './components/sections/Employees'
import { ProductDemo } from './components/sections/ProductDemo'
import { HowItWorks } from './components/sections/HowItWorks'
import { UseCases } from './components/sections/UseCases'
import { Testimonials } from './components/sections/Testimonials'
import { Contact } from './components/sections/Contact'
import { AgentModal } from './components/agents/AgentModal'
import { useAgentRoute } from './hooks/useAgentRoute'
import { FinalCTA } from './components/sections/FinalCTA'
import { Footer } from './components/sections/Footer'

const PortalApp = lazy(() => import('./portal/PortalApp'))

/** Marketing site at /, dashboards at #/login, #/app/…, #/admin/… */
export default function App() {
  const [portal, setPortal] = useState(isPortalHash)
  useEffect(() => {
    const on = () => setPortal(isPortalHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  if (portal)
    return (
      <Suspense fallback={<div className="grid min-h-screen place-items-center text-body-sm text-ink-400">Loading dashboard…</div>}>
        <PortalApp />
      </Suspense>
    )
  return <Site />
}

/** Reorder or remove sections here. */
function Site() {
  // Which AI employee workspace is open (synced with #agent/<id> in the URL)
  const agent = useAgentRoute()
  return (
    // reducedMotion="user" makes every Framer animation honour prefers-reduced-motion
    <MotionConfig reducedMotion="user">
      <Nav />
      <main>
        <Hero />
        <LogoStrip />
        <Employees onOpen={agent.open} />
        <ProductDemo />
        <HowItWorks />
        <UseCases />
        <Testimonials />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
      <AgentModal id={agent.id} onClose={agent.close} onNavigate={agent.open} />
    </MotionConfig>
  )
}
