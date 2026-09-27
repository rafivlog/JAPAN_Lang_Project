export interface Vocab {
  id?: number
  word: string
  hiragana: string
  romaji: string
  bangla: string
  english: string
  lesson: string
  favorite: boolean
  learned: boolean
  correctCount: number
  wrongCount: number
  createdAt: number
  lastPracticedAt?: number
}

export interface KanjiExample {
  word: string
  hiragana: string
  bangla: string
  english: string
}

export interface Kanji {
  char: string
  meanings: string[]
  kunReadings: string[]
  onReadings: string[]
  strokeCount?: number
  grade?: number
  jlpt?: number | null
  fetchedAt: number
  fetchError?: boolean
  bengali?: string[]
  examples?: KanjiExample[]
}

export type PracticeMode = 'jp-meaning' | 'meaning-jp' | 'jp-reading' | 'reading-jp'

export interface PracticeLog {
  id?: number
  vocabId: number
  mode: PracticeMode
  correct: boolean
  at: number
}

export interface Setting {
  key: string
  value: unknown
}