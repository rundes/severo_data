import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"

export const metadata: Metadata = {
  title: "Severo Dashboard",
  description: "Tableros de información vinculados a Google Sheets",
}

export const viewport: Viewport = {
  themeColor: "#0D47A1",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
