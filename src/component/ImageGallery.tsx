import { Fragment, useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import FixBox, { FixBoxData, FixBoxStatus, FixBoxMode } from "./FixBox";

interface ImageGalleryProps {
  originImage: string;
  mattingImage?: string | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onFixRegion?: (
    region: { x: number; y: number; width: number; height: number; rotation: number },
    imageWidth: number,
    imageHeight: number
  ) => Promise<void>;
  onEraseRegion?: (
    region: { x: number; y: number; width: number; height: number; rotation: number },
    imageWidth: number,
    imageHeight: number
  ) => Promise<void>;
  onRevertRegion?: (
    region: { x: number; y: number; width: number; height: number; rotation: number },
    beforeSnapshot: string,
    imageWidth: number,
    imageHeight: number
  ) => Promise<void>;
}

export default function ImageGallery({
  originImage,
  mattingImage,
  isOpen,
  setIsOpen,
  onFixRegion,
  onEraseRegion,
  onRevertRegion,
}: ImageGalleryProps) {
  const [showMatting, setShowMatting] = useState(true);
  const [drawMode, setDrawMode] = useState<FixBoxMode>("fix");
  const [fixBoxes, setFixBoxes] = useState<FixBoxData[]>([]);
  const fixBoxesRef = useRef<FixBoxData[]>([]);
  fixBoxesRef.current = fixBoxes;
  const [selectedBoxId, setSelectedBoxId] = useState("");
  const [peeking, setPeeking] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Drawing state stored in ref for synchronous access during pointer events
  const drawingRef = useRef<{
    boxId: string;
    startX: number;
    startY: number;
  } | null>(null);

  // Concurrency-limited processing queue (max 2 sidecar processes at once)
  const FIX_CONCURRENT_LIMIT = 2;
  const activeCountRef = useRef(0);
  const pendingQueueRef = useRef<string[]>([]);

  const handleClose = () => {
    setFixBoxes([]);
    setSelectedBoxId("");
    setPeeking(false);
    drawingRef.current = null;
    activeCountRef.current = 0;
    pendingQueueRef.current = [];
    setIsOpen(false);
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFixBoxes([]);
      setSelectedBoxId("");
      setPeeking(false);
      drawingRef.current = null;
      activeCountRef.current = 0;
      pendingQueueRef.current = [];
      setShowMatting(true);
      setDrawMode("fix");
    }
  }, [isOpen]);

  // Space key to peek at original image
  useEffect(() => {
    if (!isOpen || !mattingImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setPeeking(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setPeeking(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isOpen, mattingImage]);

  const updateFixBox = useCallback((updated: FixBoxData) => {
    setFixBoxes((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  }, []);

  const removeFixBox = useCallback((id: string) => {
    setFixBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedBoxId("");
  }, []);

  const revertBox = useCallback(
    async (box: FixBoxData) => {
      if (!box.beforeSnapshot || !onRevertRegion || !imageRef.current) return;

      const img = imageRef.current;
      const region = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        rotation: box.rotation,
      };

      try {
        await onRevertRegion(region, box.beforeSnapshot, img.naturalWidth, img.naturalHeight);
        setFixBoxes((prev) => prev.filter((b) => b.id !== box.id));
        setSelectedBoxId("");
      } catch (err) {
        console.error("Revert failed:", err);
      }
    },
    [onRevertRegion]
  );

  // Capture a before-snapshot of a region from the current matting image
  const captureBeforeSnapshot = useCallback(
    (region: {
      x: number;
      y: number;
      width: number;
      height: number;
    }): string | undefined => {
      const img = imageRef.current;
      if (!img || !img.complete) return undefined;

      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const rx = Math.round((region.x / 100) * natW);
      const ry = Math.round((region.y / 100) * natH);
      const rw = Math.max(1, Math.round((region.width / 100) * natW));
      const rh = Math.max(1, Math.round((region.height / 100) * natH));

      const canvas = document.createElement("canvas");
      canvas.width = rw;
      canvas.height = rh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
      return canvas.toDataURL("image/png");
    },
    []
  );

  // Run one box through processing (called by drainQueue, respects concurrency)
  const runBox = useCallback(
    async (boxId: string) => {
      if (!imageRef.current) return;

      // Read latest box position from state (user may have adjusted it while pending)
      const box = fixBoxesRef.current.find((b) => b.id === boxId);
      if (!box) return;

      const img = imageRef.current;
      const beforeSnapshot = captureBeforeSnapshot(box);

      setFixBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId
            ? { ...b, status: "processing" as FixBoxStatus, beforeSnapshot }
            : b
        )
      );

      try {
        const region = {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rotation: box.rotation,
        };

        const callback = box.mode === "erase" ? onEraseRegion : onFixRegion;
        if (!callback) throw new Error(`No callback for mode: ${box.mode}`);

        await callback(region, img.naturalWidth, img.naturalHeight);

        setFixBoxes((prev) =>
          prev.map((b) =>
            b.id === boxId
              ? { ...b, status: "done" as FixBoxStatus }
              : b
          )
        );
      } catch (err) {
        console.error("Fix region processing failed:", err);
        setFixBoxes((prev) =>
          prev.map((b) =>
            b.id === boxId
              ? { ...b, status: "error" as FixBoxStatus }
              : b
          )
        );
      } finally {
        activeCountRef.current--;
        drainQueue();
      }
    },
    [onFixRegion, onEraseRegion, captureBeforeSnapshot]
  );

  // Drain pending queue up to concurrency limit
  const drainQueue = useCallback(() => {
    while (
      activeCountRef.current < FIX_CONCURRENT_LIMIT &&
      pendingQueueRef.current.length > 0
    ) {
      const nextId = pendingQueueRef.current.shift()!;
      activeCountRef.current++;
      runBox(nextId);
    }
  }, [runBox]);

  // Enqueue a box for processing (respects limit)
  const enqueueBox = useCallback(
    (boxId: string) => {
      pendingQueueRef.current.push(boxId);
      drainQueue();
    },
    [drainQueue]
  );

  // --- Drawing handlers ---

  const handleContainerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!showMatting || !mattingImage || peeking) return;
      if (e.button !== 0) return;

      // Don't start drawing if clicking on an existing fix box
      const target = e.target as HTMLElement;
      if (target.closest("[data-fixbox]")) return;

      const container = imageContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      e.preventDefault();

      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const boxId = `fix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      drawingRef.current = { boxId, startX: x, startY: y };

      setFixBoxes((prev) => [
        ...prev,
        {
          id: boxId,
          x,
          y,
          width: 0,
          height: 0,
          rotation: 0,
          status: "drawing" as FixBoxStatus,
          mode: drawMode,
        },
      ]);

      setSelectedBoxId("");

      container.setPointerCapture(e.pointerId);
    },
    [showMatting, mattingImage, drawMode, peeking]
  );

  const handleContainerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();

      const container = imageContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const currentX = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
      );
      const currentY = Math.max(
        0,
        Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
      );

      const { startX, startY, boxId } = drawingRef.current;
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      setFixBoxes((prev) =>
        prev.map((b) =>
          b.id === boxId ? { ...b, x, y, width, height } : b
        )
      );
    },
    []
  );

  const handleContainerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();

      const { boxId } = drawingRef.current;
      drawingRef.current = null;

      // Release pointer capture
      const container = imageContainerRef.current;
      if (container) {
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }

      // Finalize: too small → remove, otherwise → pending + enqueue
      setFixBoxes((prev) => {
        const box = prev.find((b) => b.id === boxId);
        if (!box || box.width < 2 || box.height < 2) {
          return prev.filter((b) => b.id !== boxId);
        }

        const pendingBox: FixBoxData = { ...box, status: "pending" };

        // Enqueue box ID for processing (reads latest position when it starts)
        setTimeout(() => enqueueBox(boxId), 0);

        return prev.map((b) => (b.id === boxId ? pendingBox : b));
      });
    },
    [enqueueBox]
  );

  const canDraw = showMatting && !!mattingImage && !peeking;
  const showOriginal = peeking || !showMatting;

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={handleClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70" />
        </TransitionChild>

        <div className="fixed inset-0 flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-end p-4 gap-3 shrink-0">
            {mattingImage && showMatting && (
              <div className="mr-auto flex items-center gap-3">
                <span className="text-xs text-gray-300">
                  {drawMode === "fix"
                    ? "拖拽画框修复区域"
                    : "拖拽画框擦除区域"}
                </span>
                <span className="text-xs text-gray-500">
                  按住空格键对比原图
                </span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-300"
            >
              <XMarkIcon className="h-8 w-8" />
            </button>
          </div>

          {/* Scrollable image area */}
          <div className="flex-1 overflow-auto px-4 pb-20">
            <div className="flex justify-center">
              <div
                ref={imageContainerRef}
                className={`relative inline-block max-w-full ${
                  canDraw ? "cursor-crosshair" : ""
                }`}
                style={{ maxHeight: "calc(100vh - 140px)" }}
                onPointerDown={canDraw ? handleContainerPointerDown : undefined}
                onPointerMove={handleContainerPointerMove}
                onPointerUp={handleContainerPointerUp}
              >
                {mattingImage ? (
                  <>
                    {/* Matting image — base layer (sets container size) */}
                    <img
                      ref={imageRef}
                      src={mattingImage}
                      alt="matting"
                      className="max-w-full max-h-[calc(100vh-140px)] object-contain rounded-lg checkerboard pointer-events-none select-none transition-opacity duration-200"
                      style={{ opacity: showOriginal ? 0 : 1 }}
                      draggable={false}
                    />

                    {/* Original image overlay — shown when peeking or toggled to original */}
                    <img
                      src={originImage}
                      alt="original"
                      className="absolute inset-0 w-full h-full object-contain rounded-lg pointer-events-none select-none transition-opacity duration-200"
                      style={{ opacity: showOriginal ? 1 : 0 }}
                      draggable={false}
                    />

                    {/* Peeking indicator */}
                    {peeking && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium text-white bg-black/60 backdrop-blur-sm rounded-full pointer-events-none z-30">
                        原图
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src={originImage}
                    alt="original"
                    className="max-w-full max-h-[calc(100vh-140px)] object-contain rounded-lg pointer-events-none select-none"
                    draggable={false}
                  />
                )}

                {/* Fix boxes overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {fixBoxes.map((box) => (
                    <FixBox
                      key={box.id}
                      box={box}
                      containerRef={imageContainerRef}
                      onUpdate={updateFixBox}
                      onRemove={removeFixBox}
                      onRevert={revertBox}
                      selected={selectedBoxId === box.id}
                      onSelect={setSelectedBoxId}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom toolbar */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {mattingImage && (
              <>
                {showMatting && (
                  <>
                    <button
                      onClick={() => setDrawMode("fix")}
                      className={`px-4 py-2.5 text-sm font-medium backdrop-blur-sm rounded-full shadow-lg transition-colors ${
                        drawMode === "fix"
                          ? "text-white bg-blue-600/90 hover:bg-blue-700"
                          : "text-gray-300 bg-gray-600/50 hover:bg-gray-600/70"
                      }`}
                    >
                      修复
                    </button>
                    <button
                      onClick={() => setDrawMode("erase")}
                      className={`px-4 py-2.5 text-sm font-medium backdrop-blur-sm rounded-full shadow-lg transition-colors ${
                        drawMode === "erase"
                          ? "text-white bg-red-600/90 hover:bg-red-700"
                          : "text-gray-300 bg-gray-600/50 hover:bg-gray-600/70"
                      }`}
                    >
                      擦除
                    </button>
                    <div className="w-px h-6 bg-white/20 mx-1" />
                  </>
                )}
                <button
                  onClick={() => setShowMatting(!showMatting)}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gray-600/90 backdrop-blur-sm rounded-full hover:bg-gray-700 shadow-lg transition-colors"
                >
                  {showMatting ? "显示原图" : "显示效果"}
                </button>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
