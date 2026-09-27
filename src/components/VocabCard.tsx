import type { Vocab } from '../lib/types'
import { db } from '../db/db'
import { useDisplayPrefs } from '../lib/settings'
import SpeakButton from './Speak'

export default function VocabCard({ v }: { v: Vocab }) {
  const { showBangla, showEnglish } = useDisplayPrefs()
  const attempts = v.correctCount + v.wrongCount
  const acc = attempts > 0 ? Math.round((v.correctCount / attempts) * 100) : null
  const speakText = v.hiragana || v.word

  return (
    <article className="paper-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <button
          onClick={() => db.vocab.update(v.id!, { favorite: !v.favorite })}
          className="mt-0.5 text-xl transition-transform hover:scale-125"
          title="Favorite"
          aria-label="Favorite"
        >
          {v.favorite ? '⭐' : '☆'}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="jp text-4xl font-bold tracking-wide text-black sm:text-5xl">
              {v.word}
            </h3>
            <span className="text-base text-amber-800">{v.hiragana}</span>
            {v.romaji && <span className="text-sm text-red-800/70">{v.romaji}</span>}
            <SpeakButton text={speakText} className="h-6 w-6" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="chip bg-amber-100 text-amber-900">📖 {v.lesson}</span>
            {attempts > 0 && (
              <span className="chip bg-emerald-100 text-emerald-800">✓ {v.correctCount}</span>
            )}
            {v.wrongCount > 0 && (
              <span className="chip bg-rose-100 text-rose-800">✗ {v.wrongCount}</span>
            )}
            {acc !== null && <span className="chip bg-sky-100 text-sky-800">{acc}%</span>}
          </div>
        </div>
        <button
          onClick={() => db.vocab.update(v.id!, { learned: !v.learned })}
          className={`rounded-xl px-2 py-1 text-xs font-bold transition-colors ${
            v.learned ? 'bg-emerald-600 text-white' : 'bg-amber-200 text-amber-900 hover:bg-amber-300'
          }`}
          title={v.learned ? 'Learned' : 'Mark learned'}
        >
          {v.learned ? '✔ Learned' : 'Learn'}
        </button>
      </div>
      <hr className="my-3 border-dashed border-amber-200" />
      <div className="space-y-1">
        {showBangla && <div className="text-lg font-semibold text-ink">{v.bangla}</div>}
        {showEnglish && v.english && (
          <div className="text-sm italic text-amber-800/80">{v.english}</div>
        )}
      </div>
    </article>
  )
}