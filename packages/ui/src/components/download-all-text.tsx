"use client";
import { useRef } from "react";
import VariableProximity from "./react-bits/VariableProximity";
export function DownloadAllText({ count }: { count: number }) {
  const container = useRef<HTMLSpanElement>(null);
  return (
    <span ref={container} className="download-variable-label">
      <VariableProximity
        label={`Download all (${count} files)`}
        containerRef={container}
        fromFontVariationSettings="'wght' 500, 'opsz' 14"
        toFontVariationSettings="'wght' 1000, 'opsz' 40"
        radius={100}
        falloff="linear"
        smoothing={0.2}
        scale={1}
        lift={0}
        idleWave={false}
        fontSize={14}
      />
    </span>
  );
}
