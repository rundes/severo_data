"use client"

import { useState } from "react"
import { driveThumbUrl } from "@/lib/columnMatcher"

interface Props {
  /** Raw cell values (Drive URLs, direct image URLs, etc.) */
  urls: string[]
  title?: string
  badge?: string
}

function Thumb({ src, idx, onClick }: { src: string; idx: number; onClick: () => void }) {
  const [err, setErr] = useState(false)
  if (err) return null
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-xl bg-gray-100 aspect-square group border border-gray-200 hover:border-sky-400 transition-all shadow-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Foto ${idx + 1}`}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        onError={() => setErr(true)}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
        </svg>
      </div>
    </button>
  )
}

export default function ImageGallery({ urls, title = "Fotos del relevamiento", badge }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Convert raw URLs to thumbnail URLs, deduplicate
  const thumbs = [...new Set(
    urls.map(u => driveThumbUrl(u, 600)).filter((u): u is string => u !== null)
  )]

  if (!thumbs.length) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{thumbs.length} imagen{thumbs.length !== 1 ? "es" : ""}</p>
        </div>
        {badge && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {thumbs.map((src, i) => (
          <Thumb key={i} src={src} idx={i} onClick={() => setLightbox(src)} />
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.replace(/sz=w\d+/, "sz=w1200")}
              alt="Vista ampliada"
              className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            {/* Navigation */}
            {thumbs.length > 1 && (() => {
              const ci = thumbs.indexOf(lightbox)
              const prev = thumbs[(ci - 1 + thumbs.length) % thumbs.length]
              const next = thumbs[(ci + 1) % thumbs.length]
              return (
                <>
                  <button
                    onClick={() => setLightbox(prev)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setLightbox(next)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                  <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/70 text-xs">
                    {ci + 1} / {thumbs.length}
                  </p>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
