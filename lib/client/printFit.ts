// The printable area of an A4 page with the 12mm margins set in app/globals.css, in CSS pixels.
const MM_TO_PX = 96 / 25.4;
export const PRINT_AREA = { width: (210 - 24) * MM_TO_PX, height: (297 - 24) * MM_TO_PX };

// Below this the text is too small to read across a table; a longer report then runs onto a
// second page instead of shrinking further.
export const MIN_PRINT_SCALE = 0.8;

// Leaves room for the small differences between this measurement and the print layout.
const SAFETY = 0.97;

// How much to shrink a report of this height so it fits one page: 1 when it already fits.
export function printScale(contentHeight: number, pageHeight: number = PRINT_AREA.height): number {
  const available = pageHeight * SAFETY;
  if (contentHeight <= available) {
    return 1;
  }
  return Math.max(MIN_PRINT_SCALE, Math.floor((available / contentHeight) * 100) / 100);
}
