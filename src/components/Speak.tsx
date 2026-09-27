import { useState } from 'react'

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = 0.85
  const vs = window.speechSynthesis.getVoices()
  const jp = vs.find((v) => v.lang === 'ja-JP') ?? vs.find((v) => v.lang.toLowerCase().startsWith('ja'))
  if (jp) u.voice = jp
  window.speechSynthesis.speak(u)
}

export default function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  const [ok] = useState(() => 'speechSynthesis' in window)
  if (!ok) return null
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        speak(text)
      }}
      title="উচ্চারণ শুনুন"
      aria-label="Pronounce"
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm text-amber-900 transition-transform hover:scale-110 active:scale-95 ${className}`}
    >
      🔊
    </button>
  )
}