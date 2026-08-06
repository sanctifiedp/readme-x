/**
 * Local (no external AI) similarity scoring for question-bank duplicate detection.
 *
 * Deliberately provider-agnostic: `compareQuestions` is the only entry point the
 * rest of the app uses, so an embedding/AI based scorer can be swapped in later
 * without touching callers or the UI.
 */

export interface QuestionLike {
  id?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  hasImage?: boolean;
}

export const SIMILARITY_THRESHOLD = 0.72;

const STOPWORDS = new Set([
  "the", "a", "an", "of", "is", "are", "was", "were", "to", "in", "on", "for",
  "and", "or", "which", "what", "that", "this", "these", "those", "as", "by",
  "be", "it", "its", "at", "from", "with", "following", "not",
]);

export function normalizeText(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(input: string): string[] {
  return normalizeText(input).split(" ").filter((t) => t && !STOPWORDS.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((v) => { if (b.has(v)) inter++; });
  return inter / (a.size + b.size - inter);
}

function trigrams(input: string): Set<string> {
  const s = ` ${normalizeText(input)} `;
  const out = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
}

/** Sorensen-Dice on character trigrams — good at catching re-worded phrasing. */
function dice(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.size && !tb.size) return 1;
  let inter = 0;
  ta.forEach((v) => { if (tb.has(v)) inter++; });
  return (2 * inter) / (ta.size + tb.size);
}

export function textSimilarity(a: string, b: string): number {
  const word = jaccard(new Set(tokens(a)), new Set(tokens(b)));
  return Math.max(word, dice(a, b));
}

function optionsSimilarity(a: string[], b: string[]): number {
  const na = new Set(a.map(normalizeText).filter(Boolean));
  const nb = new Set(b.map(normalizeText).filter(Boolean));
  return jaccard(na, nb);
}

export interface SimilarityBreakdown {
  score: number;          // 0..1
  promptScore: number;
  optionsScore: number;
  sameCorrectAnswer: boolean;
  sameImagePresence: boolean;
}

export function compareQuestions(a: QuestionLike, b: QuestionLike): SimilarityBreakdown {
  const promptScore = textSimilarity(a.prompt, b.prompt);
  const optionsScore = optionsSimilarity(a.options, b.options);

  const correctA = normalizeText(a.options[a.correctIndex] ?? "");
  const correctB = normalizeText(b.options[b.correctIndex] ?? "");
  const sameCorrectAnswer = !!correctA && correctA === correctB;
  const sameImagePresence = !!a.hasImage === !!b.hasImage;

  const score =
    0.62 * promptScore +
    0.26 * optionsScore +
    0.08 * (sameCorrectAnswer ? 1 : 0) +
    0.04 * (sameImagePresence ? 1 : 0);

  return {
    score: Math.min(1, score),
    promptScore,
    optionsScore,
    sameCorrectAnswer,
    sameImagePresence,
  };
}

/** Highlight helper: words present in one question but not the other. */
export function diffWords(a: string, b: string): { onlyA: string[]; onlyB: string[] } {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const onlyA: string[] = [];
  const onlyB: string[] = [];
  ta.forEach((t) => { if (!tb.has(t)) onlyA.push(t); });
  tb.forEach((t) => { if (!ta.has(t)) onlyB.push(t); });
  return { onlyA, onlyB };
}
