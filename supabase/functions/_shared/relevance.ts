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

  // Build query token set from themes + keywords
  const queryTerms = new Set<string>()
  for (const phrase of [...themes, ...keywords]) {
    for (const token of tokenize(phrase)) {
      queryTerms.add(token)
    }
  }

  if (queryTerms.size === 0) return 0.5

  let matchedWeight = 0
  let totalWeight = 0

  for (const term of queryTerms) {
    const tf = signalTF.get(term) ?? 0
    // Inverse document frequency approximation: rare terms get higher weight
    const idf = 1 + Math.log(1 + tf)
    totalWeight += idf
    if (tf > 0) {
      matchedWeight += idf * tf * 10 // scale for visibility
    }
  }

  if (totalWeight === 0) return 0

  const raw = matchedWeight / totalWeight
  // Normalize to 0–1 with sigmoid-like clamping
  return Math.min(1.0, Math.max(0.0, raw))
}
