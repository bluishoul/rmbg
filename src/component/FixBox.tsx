import { useState, useRef, useCallback, useEffect } from "react";
import { XMarkIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";

export type FixBoxStatus = "drawing" | "pending" | "processing" | "done" | "error";
export type FixBoxMode = "fix" | "erase";

export type FixBoxData = {
  id: string;
  x: number; // percentage of image
  y: number;
  width: number;
  height: number;
  rotation: number;
  status: FixBoxStatus;
  mode: FixBoxMode;
  // For before/after comparison
  beforeSnapshot?: string;
};

interface FixBoxProps {
  box: FixBoxData;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (box: FixBoxData) => void;
  onRemove: (id: string) => void;
  onRevert: (box: FixBoxData) => void;
  selected: boolean;
  onSelect: (id: string) => void;
}

type DragMode =
  | "move"
  | "resize-tl"
  | "resize-tr"
  | "resize-bl"
  | "resize-br"
  | "rotate"
  | null;

export default function FixBox({
  box,
  containerRef,
  onUpdate,
  onRemove,
  onRevert,
  selected,
  onSelect,
}: FixBoxProps) {
  const [dragMode, setDragMode] = useState<DragMode>(null);

  const dragStart = useRef({ x: 0, y: 0, box: box });

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? new DOMRect();
  }, [containerRef]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      if (box.status === "processing") return;
      e.preventDefault();
      e.stopPropagation();
      onSelect(box.id);
      setDragMode(mode);
      dragStart.current = { x: e.clientX, y: e.clientY, box: { ...box } };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [box, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode) return;
      e.preventDefault();

      const rect = getContainerRect();
      const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
      const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;
      const startBox = dragStart.current.box;
      const updated = { ...box };

      switch (dragMode) {
        case "move":
          updated.x = Math.max(0, Math.min(100 - box.width, startBox.x + dx));
          updated.y = Math.max(0, Math.min(100 - box.height, startBox.y + dy));
          break;
        case "resize-br":
          updated.width = Math.max(3, startBox.width + dx);
          updated.height = Math.max(3, startBox.height + dy);
          break;
        case "resize-bl": {
          const nw = Math.max(3, startBox.width - dx);
          updated.x = startBox.x + startBox.width - nw;
          updated.width = nw;
          updated.height = Math.max(3, startBox.height + dy);
          break;
        }
        case "resize-tr":
          updated.width = Math.max(3, startBox.width + dx);
          { const nh = Math.max(3, startBox.height - dy);
          updated.y = startBox.y + startBox.height - nh;
          updated.height = nh; }
          break;
        case "resize-tl": {
          const nw2 = Math.max(3, startBox.width - dx);
          const nh2 = Math.max(3, startBox.height - dy);
          updated.x = startBox.x + startBox.width - nw2;
          updated.y = startBox.y + startBox.height - nh2;
          updated.width = nw2;
          updated.height = nh2;
          break;
        }
        case "rotate": {
          const cx = rect.left + (rect.width * (box.x + box.width / 2)) / 100;
          const cy = rect.top + (rect.height * (box.y + box.height / 2)) / 100;
          const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
          updated.rotation = Math.round(angle / 5) * 5;
          break;
        }
      }
      onUpdate(updated);
    },
    [dragMode, box, getContainerRect, onUpdate]
  );

  const handlePointerUp = useCallback(() => {
    setDragMode(null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelect("");
      if (e.key === "Delete" || e.key === "Backspace") onRemove(box.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, box.id, onRemove, onSelect]);

  const isProcessing = box.status === "processing";
  const isDone = box.status === "done";
  const isInteractive = box.status !== "processing" && box.status !== "drawing" && box.status !== "done";
  const isErase = box.mode === "erase";

  const borderColor = isProcessing
    ? "border-yellow-400"
    : isDone
    ? "border-green-400"
    : box.status === "error"
    ? "border-red-400"
    : selected
    ? (isErase ? "border-red-500" : "border-blue-500")
    : (isErase ? "border-red-400/70" : "border-blue-400/70");

  const bgColor = isProcessing
    ? "bg-yellow-400/10"
    : isDone
    ? "bg-green-400/5"
    : isErase
    ? "bg-red-500/10"
    : "bg-blue-500/10";

  const handleClass =
    `w-3 h-3 bg-white border-2 ${isErase ? "border-red-500" : "border-blue-500"} rounded-full absolute`;

  return (
    <div
      data-fixbox
      className={`absolute pointer-events-auto ${selected ? "z-20" : "z-10"}`}
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Main box */}
      <div
        className={`absolute inset-0 border-2 ${isErase && !isDone ? "border-dashed" : ""} ${borderColor} ${bgColor} transition-colors duration-500 ${
          isInteractive ? "cursor-move" : isDone ? "cursor-pointer" : ""
        }`}
        onPointerDown={isInteractive ? (e) => handlePointerDown(e, "move") : undefined}
        onClick={isDone ? (e) => { e.stopPropagation(); onSelect(box.id); } : undefined}
      >
        {/* Processing spinner */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 animate-spin">
              <svg className="w-full h-full text-yellow-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
        )}

        {/* Done flash animation */}
        {isDone && (
          <div className="absolute inset-0 animate-[fadeGreen_1s_ease-out] pointer-events-none" />
        )}
      </div>

      {/* Resize/rotate handles - only when selected and interactive (pending) */}
      {selected && isInteractive && (
        <>
          <div className={`${handleClass} -top-1.5 -left-1.5 cursor-nw-resize`}
            onPointerDown={(e) => handlePointerDown(e, "resize-tl")} />
          <div className={`${handleClass} -top-1.5 -right-1.5 cursor-ne-resize`}
            onPointerDown={(e) => handlePointerDown(e, "resize-tr")} />
          <div className={`${handleClass} -bottom-1.5 -left-1.5 cursor-sw-resize`}
            onPointerDown={(e) => handlePointerDown(e, "resize-bl")} />
          <div className={`${handleClass} -bottom-1.5 -right-1.5 cursor-se-resize`}
            onPointerDown={(e) => handlePointerDown(e, "resize-br")} />

          {/* Rotate handle */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className={`w-4 h-4 bg-white border-2 ${isErase ? "border-red-500" : "border-green-500"} rounded-full cursor-grab active:cursor-grabbing`}
              onPointerDown={(e) => handlePointerDown(e, "rotate")} />
            <div className={`w-px h-3 ${isErase ? "bg-red-500" : "bg-green-500"}`} />
          </div>
        </>
      )}

      {/* Close/revert buttons - shown for selected interactive OR selected done boxes */}
      {selected && (isInteractive || isDone) && (
        <>
          {/* Revert button (done boxes only) */}
          {isDone && box.beforeSnapshot && (
            <button
              className="absolute -top-2 -right-9 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center hover:bg-amber-600 shadow-md"
              onClick={(e) => { e.stopPropagation(); onRevert(box); }}
              title="撤销"
            >
              <ArrowUturnLeftIcon className="w-3 h-3 text-white" />
            </button>
          )}

          {/* Close button */}
          <button
            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
            onClick={(e) => { e.stopPropagation(); onRemove(box.id); }}
          >
            <XMarkIcon className="w-3 h-3 text-white" />
          </button>
        </>
      )}

      {/* Close/revert icons always visible for done boxes (no selection needed) */}
      {isDone && !selected && (
        <>
          {box.beforeSnapshot && (
            <button
              className="absolute -top-2 -right-9 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center hover:bg-amber-600 shadow-md"
              onClick={(e) => { e.stopPropagation(); onRevert(box); }}
              title="撤销"
            >
              <ArrowUturnLeftIcon className="w-3 h-3 text-white" />
            </button>
          )}
          <button
            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
            onClick={(e) => { e.stopPropagation(); onRemove(box.id); }}
          >
            <XMarkIcon className="w-3 h-3 text-white" />
          </button>
        </>
      )}
    </div>
  );
}
