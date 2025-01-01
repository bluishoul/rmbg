import { Fragment, useState } from "react";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface ImageGalleryProps {
  originImage: string;
  mattingImage?: string | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function ImageGallery({
  originImage,
  mattingImage,
  isOpen,
  setIsOpen,
}: ImageGalleryProps) {
  const [showMatting, setShowMatting] = useState(true);

  return (
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog onClose={() => setIsOpen(false)} className="relative z-50">
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

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="relative max-w-5xl w-full">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="absolute -top-12 right-0 text-white hover:text-gray-300"
                  >
                    <XMarkIcon className="h-8 w-8" />
                  </button>

                  <div className="relative aspect-square">
                    <img
                      src={originImage}
                      alt="original"
                      className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 rounded-lg"
                      style={{ opacity: showMatting && mattingImage ? 0 : 1 }}
                    />

                    {mattingImage && (
                      <img
                        src={mattingImage}
                        alt="matting"
                        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 rounded-lg bg-gray-800"
                        style={{ opacity: showMatting ? 1 : 0 }}
                      />
                    )}
                  </div>

                  {mattingImage && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
                      <button
                        onClick={() => setShowMatting(!showMatting)}
                        className="px-6 py-3 text-sm font-medium text-white bg-blue-600/90 backdrop-blur-sm rounded-full hover:bg-blue-700 shadow-lg transition-colors"
                      >
                        {showMatting ? "显示原图" : "显示效果"}
                      </button>
                    </div>
                  )}
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
