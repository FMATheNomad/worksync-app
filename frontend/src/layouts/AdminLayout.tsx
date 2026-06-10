import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function AdminLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      {/* Desktop sidebar — rendered only when viewport >= 768px */}
      {isDesktop && (
        <aside className="flex">
          <Sidebar />
        </aside>
      )}

      {/* Mobile sidebar — Sheet (Radix drawer) overlay */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
