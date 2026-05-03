import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
  const tokens = await response.json()
  if (!response.ok) throw tokens
  return {
    accessToken: tokens.access_token as string,
    expiresAt: Math.floor(Date.now() / 1000) + (tokens.expires_in as number),
    refreshToken: (tokens.refresh_token as string | undefined) ?? refreshToken,
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/spreadsheets.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = process.env.ALLOWED_EMAILS
        ? process.env.ALLOWED_EMAILS.split(",").map((e) => e.trim())
        : []
      const allowedDomain = process.env.ALLOWED_DOMAIN

      if (allowedEmails.length === 0 && !allowedDomain) return true

      const email = user.email ?? ""
      if (allowedEmails.includes(email)) return true
      if (allowedDomain && email.endsWith(`@${allowedDomain}`)) return true

      return "/login?error=AccessDenied"
    },

    async jwt({ token, account }) {
      // Initial sign in
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        }
      }

      // Token still valid
      if (Date.now() < (token.expiresAt ?? 0) * 1000 - 60_000) {
        return token
      }

      // Token expired — refresh
      try {
        const refreshed = await refreshAccessToken(token.refreshToken ?? "")
        return { ...token, ...refreshed }
      } catch {
        return { ...token, error: "RefreshAccessTokenError" }
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
}
