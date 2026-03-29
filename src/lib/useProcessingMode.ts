import { useState } from "react";

export type ProcessingMode = "local" | "cloud";

const MODE_KEY = "PROCESSING_MODE";

export default function useProcessingMode() {
  const [mode, setModeState] = useState<ProcessingMode>(() => {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "cloud" ? "cloud" : "local";
  });

  const setMode = (newMode: ProcessingMode) => {
    localStorage.setItem(MODE_KEY, newMode);
    setModeState(newMode);
  };

  return { mode, setMode };
}
