"use client"

import { signOut } from "next-auth/react"
import Image from "next/image"
import type { Session } from "next-auth"

interface Props {
  user: Session["user"]
}

export default function Header({ user }: Props) {
  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
      <div className="md:ml-0 ml-10">
        <p className="text-xs text-gray-400">Bienvenido/a</p>
        <h1 className="text-gray-800 font-semibold text-sm leading-none mt-0.5">{user?.name}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 hidden sm:block">{user?.email}</span>
        {user?.image && (
          <Image
            src={user.image}
            alt={user.name ?? "Avatar"}
            width={34}
            height={34}
            className="rounded-full ring-2 ring-gray-100"
          />
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Salir
        </button>
      </div>
    </header>
  )
}
