import type { Vocab } from './types'

export interface ParsedEntry {
  word: string
  hiragana: string
  romaji: string
  bangla: string
  english: string
}

export type PasteItem =
  | { kind: 'heading'; lesson: string; raw: string }
  | { kind: 'entry'; entry: ParsedEntry; lesson: string; raw: string }
  | { kind: 'error'; lesson: string; raw: string }

const KANA = '\\u3041-\\u309f\\u30a1-\\u30ff'
const ENTRY_RE = new RegExp(
  '^\\s*(.+?)\\s*[（(]\\s*([' +
    KANA +
    ']+)(?:\\s*[/／]\\s*([^)）]+?))?\\s*[)）]\\s*(?:[\u2013\u2014\u2015-]\\s*)?(.+?)\\s*[（(]\\s*([^)）]+?)\\s*[)）]\\s*$',
  'u',
)
const ENTRY_RE_SHORT = new RegExp(
  '^\\s*(.+?)\\s*[（(]\\s*([' +
    KANA +
    ']+)(?:\\s*[/／]\\s*([^)）]+?))?\\s*[)）]\\s*(?:[\u2013\u2014\u2015-]\\s*)?(.+)$',
  'u',
)

function stripBullet(line: string): string {
  const m = line.match(/^(?:[-•*▪●■▲△□○◎♥♣◆►●・]\s*|\d+\s*[.)、]\s*)/u)
  return m ? line.slice(m[0].length).trim() : line
}

export function parseBookmarkLine(raw: string): ParsedEntry | null {
  const line = raw.replace(/\u200b/g, '').trim()
  const blo = stripBullet(line)
  const m = blo.match(ENTRY_RE)
  if (m) {
    return {
      word: m[1].trim(),
      hiragana: m[2].trim(),
      romaji: m[3]?.trim() ?? '',
      bangla: m[4].trim(),
      english: m[5].trim(),
    }
  }
  const s = blo.match(ENTRY_RE_SHORT)
  if (s) {
    return {
      word: s[1].trim(),
      hiragana: s[2].trim(),
      romaji: s[3]?.trim() ?? '',
      bangla: s[4].trim(),
      english: '',
    }
  }
  return null
}

export function isHeadingLike(line: string): boolean {
  return !line.includes('(') && !line.includes('（')
}

export function parsePaste(text: string, defaultLesson: string): PasteItem[] {
  const items: PasteItem[] = []
  let lesson = defaultLesson.trim() || 'General'
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\u200b/g, '').trim()
    if (!line) continue
    const entry = parseBookmarkLine(line)
    if (entry) {
      items.push({ kind: 'entry', entry, lesson, raw: line })
    } else if (isHeadingLike(line)) {
      lesson = line
      items.push({ kind: 'heading', lesson: line, raw: line })
    } else {
      items.push({ kind: 'error', lesson, raw: line })
    }
  }
  return items
}

export function isKanjiChar(ch: string): boolean {
  const cp = ch.codePointAt(0)
  return !!cp && cp >= 0x4e00 && cp <= 0x9fff
}

export function extractKanji(text: string): string[] {
  const seen = new Set<string>()
  for (const ch of text) if (isKanjiChar(ch)) seen.add(ch)
  return [...seen]
}

export function entryToVocab(e: ParsedEntry, lesson: string): Vocab {
  return {
    word: e.word.trim(),
    hiragana: e.hiragana.trim(),
    romaji: e.romaji.trim(),
    bangla: e.bangla.trim(),
    english: e.english.trim(),
    lesson: lesson.trim() || 'General',
    favorite: false,
    learned: false,
    correctCount: 0,
    wrongCount: 0,
    createdAt: Date.now(),
  }
}