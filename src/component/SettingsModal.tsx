import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ArrowTopRightOnSquareIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { Fragment, useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import useToken from "../lib/useToken";
import useProcessingMode, { ProcessingMode } from "../lib/useProcessingMode";
import { checkModelStatus, ModelStatus } from "../lib/localMatting";

interface Props {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function SettingsModal({ isOpen, setIsOpen }: Props) {
  const { getToken, setToken, clearToken } = useToken();
  const { mode, setMode } = useProcessingMode();
  const [tokenInput, setTokenInput] = useState(getToken());
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    if (isOpen && mode === "local") {
      checkModelStatus()
        .then(setModelStatus)
        .catch(() => setModelStatus(null));
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (isOpen && mode === "cloud") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  const handleSave = () => {
    setToken(tokenInput);
    setIsOpen(false);
  };

  const handleClear = () => {
    clearToken();
    setTokenInput("");
  };

  const handleModeChange = (newMode: ProcessingMode) => {
    setMode(newMode);
    if (newMode === "local") {
      checkModelStatus()
        .then(setModelStatus)
        .catch(() => setModelStatus(null));
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-10"
        onClose={() => setIsOpen(false)}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800">
                <DialogTitle
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                >
                  设置
                </DialogTitle>

                {/* Processing Mode Toggle */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    处理模式
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                    <button
                      type="button"
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        mode === "local"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => handleModeChange("local")}
                    >
                      本地 CoreML
                    </button>
                    <button
                      type="button"
                      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                        mode === "cloud"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => handleModeChange("cloud")}
                    >
                      云端 API
                    </button>
                  </div>
                </div>

                {/* Local Mode: Model Status */}
                {mode === "local" && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      使用 CoreML 在本地处理图片，无需网络连接。
                    </div>
                    {modelStatus?.downloaded === true && (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-sm text-green-700 dark:text-green-400">
                            模型已就绪
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate mr-2">
                            {modelStatus.cachePath}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              revealItemInDir(modelStatus.cachePath)
                            }
                            className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <FolderOpenIcon className="w-3.5 h-3.5" />
                            在 Finder 中显示
                          </button>
                        </div>
                      </div>
                    )}
                    {modelStatus !== null && !modelStatus.downloaded && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span className="text-sm text-yellow-700 dark:text-yellow-400">
                          模型下载中，请稍候...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cloud Mode: Token Input */}
                {mode === "cloud" && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Gitee AI Token
                      </label>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          open(
                            "https://ai.gitee.com/dashboard/settings/tokens"
                          );
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                      >
                        <ArrowTopRightOnSquareIcon className="inline-block w-4 h-4 mr-1" />
                        获取免费 Token
                      </a>
                    </div>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      ref={inputRef}
                      className="mt-2 px-2 py-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="请输入 Gitee AI Token"
                    />
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  {mode === "cloud" && (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                        onClick={handleClear}
                      >
                        清除
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                        onClick={handleSave}
                      >
                        保存
                      </button>
                    </>
                  )}
                  {mode === "local" && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-900"
                      onClick={() => setIsOpen(false)}
                    >
                      关闭
                    </button>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
