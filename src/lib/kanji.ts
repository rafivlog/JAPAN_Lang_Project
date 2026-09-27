import type { Kanji, KanjiExample } from './types'
import { db } from '../db/db'
import { extractKanji } from './parser'

interface KanjiApiResult {
  kanji: string
  grade?: number | null
  stroke_count?: number | null
  meanings?: string[] | null
  readings_on?: string[] | null
  readings_kun?: string[] | null
  readings_ja_on?: string[] | null
  readings_ja_kun?: string[] | null
  jlpt?: number | null
  jlpt_new?: number | null
}

async function fetchKanjiApi(char: string): Promise<Kanji | null> {
  try {
    const res = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(char)}`)
    if (!res.ok) return null
    const d: KanjiApiResult = await res.json()
    return {
      char,
      meanings: d.meanings ?? [],
      kunReadings: d.readings_kun ?? [],
      onReadings: d.readings_on ?? [],
      strokeCount: d.stroke_count ?? undefined,
      grade: d.grade ?? undefined,
      jlpt: d.jlpt_new ?? d.jlpt ?? null,
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}

export async function syncKanji(
  chars: string[],
  onProgress?: (done: number, total: number, char: string) => void,
): Promise<{ fetched: number; total: number }> {
  let fetched = 0
  const list = [...new Set(chars)].filter((c) => c.trim())
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    const existing = await db.kanji.get(c)
    if (!existing) {
      const d = await fetchKanjiApi(c)
      if (d) {
        await db.kanji.put(d)
        fetched++
      } else {
        await db.kanji.put({
          char: c,
          meanings: [],
          kunReadings: [],
          onReadings: [],
          fetchedAt: Date.now(),
          fetchError: true,
        })
      }
    }
    onProgress?.(i + 1, list.length, c)
  }
  return { fetched, total: list.length }
}

export async function syncKanjiFromVocab(
  onProgress?: (done: number, total: number, char: string) => void,
): Promise<{ fetched: number; total: number }> {
  const vocab = await db.vocab.toArray()
  const chars = new Set<string>()
  for (const v of vocab) extractKanji(v.word).forEach((c) => chars.add(c))
  const r = await syncKanji([...chars], onProgress)
  await refreshKanjiExamples()
  return r
}

export async function refreshKanjiExamples(): Promise<void> {
  const vocab = await db.vocab.toArray()
  const map = new Map<string, KanjiExample[]>()
  for (const v of vocab) {
    for (const c of extractKanji(v.word)) {
      const arr = map.get(c) ?? []
      if (!arr.some((e) => e.word === v.word)) {
        arr.push({ word: v.word, hiragana: v.hiragana, bangla: v.bangla, english: v.english })
      }
      map.set(c, arr)
    }
  }
  const kanji = await db.kanji.toArray()
  for (const k of kanji) {
    const examples = (map.get(k.char) ?? []).slice(0, 3)
    const bengali = [
      ...new Set(
        (map.get(k.char) ?? []).map((e) => e.bangla).filter(Boolean),
      ),
    ].slice(0, 3)
    const changed =
      JSON.stringify(examples) !== JSON.stringify(k.examples ?? []) ||
      JSON.stringify(bengali) !== JSON.stringify(k.bengali ?? [])
    if (changed) await db.kanji.update(k.char, { examples, bengali })
  }
}

export function jlptLabel(k: Kanji): string {
  if (k.jlpt && k.jlpt <= 5) return `N${k.jlpt}`
  return '—'
}