import { createContext, useContext, useState, useCallback, ReactNode, createElement } from "react";

export type ProcessingMode = "local" | "cloud";

const MODE_KEY = "PROCESSING_MODE";

type ProcessingModeContextType = {
  mode: ProcessingMode;
  setMode: (newMode: ProcessingMode) => void;
};

const ProcessingModeContext = createContext<ProcessingModeContextType | null>(null);

export function ProcessingModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ProcessingMode>(() => {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "cloud" ? "cloud" : "local";
  });

  const setMode = useCallback((newMode: ProcessingMode) => {
    localStorage.setItem(MODE_KEY, newMode);
    setModeState(newMode);
  }, []);

  return createElement(
    ProcessingModeContext.Provider,
    { value: { mode, setMode } },
    children
  );
}

export default function useProcessingMode() {
  const context = useContext(ProcessingModeContext);
  if (!context) {
    throw new Error("useProcessingMode must be used within ProcessingModeProvider");
  }
  return context;
}
