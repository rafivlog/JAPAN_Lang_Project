import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Book', icon: '📚', end: true },
  { to: '/practice', label: 'Practice', icon: '📝' },
  { to: '/import', label: 'Import', icon: '📥' },
  { to: '/search', label: 'Search', icon: '🔍' },
  { to: '/progress', label: 'Progress', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-amber-200 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🇯🇵</span>
            <div>
              <div className="font-serif text-lg font-bold leading-none text-red-900">
                TASIN JP
              </div>
              <div className="text-[11px] text-amber-800/70">Kanji & vocabulary notebook</div>
            </div>
          </div>
          <nav className="ml-auto flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-red-900 text-white shadow'
                      : 'text-amber-900 hover:bg-amber-100'
                  }`
                }
              >
                <span>{n.icon}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-amber-800/50">
        ことばの帳 — TASIN JP. All data stays in your browser (IndexedDB).
      </footer>
    </div>
  )
}