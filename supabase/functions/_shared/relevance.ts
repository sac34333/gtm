/**
 * TF-IDF relevance scoring for signals against org themes.
 * Scores how relevant a signal (headline + summary) is to the org's
 * active_themes, competitor_names, and decision_maker_titles.
 *
 * Returns a normalised float 0.0–1.0.
 */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2)
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
