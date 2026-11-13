import type { CSSProperties } from "react";

export type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  onChange: (value: number) => void;
  /** Called when a drag or keyboard change finishes. */
  onCommit?: (value: number) => void;
  /** Text shown after the slider, e.g. "80%". */
  valueText?: string;
};

/** WinUI Slider: thin track filled with the accent, round thumb with an accent core. */
export function Slider({
  value,
  min,
  max,
  step = 1,
  label,
  onChange,
  onCommit,
  valueText,
}: SliderProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="fluent-slider w-40"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        style={{ "--fill": `${percent}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        // Commit when a drag ends (mouse, touch or pen) and after keyboard
        // changes (arrows, Home/End, PageUp/PageDown), which fire no pointer events.
        onPointerUp={(e) => onCommit?.(Number(e.currentTarget.value))}
        onKeyUp={(e) => onCommit?.(Number(e.currentTarget.value))}
      />
      {valueText && (
        <span className="w-10 text-right text-body text-fg-secondary tabular">
          {valueText}
        </span>
      )}
    </div>
  );
}
