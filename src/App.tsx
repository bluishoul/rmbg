import { useState, useEffect } from "react";
import "./App.css";
import Dropzone, { FileEntry } from "./component/Dropzone";
import ImageMatting from "./component/ImageMatting";
import {
  ArrowDownTrayIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import ImageGallery from "./component/ImageGallery";
import { downloadDir, join } from "@tauri-apps/api/path";
import { mkdir, writeFile, copyFile } from "@tauri-apps/plugin-fs";
import getImageMatting from "./lib/getImageMatting";
import useToken from "./lib/useToken";
import useProcessingMode from "./lib/useProcessingMode";
import { removeBackground, checkModelStatus, downloadModel } from "./lib/localMatting";
import SettingsModal from "./component/SettingsModal";
import { readFile } from "@tauri-apps/plugin-fs";

type MattingBlob = {
  key: string;
  filePath: string;
  blob: Blob;
  image: string;
  matting: Blob | null;
  mattingImage: string | null;
  mattingFilePath: string | null;
  status: "queued" | "processing" | "completed" | "error";
};

function App() {
  const [blobs, setBlobs] = useState<MattingBlob[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentOriginImage, setCurrentOriginImage] = useState<string>("");
  const [currentMattingImage, setCurrentMattingImage] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const { getToken } = useToken();
  const { mode } = useProcessingMode();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelDownloading, setModelDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState("");

  // Auto-download model when in local mode
  useEffect(() => {
    if (mode !== "local") return;

    let cancelled = false;
    checkModelStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.downloaded) {
          setModelReady(true);
        } else {
          setModelDownloading(true);
          setDownloadMessage("正在下载模型...");
          downloadModel((stage, percent, message) => {
            if (cancelled) return;
            setDownloadProgress(percent);
            setDownloadMessage(message || stage);
          })
            .then(() => {
              if (cancelled) return;
              setModelReady(true);
              setModelDownloading(false);
            })
            .catch((err) => {
              if (cancelled) return;
              console.error("Model download failed:", err);
              setModelDownloading(false);
            });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Check model status failed:", err);
      });

    return () => { cancelled = true; };
  }, [mode]);

  const CLOUD_CONCURRENT_LIMIT = 10;
  const LOCAL_CONCURRENT_LIMIT = 3;
  const concurrentLimit =
    mode === "local" ? LOCAL_CONCURRENT_LIMIT : CLOUD_CONCURRENT_LIMIT;

  const processImageLocal = async (blob: MattingBlob, index: number) => {
    try {
      setBlobs((prev) => {
        const newBlobs = [...prev];
        newBlobs[index].status = "processing";
        return newBlobs;
      });

      const result = await removeBackground(blob.filePath);

      // Read the result file to create a preview
      const resultData = await readFile(result.outputPath);
      const resultBlob = new Blob([resultData.buffer], { type: "image/png" });
      const mattingImage = URL.createObjectURL(resultBlob);

      setBlobs((prev) => {
        const newBlobs = [...prev];
        newBlobs[index].matting = resultBlob;
        newBlobs[index].mattingImage = mattingImage;
        newBlobs[index].mattingFilePath = result.outputPath;
        newBlobs[index].status = "completed";

        const queuedImages = newBlobs.filter((b) => b.status === "queued");
        if (queuedImages.length > 0) {
          const nextImage = queuedImages[0];
          const nextIndex = newBlobs.findIndex((b) => b.key === nextImage.key);
          if (nextIndex !== -1) {
            setTimeout(() => {
              processImageLocal(nextImage, nextIndex);
            }, 0);
          }
        }

        return newBlobs;
      });
    } catch (error) {
      console.error("Local processing error:", error);
      setBlobs((prev) => {
        const newBlobs = [...prev];
        newBlobs[index].status = "error";
        return newBlobs;
      });
    }
  };

  const processImageCloud = async (blob: MattingBlob, index: number) => {
    const token = getToken();
    if (!token) return;

    try {
      setBlobs((prev) => {
        const newBlobs = [...prev];
        newBlobs[index].status = "processing";
        return newBlobs;
      });

      const matting = await getImageMatting(token, blob.blob);

      if (!matting) throw new Error("处理失败");

      setBlobs((prev) => {
        const newBlobs = [...prev];
        newBlobs[index].matting = new Blob([matting], { type: "image/png" });
        newBlobs[index].mattingImage = matting;
        newBlobs[index].status = "completed";

        const queuedImages = newBlobs.filter((b) => b.status === "queued");
        if (queuedImages.length > 0) {
          const nextImage = queuedImages[0];
          const nextIndex = newBlobs.findIndex((b) => b.key === nextImage.key);
          if (nextIndex !== -1) {
            setTimeout(() => {
              processImageCloud(nextImage, nextIndex);
            }, 0);
          }
        }

        return newBlobs;
      });
    } catch (error) {
      setBlobs((prev) => {
        const newBlobs = [...prev];
        newBlobs[index].status = "error";
        return newBlobs;
      });
    }
  };

  const processImage = (blob: MattingBlob, index: number) => {
    if (mode === "local") {
      processImageLocal(blob, index);
    } else {
      processImageCloud(blob, index);
    }
  };

  const handleDrop = async (files: FileEntry[]) => {
    if (mode === "local" && !modelReady) {
      return;
    }
    if (mode === "cloud") {
      const token = getToken();
      if (!token) {
        setSettingsOpen(true);
        return;
      }
    }

    const newBlobs: MattingBlob[] = files.map((file, i) => ({
      filePath: file.path,
      blob: file.blob,
      image: file.previewUrl,
      loading: true,
      matting: null,
      mattingImage: null,
      mattingFilePath: null,
      key: `${i}-${Date.now()}`,
      status: (i < concurrentLimit ? "processing" : "queued") as MattingBlob["status"],
    }));

    setBlobs(newBlobs);

    newBlobs.slice(0, concurrentLimit).forEach((blob, index) => {
      processImage(blob, index);
    });
  };

  const handleStart = () => {
    setSaving(false);
    setBlobs([]);
  };

  const handleOpen = (originImage: string, mattingImage: string | null) => {
    setCurrentOriginImage(originImage);
    setCurrentMattingImage(mattingImage);
    setIsOpen(true);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const mattingsDir = `rmbg-${Date.now()}`;
      const savePath = await join(await downloadDir(), mattingsDir);

      await mkdir(savePath, { recursive: true });

      const savePromises = blobs.map(async (blob, index) => {
        const fileName = `photo-${index + 1}.png`;
        const filePath = await join(savePath, fileName);

        // Local mode: copy file directly from temp path
        if (mode === "local" && blob.mattingFilePath) {
          await copyFile(blob.mattingFilePath, filePath);
          return;
        }

        // Cloud mode: decode base64 and write
        if (!blob.mattingImage) return;

        const base64Data = blob.mattingImage.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const uint8Array = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0)
        );

        await writeFile(filePath, uint8Array);
      });

      await Promise.all(savePromises);
      alert(`所有图片已保存到 ${savePath}`);
    } catch (err) {
      alert(`保存失败: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = (index: number) => {
    const blob = blobs[index];
    if (blob) {
      processImage(blob, index);
    }
  };

  const handleGenerateTestErrors = () => {
    const testFiles = Array.from(
      { length: 5 },
      (_, i) => new Blob([`test${i}`], { type: "image/png" })
    );
    const newBlobs: MattingBlob[] = testFiles.map((file, i) => ({
      filePath: "",
      blob: file,
      image: "https://picsum.photos/400/400",
      matting: null,
      mattingImage: null,
      mattingFilePath: null,
      key: `test-${i}-${Date.now()}`,
      status: "error",
    }));

    setBlobs(newBlobs);
  };

  return (
    <main className="container mx-auto">
      <div className="fixed top-4 right-4 flex items-center gap-2">
        {import.meta.env.DEV && (
          <button
            onClick={handleGenerateTestErrors}
            className="px-3 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            title="生成测试错误"
          >
            生成测试错误
          </button>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="设置"
        >
          <Cog6ToothIcon className="w-6 h-6" />
        </button>
      </div>

      <SettingsModal isOpen={settingsOpen} setIsOpen={setSettingsOpen} />

      {mode === "local" && modelDownloading && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              正在下载 CoreML 模型...
            </span>
            <span className="text-xs text-blue-500 dark:text-blue-400">
              {downloadProgress > 0 ? `${Math.round(downloadProgress)}%` : ""}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 dark:bg-blue-800">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(downloadProgress, 100)}%` }}
            ></div>
          </div>
          <div className="mt-1 text-xs text-blue-500 dark:text-blue-400">
            {downloadMessage}
          </div>
        </div>
      )}

      <Dropzone onDrop={handleDrop} onStart={handleStart} />

      {blobs.length > 0 && (
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            共 {blobs.length} 张图片
            <span className="ml-2 px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700">
              {mode === "local" ? "本地 CoreML" : "云端 API"}
            </span>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? (
              <>
                <svg
                  className="w-5 h-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                正在保存...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="w-5 h-5" />
                保存全部
              </>
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {blobs.map(({ image, mattingImage, key, status }, index) => (
          <ImageMatting
            key={key}
            image={image}
            mattingImage={mattingImage}
            status={status}
            onOpen={() => handleOpen(image, mattingImage)}
            onRetry={() => handleRetry(index)}
          />
        ))}
      </div>
      <ImageGallery
        originImage={currentOriginImage}
        mattingImage={currentMattingImage}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
    </main>
  );
}

export default App;
