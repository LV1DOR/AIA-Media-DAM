"use client";
// Isolated component example only; never used as production capacity.
import UsageMeter from "./usage-meter";
export function UsageMeterDemo() {
  return (
    <UsageMeter
      label="Synthetic test filesystem"
      limit={100}
      unit="GiB"
      segments={[{ id: "used", label: "Used", value: 64 }]}
    />
  );
}
