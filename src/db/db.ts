import Dexie, { type Table } from 'dexie'
import type { Vocab, Kanji, PracticeLog, Setting } from '../lib/types'

export class AppDB extends Dexie {
  vocab!: Table<Vocab, number>
  kanji!: Table<Kanji, string>
  practiceLogs!: Table<PracticeLog, number>
  settings!: Table<Setting, string>

  constructor() {
    super('tasin-jp-db')
    this.version(1).stores({
      vocab: '++id, word, hiragana, lesson, favorite, learned, createdAt',
      kanji: '&char',
      practiceLogs: '++id, vocabId, correct, at',
      settings: '&key',
    })
  }
}

export const db = new AppDB()