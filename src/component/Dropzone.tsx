import { open } from "@tauri-apps/plugin-dialog";
import { stat, readFile, readDir } from "@tauri-apps/plugin-fs";
import { join, extname } from "@tauri-apps/api/path";

export type FileEntry = {
  path: string;
  blob: Blob;
  previewUrl: string;
};

async function loadFileEntry(file: string): Promise<FileEntry> {
  const fileContent = await readFile(file);
  const ext = await extname(file);
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    heif: "image/heif",
  };
  const mimeType = mimeMap[ext.toLowerCase()] || `image/${ext}`;
  const blob = new Blob([fileContent.buffer], { type: mimeType });
  return {
    path: file,
    blob,
    previewUrl: URL.createObjectURL(blob),
  };
}

async function handleFiles(
  files: string[],
  depth = 0,
  totalFiles = { count: 0 }
): Promise<FileEntry[]> {
  if (depth >= 2) {
    throw new Error("目录深度超过最大限制2层");
  }
  if (totalFiles.count >= 100) {
    throw new Error("文件总数超过最大限制100个");
  }

  const result: FileEntry[] = [];

  for (const file of files) {
    if (file.endsWith(".DS_Store")) continue;

    const fileInfo = await stat(file);
    if (fileInfo.isFile) {
      const extension = await extname(file);
      if (!["png", "jpg", "jpeg", "heic", "heif"].includes(extension.toLowerCase())) continue;

      totalFiles.count++;
      if (totalFiles.count > 100) {
        throw new Error("文件总数超过最大限制100个");
      }

      result.push(await loadFileEntry(file));
    } else if (fileInfo.isDirectory) {
      const subFiles = await readDir(file);
      const subFilePaths = subFiles.map((f) => join(file, f.name));
      const subResult = await handleFiles(
        await Promise.all(subFilePaths),
        depth + 1,
        totalFiles
      );
      result.push(...subResult);
    }
  }

  return result;
}

export default function Dropzone({
  onDrop,
  onStart,
}: {
  onDrop: (files: FileEntry[]) => void;
  onStart: () => void;
}) {
  const handleSelectFolder = async () => {
    onStart();
    const dirs = await open({
      multiple: true,
      directory: true,
    });
    if (dirs) {
      const result = await handleFiles(dirs);
      onDrop(result);
    }
  };

  const handleSelectFiles = async () => {
    onStart();
    const files = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "Image",
          extensions: ["png", "jpg", "jpeg", "heic", "heif"],
        },
      ],
    });
    if (files) {
      const entries = await Promise.all(files.map(loadFileEntry));
      onDrop(entries);
    }
  };

  return (
    <div className="relative flex mb-10 h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          选择图片或文件夹开始处理
        </span>
        <div className="flex gap-3">
          <button
            onClick={handleSelectFiles}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            选择图片
          </button>
          <button
            onClick={handleSelectFolder}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-900"
          >
            选择文件夹
          </button>
        </div>
      </div>
    </div>
  );
}
