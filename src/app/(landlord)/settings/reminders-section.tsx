"use client";
// L15-SEC-REMINDERS †: L15-TBL-LADDER and L15-FLD-ESCDEFAULT. "Days are editable; the three
// levels are fixed" — Gentle, Direct and Formal are labels here, not choices (D-38, D-41). The
// saved days are what S-01 reads on its next open (src/server/settings getLadderDays, D-41).
import { useEffect, useState } from "react";

import { TextField } from "@/components/ui";
import {
  CHECK_FIELDS,
  LADDER_FIELDS,
  LADDER_LEVELS,
  escalationProblem,
  ladderRowProblem,
  parseReminders,
  type LandlordSettings,
  type RemindersField,
  type RemindersInput,
} from "@/lib/settings";

import { saveRemindersAction } from "./actions";
import { SettingsSection, useSectionSave } from "./_components/section";

type Days = [string, string, string];

function initialValues(settings: LandlordSettings): RemindersInput {
  return {
    ladderDays: settings.ladderDays.map(String) as Days,
    escalationDefaultPct: settings.escalationDefaultPct === null ? "" : String(settings.escalationDefaultPct),
  };
}

const same = (a: RemindersInput, b: RemindersInput) =>
  a.escalationDefaultPct.trim() === b.escalationDefaultPct.trim() &&
  a.ladderDays.every((d, i) => d.trim() === b.ladderDays[i].trim());

export function RemindersSection({
  settings,
  onDirtyChange,
}: {
  settings: LandlordSettings;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [baseline, setBaseline] = useState(() => initialValues(settings));
  const [values, setValues] = useState(baseline);
  const dirty = !same(values, baseline);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const { status, fieldErrors, save, edited } = useSectionSave<RemindersField>({
    save: async () => {
      const parsed = parseReminders(values);
      if (!parsed.ok) return { ok: false, error: CHECK_FIELDS, fieldErrors: parsed.fieldErrors };
      return saveRemindersAction(values);
    },
    onSaved: () => setBaseline(values),
  });

  const setDay = (index: 0 | 1 | 2, text: string) => {
    setValues((v) => {
      const ladderDays = [...v.ladderDays] as Days;
      ladderDays[index] = text.replace(/\D/g, "").slice(0, 2);
      return { ...v, ladderDays };
    });
    edited(LADDER_FIELDS[index]);
  };

  const saved = baseline.ladderDays.map((d) => Number(d));
  const savedMessage = `Saved. The next reminder you open uses day ${saved[0]} for Gentle, day ${saved[1]} for Direct and day ${saved[2]} for Formal.`;

  // A2 validates on blur. The ladder rows depend on each other ("Direct must start after
  // Gentle"), so a blur on any row re-checks every row already visited, and an error never goes
  // stale when the row above it changes.
  const [visited, setVisited] = useState<ReadonlySet<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<(string | null)[]>([null, null, null]);
  const blurRow = (index: number) => {
    const next = new Set(visited).add(index);
    setVisited(next);
    setRowErrors(([0, 1, 2] as const).map((j) => (next.has(j) ? ladderRowProblem(values.ladderDays, j) : null)));
  };

  return (
    <SettingsSection
      id="reminders"
      title="Reminders"
      description="When a rent reminder changes tone, counted in days after the rent due date."
      status={status}
      dirty={dirty}
      savedMessage={savedMessage}
      saveLabel="Save reminders"
      onSave={save}
    >
      <div className="flex flex-col gap-2">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Reminder ladder: the day each tone starts</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 text-label uppercase text-muted">
                Level
              </th>
              <th scope="col" className="py-2 pr-4 text-label uppercase text-muted">
                Tone
              </th>
              <th scope="col" className="py-2 text-label uppercase text-muted">
                Starts on day
              </th>
            </tr>
          </thead>
          <tbody>
            {LADDER_LEVELS.map((row, i) => {
              const index = i as 0 | 1 | 2;
              return (
                <tr key={row.level} className="border-b border-line align-top">
                  <td className="py-3 pr-4 text-body">
                    {row.level} of 3
                  </td>
                  <th scope="row" className="py-3 pr-4 font-normal text-ink">
                    {row.label}
                  </th>
                  <td className="py-2">
                    <TextField
                      label={`${row.label} starts on day`}
                      className="max-w-40 [&>label]:sr-only"
                      inputMode="numeric"
                      value={values.ladderDays[index]}
                      onChange={(text) => setDay(index, text)}
                      onBlur={() => blurRow(index)}
                      error={fieldErrors[LADDER_FIELDS[index]] ?? rowErrors[index]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-small text-muted">
          Each day is 1 to 60, and each tone starts later than the one before. A reminder opened that many days
          after the due date starts in that tone — unless the tenant has not heard from you yet, when it starts one
          step gentler. You can always change the tone before sending.
        </p>
      </div>

      <TextField
        label="Default rent increase at renewal (%)"
        className="max-w-72"
        inputMode="decimal"
        value={values.escalationDefaultPct}
        onChange={(text) => {
          setValues((v) => ({ ...v, escalationDefaultPct: text }));
          edited("escalationDefaultPct");
        }}
        validate={escalationProblem}
        error={fieldErrors.escalationDefaultPct}
        helper="Filled in when you renew an agreement; you can change it each time. Leave empty to start at 0."
      />
    </SettingsSection>
  );
}
