"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-paper">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-5 md:p-6">{children}</main>
      </div>
    </div>
  )
}
