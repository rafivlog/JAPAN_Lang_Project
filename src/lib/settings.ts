import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function useSetting<T>(key: string, fallback: T): T {
  const rows = useLiveQuery(() => db.settings.toArray(), []) ?? []
  const row = rows.find((r) => r.key === key)
  return (row?.value as T) ?? fallback
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

export function useDisplayPrefs() {
  return {
    showBangla: useSetting('showBangla', true),
    showEnglish: useSetting('showEnglish', true),
  }
}