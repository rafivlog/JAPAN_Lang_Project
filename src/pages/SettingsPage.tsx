import { useRef, useState } from 'react'
import { db } from '../db/db'
import { setSetting, useSetting } from '../lib/settings'
import { syncKanjiFromVocab } from '../lib/kanji'
import { parsePaste, entryToVocab } from '../lib/parser'
import { SAMPLE_IMPORT } from '../lib/sample'

interface BackupFile {
  app?: string
  version?: number
  exportedAt?: string
  vocab?: unknown[]
  kanji?: unknown[]
  practiceLogs?: unknown[]
  settings?: unknown[]
}

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const showBangla = useSetting('showBangla', true)
  const showEnglish = useSetting('showEnglish', true)
  const defaultLesson = useSetting('defaultLesson', '')

  async function exportBackup() {
    const data: BackupFile = {
      app: 'tasin-jp',
      version: 1,
      exportedAt: new Date().toISOString(),
      vocab: await db.vocab.toArray(),
      kanji: await db.kanji.toArray(),
      practiceLogs: await db.practiceLogs.toArray(),
      settings: await db.settings.toArray(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasinjp-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setMsg({ ok: true, text: '✅ Backup exported.' })
  }

  async function importBackup(file: File) {
    try {
      const raw = await file.text()
      const data: BackupFile = JSON.parse(raw)
      if (!data || !Array.isArray(data.vocab)) {
        setMsg({ ok: false, text: '❌ Not a valid TASIN JP backup file.' })
        return
      }
      const all = await db.vocab.toArray()
      const have = new Set(all.map((v) => `${v.word}|${v.hiragana}`))
      let added = 0
      let skipped = 0
      let kanjiAdded = 0
      for (const row of data.vocab ?? []) {
        const v = row as Record<string, unknown>
        const word = String(v.word ?? '')
        const hiragana = String(v.hiragana ?? '')
        if (!word || !hiragana) continue
        const key = `${word}|${hiragana}`
        if (have.has(key)) {
          skipped++
          continue
        }
        await db.vocab.add({
          word,
          hiragana,
          romaji: String(v.romaji ?? ''),
          bangla: String(v.bangla ?? ''),
          english: String(v.english ?? ''),
          lesson: String(v.lesson ?? 'General'),
          favorite: Boolean(v.favorite),
          learned: Boolean(v.learned),
          correctCount: Number(v.correctCount ?? 0),
          wrongCount: Number(v.wrongCount ?? 0),
          createdAt: Number(v.createdAt ?? Date.now()),
        })
        have.add(key)
        added++
      }
      const haveKanji = new Set((await db.kanji.toArray()).map((k) => k.char))
      for (const row of data.kanji ?? []) {
        const k = row as Record<string, unknown>
        const char = String(k.char ?? '')
        if (!char || haveKanji.has(char)) continue
        await db.kanji.add({
          char,
          meanings: Array.isArray(k.meanings) ? (k.meanings as string[]) : [],
          kunReadings: Array.isArray(k.kunReadings) ? (k.kunReadings as string[]) : [],
          onReadings: Array.isArray(k.onReadings) ? (k.onReadings as string[]) : [],
          strokeCount: Number(k.strokeCount) || undefined,
          grade: Number(k.grade) || undefined,
          jlpt: k.jlpt == null ? null : Number(k.jlpt),
          fetchedAt: Number(k.fetchedAt ?? Date.now()),
        })
        haveKanji.add(char)
        kanjiAdded++
      }
      await syncKanjiFromVocab()
      setMsg({
        ok: true,
        text: `✅ Imported ${added} word(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ''}, ${kanjiAdded} kanji; kanji synced.`,
      })
    } catch {
      setMsg({ ok: false, text: '❌ Import failed — invalid JSON.' })
    }
  }

  async function restoreSample() {
    const items = parsePaste(SAMPLE_IMPORT, defaultLesson)
    const entries = items.filter((p): p is Extract<typeof p, { kind: 'entry' }> => p.kind === 'entry')
    const all = await db.vocab.toArray()
    const have = new Set(all.map((v) => `${v.word}|${v.hiragana}`))
    const toAdd = entries
      .filter((p) => !have.has(`${p.entry.word}|${p.entry.hiragana}`))
      .map((p) => entryToVocab(p.entry, p.lesson))
    if (toAdd.length) await db.vocab.bulkAdd(toAdd)
    await syncKanjiFromVocab()
    setMsg({
      ok: true,
      text: toAdd.length
        ? `✅ Sample restored: ${toAdd.length} words added.`
        : '✅ Sample words already present.',
    })
  }

  async function clearAll() {
    if (!window.confirm('Delete ALL vocabulary, kanji cache and practice history? This cannot be undone.')) return
    await db.vocab.clear()
    await db.kanji.clear()
    await db.practiceLogs.clear()
    await db.settings.clear()
    setMsg({ ok: true, text: '🗑 All data cleared.' })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="jp text-3xl font-bold text-red-900">Settings ⚙️</h1>
        <p className="mt-1 text-sm text-amber-800/80">
          Preferences, backup & data management.
        </p>
      </header>

      {msg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <section className="paper-card space-y-4 p-5">
        <h2 className="font-bold text-amber-900">🖼 Display</h2>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Show Bangla meaning</span>
          <input
            type="checkbox"
            checked={showBangla}
            onChange={(e) => setSetting('showBangla', e.target.checked)}
            className="h-5 w-5 accent-red-900"
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Show English meaning</span>
          <input
            type="checkbox"
            checked={showEnglish}
            onChange={(e) => setSetting('showEnglish', e.target.checked)}
            className="h-5 w-5 accent-red-900"
          />
        </label>
        <div>
          <label className="label">Default lesson for imports</label>
          <input
            className="input mt-1"
            value={defaultLesson}
            onChange={(e) => setSetting('defaultLesson', e.target.value)}
            placeholder="e.g. Lesson 3"
          />
        </div>
      </section>

      <section className="paper-card space-y-4 p-5">
        <h2 className="font-bold text-amber-900">💾 Backup</h2>
        <p className="text-sm text-amber-800/70">
          Everything lives in your browser. Export a JSON file to keep or move your data, and import
          it again later.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={exportBackup}>
            ⬇︎ Export JSON
          </button>
          <button className="btn btn-amber" onClick={() => fileRef.current?.click()}>
            ⬆︎ Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importBackup(f)
              e.target.value = ''
            }}
          />
        </div>
        <button className="btn btn-ghost" onClick={restoreSample}>
          ✨ Restore sample vocabulary
        </button>
      </section>

      <section className="paper-card space-y-3 border-rose-200 p-5">
        <h2 className="font-bold text-rose-700">⚠ Danger zone</h2>
        <p className="text-sm text-amber-800/70">
          Delete all words, kanji cache, practice history and settings.
        </p>
        <button className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={clearAll}>
          🗑 Clear all data
        </button>
      </section>

      <p className="text-xs text-amber-800/50">
        Kanji data is fetched from <b>kanjiapi.dev</b> and cached in IndexedDB, so the app keeps your
        notes readable even offline.
      </p>
    </div>
  )
}