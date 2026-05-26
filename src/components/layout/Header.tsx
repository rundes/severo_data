"use client"

import { useAuth } from "@/contexts/AuthContext"
import Image from "next/image"

export default function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="bg-surface border-b border-hairline px-6 py-3.5 flex items-center justify-between flex-shrink-0">
      <div className="md:ml-0 ml-10">
        <p className="text-[0.6875rem] uppercase tracking-wide text-ink-3">Bienvenido/a</p>
        <h1 className="text-ink font-semibold text-sm leading-none mt-0.5">{user?.name}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-3 hidden sm:block">{user?.email}</span>
        {user?.picture && (
          <Image
            src={user.picture}
            alt={user.name}
            width={34}
            height={34}
            className="rounded-full ring-1 ring-hairline-strong"
            unoptimized
          />
        )}
        <button
          onClick={signOut}
          className="text-xs text-ink-2 hover:text-danger transition-colors px-3 py-1.5 rounded-md hover:bg-danger-tint"
        >
          Salir
        </button>
      </div>
    </header>
  )
}
