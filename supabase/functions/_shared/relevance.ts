/**
 * TF-IDF relevance scoring for signals against org themes.
 * Scores how relevant a signal (headline + summary) is to the org's
 * active_themes, competitor_names, and decision_maker_titles.
 *
 * Returns a normalised float 0.0–1.0.
 */

// Common English stopwords — excluded from theme matching so that themes like
// "AI for Enterprise" effectively become {ai, enterprise}.
const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','into','your','about','their',
  'have','has','had','was','were','are','will','would','could','should','can',
  'but','not','any','all','our','out','off','over','more','than','also','its',
  'how','why','who','what','when','where','which','they','them','you','his',
  'her','him','she','one','two','new','use','using','used','very','some',
  'small','medium','sized','teams','team','based','via','per',
  // Short particles that add noise when used as query terms
  'in','is','at','be','do','it','no','up','if','so','to','of','or','vs','by',
  'on','an','as','io','co','inc','ltd',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2) // keep short brand/acronym tokens like "ai", "ml"
}

/**
 * Extract the meaningful tokens from a theme phrase (lowercase, no stopwords).
 * "AI for Enterprise" → ["ai","enterprise"]
 */
export function themeTokens(theme: string): string[] {
  return tokenize(theme).filter(t => !STOPWORDS.has(t))
}

/**
 * Decide whether a signal should be tagged with a given theme.
 * Strategy (similar to most trend platforms):
 *   1. Whole phrase match → tag
 *   2. Otherwise: at least 1 keyword match if theme has 1-2 keywords,
 *      or ≥50 % of keywords for longer themes.
 */
export function matchesTheme(signalText: string, theme: string): boolean {
  const lowerText = signalText.toLowerCase()
  const lowerTheme = theme.toLowerCase().trim()
  if (!lowerTheme) return false
  if (lowerText.includes(lowerTheme)) return true

  const tokens = themeTokens(theme)
  if (!tokens.length) return false

  const hits = tokens.filter(tok => new RegExp(`\\b${tok}\\b`).test(lowerText)).length
  if (tokens.length <= 2) return hits >= 1
  return hits / tokens.length >= 0.5
}

function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1)
  }
  // Normalize by document length
  for (const [term, count] of freq.entries()) {
    freq.set(term, count / tokens.length)
  }
  return freq
}

/**
 * Score relevance of a signal against org keywords.
 *
 * @param headline - signal headline
 * @param summary - signal summary/body
 * @param themes - org active_themes array
 * @param keywords - additional keywords (competitor_names, decision_maker_titles)
 * @returns float 0.0–1.0
 */
export function scoreRelevance(
  headline: string,
  summary: string,
  themes: string[],
  keywords: string[],
): number {
  if (!headline && !summary) return 0
  if (!themes.length && !keywords.length) return 0.5

  const signalText = `${headline} ${headline} ${summary}` // double-weight headline
  const signalTokens = tokenize(signalText)
  const signalTF = termFrequency(signalTokens)

  // Build query token set from themes + keywords, filtering stopwords
  const queryTerms = new Set<string>()
  for (const phrase of [...themes, ...keywords]) {
    for (const token of tokenize(phrase)) {
      if (!STOPWORDS.has(token)) queryTerms.add(token)
    }
  }

  if (queryTerms.size === 0) return 0.5

  let matchedCount = 0
  let matchedScore = 0

  for (const term of queryTerms) {
    const tf = signalTF.get(term) ?? 0
    if (tf > 0) {
      matchedCount++
      // Each matched term contributes 0–1 based on how frequently it appears.
      // TF * 20: a term appearing once per 50 tokens (TF=0.02) → 0.4 contribution.
      matchedScore += Math.min(1.0, tf * 20)
    }
  }

  if (matchedCount === 0) return 0

  // coverage: fraction of query terms that appear in the signal (0–1)
  const coverage = matchedCount / queryTerms.size
  // intensity: average per-term TF score among matched terms (0–1)
  const intensity = matchedScore / matchedCount

  // Weighted combination: coverage drives the score, intensity refines it.
  // A relevant article matching 4/15 keywords with TF≈0.02 each → ~0.28 (HIGH).
  const raw = coverage * 0.7 + intensity * 0.3
  return Math.min(1.0, Math.max(0.0, raw))
}
