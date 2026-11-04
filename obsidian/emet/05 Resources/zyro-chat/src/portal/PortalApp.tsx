import { useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { PortalProvider, usePortal } from './store'
import { useRoute, go } from './router'
import { Login } from './Login'
import { CustomerApp } from './customer/CustomerApp'
import { AdminApp } from './admin/AdminApp'

function Routes() {
  const path = useRoute()
  const { session } = usePortal()
  const area = path[0]

  // Business accounts can't open the owner panel
  useEffect(() => {
    if (area === 'admin' && session?.role === 'customer') go('app/overview')
  }, [area, session])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [area, path[1]])

  if (area === 'app') return <CustomerApp page={path[1] ?? 'overview'} />
  if (area === 'admin') return <AdminApp path={path} />
  return <Login />
}

/** Dashboards (customer + owner). Loaded lazily from the marketing site. */
export default function PortalApp() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Zyro Chat · Dashboard'
    return () => {
      document.title = prev
    }
  }, [])
  return (
    <MotionConfig reducedMotion="user">
      <PortalProvider>
        <Routes />
      </PortalProvider>
    </MotionConfig>
  )
}
