// ============================================================================
// Fuzzy client-name matching.
//
// Used in two places:
//   1. Power BI sync — matching rows from the sales dataset to clients in our
//      database ("ACME PASTA CO LTD" ↔ "Acme Pasta Co").
//   2. Spoken meetings — finding which client a rep is talking about inside a
//      voice transcript ("just met with maria from acme pasta …").
//
// Pure functions only — no I/O.
// ============================================================================

// Legal / filler suffixes that carry no identity ("Acme Pasta Co Ltd" = "Acme Pasta").
const STOP_WORDS = new Set([
  "ltd",
  "limited",
  "plc",
  "llp",
  "llc",
  "inc",
  "co",
  "company",
  "group",
  "holdings",
  "uk",
  "the",
  "and",
  "srl",
  "spa",
  "gmbh",
]);

/** Lowercase, strip accents & punctuation, drop legal suffixes. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (café → cafe)
    .replace(/[&+]/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t))
    .join(" ");
}

function tokens(normalized: string): string[] {
  return normalized ? normalized.split(" ") : [];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 0–1 string similarity (1 = identical) on normalized names. */
function editSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  return 1 - levenshtein(a, b) / max;
}

/** 0–1 token-overlap similarity (order-insensitive). */
function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let overlap = 0;
  for (const t of a) if (setB.has(t)) overlap++;
  return (2 * overlap) / (a.length + b.length);
}

/**
 * Similarity between two client names, 0–1. Takes the best of whole-string
 * edit distance and token overlap, so both misspellings ("Bella Fods") and
 * reorderings / extra words ("Bella Foods Distribution") score well.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokens(na);
  const tb = tokens(nb);
  let best = Math.max(editSimilarity(na, nb), tokenSimilarity(ta, tb));
  // "Bicester Village" should strongly match "Bicester Village (La Tua
  // Pasta)": when one name extends the other, compare against the leading
  // words too (slightly discounted so exact full names still win). Needs at
  // least two tokens so single common words can't hijack long names.
  if (tb.length > ta.length && ta.length >= 2) {
    best = Math.max(best, editSimilarity(na, tb.slice(0, ta.length).join(" ")) * 0.95);
  } else if (ta.length > tb.length && tb.length >= 2) {
    best = Math.max(best, editSimilarity(ta.slice(0, tb.length).join(" "), nb) * 0.95);
  }
  return best;
}

export interface NameMatch<T> {
  candidate: T;
  score: number;
}

/** Rank `candidates` by similarity to `query`, best first. */
export function rankMatches<T>(
  query: string,
  candidates: T[],
  getName: (c: T) => string,
  minScore = 0.4,
): NameMatch<T>[] {
  return candidates
    .map((candidate) => ({ candidate, score: nameSimilarity(query, getName(candidate)) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/**
 * Find which of `candidates` is mentioned inside free text (e.g. a meeting
 * transcript). For each candidate name of k tokens we slide a window of
 * k-1 … k+1 tokens across the text and keep the best window similarity.
 */
export function findNameInText<T>(
  text: string,
  candidates: T[],
  getName: (c: T) => string,
  minScore = 0.55,
): NameMatch<T>[] {
  const textTokens = tokens(normalizeName(text));
  if (textTokens.length === 0) return [];

  const results: NameMatch<T>[] = [];
  for (const candidate of candidates) {
    const nameNorm = normalizeName(getName(candidate));
    const nameTokens = tokens(nameNorm);
    if (nameTokens.length === 0) continue;
    // Names that normalize to almost nothing (e.g. "A&CO LIMITED" → "a")
    // would match random words in any sentence — skip them here; they can
    // still be found by typing in the search box.
    if (nameNorm.replace(/\s/g, "").length < 4) continue;

    // People rarely say a company's full registered name — try the full name
    // AND its leading words ("Bicester Village" for "Bicester Village (La
    // Tua Pasta)"), slightly discounting prefix-only matches.
    const targets: { toks: string[]; weight: number }[] = [{ toks: nameTokens, weight: 1 }];
    for (const len of [2, 3]) {
      if (nameTokens.length > len) targets.push({ toks: nameTokens.slice(0, len), weight: 0.95 });
    }

    let best = 0;
    for (const target of targets) {
      const tNorm = target.toks.join(" ");
      const sizes = new Set(
        [target.toks.length - 1, target.toks.length, target.toks.length + 1].filter((s) => s >= 1),
      );
      for (const size of sizes) {
        for (let i = 0; i + size <= textTokens.length; i++) {
          const window = textTokens.slice(i, i + size);
          const sim =
            Math.max(
              editSimilarity(window.join(" "), tNorm),
              tokenSimilarity(window, target.toks),
            ) * target.weight;
          if (sim > best) best = sim;
          if (best >= 1) break;
        }
        if (best >= 1) break;
      }
      if (best >= 1) break;
    }
    if (best >= minScore) results.push({ candidate, score: best });
  }
  return results.sort((a, b) => b.score - a.score);
}
