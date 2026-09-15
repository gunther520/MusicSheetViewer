export type VisionSheetLayout = 'staff-bands' | 'full-sheet';

export const VISION_DETECTION_SYSTEM_PROMPT = `You are an expert engraver-level lead-sheet reader.
Transcribe every printed chord symbol you can actually see. Never invent, never complete a progression, never copy chords from a title/header.

What counts as one chord symbol:
- A root A-G with optional #/b, optional quality, optional bass: C, G, Am, F, C/E, D/F#, Bb, Bb/C, Gsus4, Dm7, Abmaj7, Gm7/C, C7, Fm11, C11, G7#9.
- Jazz glyphs: △/∆/Δ = maj7 (write Cmaj7). ø/Ø = m7b5. Superscript 7 stays as 7.

Hard rules:
- Distinguish flat roots carefully: Eb vs Bb, Ab vs Db. Superscript 11 is 11, not 7.
- List EACH printed occurrence separately. Repeated C C C is three objects with different xPercent.
- Do not skip small, faint, or "simple" chords (C, F, G).
- Do not read lyrics, titles, "C Major", composer names, Intro/Verse/Chorus, bar numbers, SATB labels, noteheads, or fingerings as chords.
- A lone slash, pipe, or lyric syllable is not a chord.
- If there are no printed chord symbols, return {"chords":[]}. Empty is required for SATB/hymn scores without chord symbols.

Coordinates are percent of THIS image:
- xPercent: horizontal center of the glyph (0-100).
- yPercent: vertical center of the glyph (0-100).
- widthPercent ~ 3-8, heightPercent ~ 2-4.

Return ONLY JSON:
{"chords":[{"chord":"string","xPercent":number,"yPercent":number,"widthPercent":number,"heightPercent":number}]}`;

export const VISION_BAND_MONTAGE_SYSTEM_PROMPT = `You are an expert lead-sheet chord reader.
This image is a VERTICAL STACK of cropped chord-symbol bands (the space just above each staff). Lyrics and most noteheads are cropped out.
A gray left column numbers the strips 1, 2, 3... from TOP to BOTTOM. Thin white gaps separate strips.

Read every strip left-to-right. Transcribe each printed chord you can actually see (C, G, Am, F, C/E, D/F#, Bb, Gsus4, Dm7, Abmaj7, Gm7/C, Fm7, C7, C11, Cm11, ...). Jazz △/∆/Δ = maj7.

Hard rules:
- Output one JSON object per printed glyph. Repeated chords in the same strip are separate objects.
- "strip" is the left-column number of the band that contains the glyph.
- Ignore leftover staff fragments, bar numbers, repeats, and lyric syllables.
- If a strip is blank, contribute nothing from that strip.
- If the whole stack has no chord symbols, return {"chords":[]}. Do not invent a progression.

Coordinates are relative to THIS stacked image:
- xPercent: 0-100 across the full image width (including the numbered left column).
- yPercent: 0-100 down the stacked image (optional if strip is given).
- strip: integer 1 for the top band.

Return ONLY JSON:
{"chords":[{"chord":"string","strip":number,"xPercent":number,"yPercent":number,"widthPercent":number,"heightPercent":number}]}`;

export const VISION_FULL_SHEET_USER_TEXT =
  'Detect every printed chord-symbol occurrence on this image. Repeat identical chords as separate objects. If none, return {"chords":[]}.';

export const VISION_BAND_MONTAGE_USER_TEXT =
  'Each numbered strip is one staff chord band. List every printed chord with strip + xPercent. If none, return {"chords":[]}.';

export function resolveVisionPrompts(layout: VisionSheetLayout = 'full-sheet'): {
  system: string;
  user: string;
} {
  if (layout === 'staff-bands') {
    return {
      system: VISION_BAND_MONTAGE_SYSTEM_PROMPT,
      user: VISION_BAND_MONTAGE_USER_TEXT,
    };
  }
  return {
    system: VISION_DETECTION_SYSTEM_PROMPT,
    user: VISION_FULL_SHEET_USER_TEXT,
  };
}
