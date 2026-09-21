"use client";

import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { RangePreset } from "./types";
import { PRESET_OPTIONS, presetRange } from "./range";

export type RangeState = {
  preset: RangePreset;
  from: string;
  to: string;
};

/**
 * Preset selector + (when "Custom") a pair of date inputs. Emits a fully
 * resolved { preset, from, to } on every change so the parent can refetch.
 */
export function DateRangeControl({
  value,
  onChange,
  disabled,
}: {
  value: RangeState;
  onChange: (next: RangeState) => void;
  disabled?: boolean;
}) {
  function handlePreset(preset: RangePreset) {
    if (preset === "custom") {
      onChange({ ...value, preset });
      return;
    }
    const { from, to } = presetRange(preset);
    onChange({ preset, from, to });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="w-full sm:w-48">
        <label
          htmlFor="report-range-preset"
          className="mb-1 block text-xs font-medium text-muted"
        >
          Date range
        </label>
        <Select
          id="report-range-preset"
          value={value.preset}
          disabled={disabled}
          onChange={(e) => handlePreset(e.target.value as RangePreset)}
        >
          {PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {value.preset === "custom" ? (
        <div className="flex items-end gap-2">
          <div>
            <label
              htmlFor="report-range-from"
              className="mb-1 block text-xs font-medium text-muted"
            >
              From
            </label>
            <Input
              id="report-range-from"
              type="date"
              value={value.from}
              max={value.to || undefined}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="w-40"
            />
          </div>
          <div>
            <label
              htmlFor="report-range-to"
              className="mb-1 block text-xs font-medium text-muted"
            >
              To
            </label>
            <Input
              id="report-range-to"
              type="date"
              value={value.to}
              min={value.from || undefined}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="w-40"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
