import changelogRaw from '../../../CHANGELOG.md?raw'

export interface ChangelogEntry {
  version: string
  date: string
  summary: string
}

const ENTRY_RE = /^## \[([\d.]+)\] - (\d{4}-\d{2}-\d{2})\n\n([\s\S]*?)(?=\n## \[|\s*$)/gm

let cached: ChangelogEntry[] | undefined

function parseChangelog(): ChangelogEntry[] {
  if (cached) return cached
  const entries: ChangelogEntry[] = []
  for (const match of changelogRaw.matchAll(ENTRY_RE)) {
    entries.push({ version: match[1], date: match[2], summary: match[3].trim() })
  }
  cached = entries
  return entries
}

/** Sürüm bildirimi için CHANGELOG.md metnini kısaltıp markdown vurgu işaretlerini temizler. */
export function getShortChangelogSummary(version: string, maxLength = 220): string | undefined {
  const entry = parseChangelog().find((e) => e.version === version)
  if (!entry) return undefined
  const clean = entry.summary.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  return clean.length > maxLength ? `${clean.slice(0, maxLength).trim()}…` : clean
}
