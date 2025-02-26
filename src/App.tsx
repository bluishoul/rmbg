import { useState } from "react";
import "./App.css";
import Dropzone from "./component/Dropzone";
import ImageMatting from "./component/ImageMatting";
import { ArrowDownTrayIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import ImageGallery from "./component/ImageGallery";
import { downloadDir, join } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import getImageMatting from "./lib/getImageMatting";
import useToken from "./lib/useToken";
import SettingsModal from "./component/SettingsModal";

type MattingBlob = {
  key: string;
  blob: Blob;
  image: string;
  matting: Blob | null;
  mattingImage: string | null;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const CONCURRENT_LIMIT = 10;

  const processImage = async (blob: MattingBlob, index: number) => {
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
              processImage(nextImage, nextIndex);
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

  const handleDrop = async (files: Blob[]) => {
    const token = getToken();
    if (!token) {
      setSettingsOpen(true);
      return;
    }

    const newBlobs: MattingBlob[] = files.map((file, i) => ({
      blob: file,
      image: URL.createObjectURL(file),
      loading: true,
      matting: null,
      mattingImage: null,
      key: `${i}-${Date.now()}`,
      status: i < CONCURRENT_LIMIT ? "processing" : "queued",
    }));

    setBlobs(newBlobs);

    newBlobs.slice(0, CONCURRENT_LIMIT).forEach((blob, index) => {
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
        if (!blob.mattingImage) return;

        const fileName = `photo-${index + 1}.png`;
        const filePath = await join(savePath, fileName);

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
      blob: file,
      image: "https://picsum.photos/400/400", // 使用随机图片
      matting: null,
      mattingImage: null,
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

      <Dropzone onDrop={handleDrop} onStart={handleStart} />

      {blobs.length > 0 && (
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            共 {blobs.length} 张图片
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
