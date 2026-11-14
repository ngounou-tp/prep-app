// Two sites reporting the same fact on the same day make one development, reported twice: that is
// what lets a claim reach Verified when the model cited one site per claim. Code decides, from the
// two claims' words, and conservatively: both quotes found in their sources, the same date, the same
// numbers, the same negation, and nearly every word of the shorter claim in the longer one.
import { normaliseForMatching } from "@/lib/shared/quoteMatch";

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "to", "in", "on", "at", "for", "and", "or", "as", "by", "with", "its", "it",
  "is", "was", "were", "be", "been", "has", "have", "had", "will", "would", "that", "this", "from",
  "their", "his", "her", "s", "also", "who", "which",
]);
const NEGATIONS = new Set(["not", "no", "never", "denied", "denies", "without"]);
const TITLES: [RegExp, string][] = [
  [/\bchief executive officer\b/g, "ceo"],
  [/\bchief financial officer\b/g, "cfo"],
  [/\bchief operating officer\b/g, "coo"],
  [/\bchief technology officer\b/g, "cto"],
];
const MIN_WORDS = 4;
const MIN_SHARED = 0.8;

type FactClaim = { text: string; date: string | null; quoteSourceId: string | null };

export function factWords(text: string): Set<string> {
  const normalised = TITLES.reduce((current, [title, short]) => current.replace(title, short), normaliseForMatching(text));
  return new Set(normalised.split(" ").filter((word) => word !== "" && !STOP_WORDS.has(word)));
}

function isNumber(word: string): boolean {
  return /\p{N}/u.test(word);
}

function negated(words: ReadonlySet<string>): boolean {
  return [...words].some((word) => NEGATIONS.has(word));
}

export function sameFact(first: FactClaim, second: FactClaim): boolean {
  if (first.quoteSourceId === null || second.quoteSourceId === null || first.date === null || first.date !== second.date) {
    return false;
  }
  const firstWords = factWords(first.text);
  const secondWords = factWords(second.text);
  const [shorter, longer] = firstWords.size <= secondWords.size ? [firstWords, secondWords] : [secondWords, firstWords];
  if (shorter.size < MIN_WORDS || negated(shorter) !== negated(longer)) {
    return false;
  }
  if (![...shorter].filter(isNumber).every((number) => longer.has(number))) {
    return false;
  }
  const shared = [...shorter].filter((word) => longer.has(word)).length;
  return shared / shorter.size >= MIN_SHARED;
}

// Each claim joins the first earlier one stating the same fact; `merge` combines the two.
export function mergeCorroborated<Claim extends FactClaim>(claims: readonly Claim[], merge: (kept: Claim, duplicate: Claim) => Claim): Claim[] {
  const kept: Claim[] = [];
  for (const claim of claims) {
    const index = kept.findIndex((existing) => sameFact(existing, claim));
    const existing = kept[index];
    if (existing === undefined) {
      kept.push(claim);
    } else {
      kept[index] = merge(existing, claim);
    }
  }
  return kept;
}
