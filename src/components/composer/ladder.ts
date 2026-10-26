// S-01 · Reminder ladder and tone pre-selection (D-38 as amended by D-41).
// Pure and client-safe: the server computes the pre-selection with these functions when the
// composer opens, and the client uses the same tone ↔ level mapping for the segmented choice.

export type Tone = "gentle" | "direct" | "formal";
export type Level = 1 | 2 | 3;

/** S01-SEG-TONE, in ladder order. Level k is TONES[k - 1]. */
export const TONES: readonly { value: Tone; label: string; level: Level }[] = [
  { value: "gentle", label: "Gentle", level: 1 },
  { value: "direct", label: "Direct", level: 2 },
  { value: "formal", label: "Formal", level: 3 },
];

export function toneForLevel(level: Level): Tone {
  return TONES[level - 1].value;
}

export function levelForTone(tone: Tone): Level {
  return TONES.find((option) => option.value === tone)!.level;
}

/** `landlord.ladder_days`: three ascending day counts after `due_on` (D-09, D-20). */
export type LadderDays = readonly [number, number, number];

/** Validates the column shape (D-20: three integers, ascending, 1–60). Null when malformed. */
export function parseLadderDays(value: unknown): LadderDays | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const days = value.map(Number);
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 60)) return null;
  if (!(days[0] < days[1] && days[1] < days[2])) return null;
  return [days[0], days[1], days[2]];
}

/**
 * D-38 ladder by days overdue alone: below day₂ (including before the due date and days 1–2)
 * → 1 Gentle; ≥ day₂ → 2 Direct; ≥ day₃ → 3 Formal. day₁ is the first Gentle step, so it does
 * not change the level.
 */
export function levelByDays(daysOverdue: number, ladderDays: LadderDays): Level {
  if (daysOverdue >= ladderDays[2]) return 3;
  if (daysOverdue >= ladderDays[1]) return 2;
  return 1;
}

/**
 * D-41: the pre-selected level is capped by confirmed contacts.
 * `contacts` counts `message` rows of kind `rent_reminder` or `call` for the rent entry, which
 * exist only after "Did you send it?" → Yes or a saved logged call. A tenant who has received
 * nothing gets Gentle wording however late the rent is.
 */
export function preselectLevel(input: {
  daysOverdue: number;
  ladderDays: LadderDays;
  contacts: number;
}): Level {
  const byDays = levelByDays(input.daysOverdue, input.ladderDays);
  const bySequence = Math.max(1, Math.floor(input.contacts) + 1);
  return Math.min(byDays, bySequence) as Level;
}
