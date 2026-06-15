"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"

// next/image no antepone basePath a assets estáticos en export; prefijar manual (igual que LeafletMap)
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ""

const NAV = [
  {
    section: "Datos Electorales",
    items: [
      {
        href: "/dashboard/electoral",
        label: "Resultados",
        icon: (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: "Padrón Electoral",
    items: [
      {
        href: "/dashboard/padron",
        label: "Padrón",
        icon: (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: "Relevamiento",
    items: [
      {
        href: "/dashboard/relevamiento/operacion",
        label: "Operación",
        icon: (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/relevamiento/identificacion",
        label: "Identificación",
        icon: (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        href: "/dashboard/relevamiento/diagnostico",
        label: "Diagnóstico",
        icon: (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        href: "/dashboard/relevamiento/problematicas",
        label: "Problemáticas",
        icon: (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      },
    ],
  },
]

function SidebarLinks({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="px-3 py-4 space-y-6 flex-1 overflow-y-auto">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-3 mb-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-3">
            {group.section}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNav}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent-tint-strong text-accent"
                      : "text-ink-2 hover:bg-accent-tint hover:text-ink"
                  }`}
                >
                  {active && (
                    <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />
                  )}
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <div className="px-5 py-5 border-b border-hairline">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-accent rounded-md flex items-center justify-center">
          <Image src={`${BASE}/severo-icon-header.svg`} alt="" width={22} height={22} aria-hidden unoptimized />
        </div>
        <div>
          <span className="text-ink font-semibold text-lg leading-none">Severo</span>
          <p className="text-ink-3 text-xs mt-0.5">Maipú 2025</p>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-60 bg-panel border-r border-hairline flex-col flex-shrink-0">
        <SidebarBrand />
        <SidebarLinks />
      </aside>

      {/* Mobile toggle */}
      <button
        aria-label="Abrir menú"
        className="md:hidden fixed top-4 left-4 z-[1100] p-2 bg-surface text-ink border border-hairline rounded-md shadow-pop"
        onClick={() => setOpen(true)}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[1100] flex">
          <div className="absolute inset-0 bg-[oklch(0.255_0.008_75_/_0.45)]" onClick={() => setOpen(false)} />
          <aside className="relative z-10 w-60 bg-panel border-r border-hairline flex flex-col shadow-pop">
            <SidebarBrand />
            <SidebarLinks onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
