// The one quote matcher: verification decides status with it, and the evidence panel uses the
// same match to highlight the quote, so the two can never disagree.

export const MIN_QUOTE_LENGTH = 20;

const KEEP = /[\p{L}\p{M}\p{N}]/u;

// NFC first so a decomposed "é" matches a composed one; marks stay attached to their letters.
export function normaliseForMatching(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

type Normalised = { text: string; origin: number[] };

// Same rules as normaliseForMatching, keeping for each output character its index in `source`.
function normaliseWithOrigin(source: string): Normalised {
  let text = "";
  const origin: number[] = [];
  let index = 0;
  for (const character of source) {
    if (KEEP.test(character)) {
      for (const lower of character.toLowerCase()) {
        text += lower;
        origin.push(index);
      }
    } else if (text !== "" && !text.endsWith(" ")) {
      text += " ";
      origin.push(index);
    }
    index += character.length;
  }
  return text.endsWith(" ") ? { text: text.slice(0, -1), origin: origin.slice(0, -1) } : { text, origin };
}

export type QuoteSpan = { text: string; start: number; end: number };

// Finds the quote in `content` as whole words. Returns the NFC text with the span's start and
// end in it, or null when the quote is too short or not there.
export function findQuoteSpan(content: string, quote: string): QuoteSpan | null {
  const needle = normaliseForMatching(quote);
  if (needle.length < MIN_QUOTE_LENGTH) {
    return null;
  }
  const text = content.normalize("NFC");
  const haystack = normaliseWithOrigin(text);
  // Padded with spaces so a quote only matches whole words, never part of a longer word.
  const position = ` ${haystack.text} `.indexOf(` ${needle} `);
  if (position === -1) {
    return null;
  }
  const lastIndex = haystack.origin[position + needle.length - 1];
  const lastCharacter = String.fromCodePoint(text.codePointAt(lastIndex) ?? 0);
  return { text, start: haystack.origin[position], end: lastIndex + lastCharacter.length };
}
