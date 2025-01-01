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
  loading: boolean;
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

  const handleDrop = async (files: Blob[]) => {
    const token = getToken();
    if (!token) {
      setSettingsOpen(true);
      return;
    }
    const mbs: MattingBlob[] = [];
    files.forEach(async (file, i) => {
      const blob = {
        blob: file,
        image: URL.createObjectURL(file),
        loading: true,
        matting: null,
        mattingImage: null,
        key: `${i}-${Date.now()}`,
      };
      mbs[i] = blob;
      setBlobs(mbs);
      const matting = await getImageMatting(token, file);
      if (!matting) return;
      setBlobs((prev) => {
        const newBlobs = [...prev];
        newBlobs[i].matting = new Blob([matting], { type: "image/png" });
        newBlobs[i].mattingImage = matting;
        newBlobs[i].loading = false;
        newBlobs[i].key = `${i}-${Date.now()}`;
        return newBlobs;
      });
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

        // 移除 base64 前缀
        const base64Data = blob.mattingImage.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        // 转换为 Uint8Array
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

  return (
    <main className="container mx-auto">
      <div className="fixed top-4 right-4">
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
        {blobs.map(({ image, mattingImage, loading, key }) => (
          <ImageMatting
            key={key}
            image={image}
            mattingImage={mattingImage}
            loading={loading}
            onOpen={() => handleOpen(image, mattingImage)}
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
