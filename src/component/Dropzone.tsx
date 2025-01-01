import { open } from "@tauri-apps/plugin-dialog";
import { stat, readFile, readDir } from "@tauri-apps/plugin-fs";
import { join, extname } from "@tauri-apps/api/path";

async function handleFiles(
  files: string[],
  depth = 0,
  totalFiles = { count: 0 }
): Promise<Blob[]> {
  if (depth >= 2) {
    throw new Error("目录深度超过最大限制2层");
  }
  if (totalFiles.count >= 100) {
    throw new Error("文件总数超过最大限制100个");
  }

  const result: Blob[] = [];

  for (const file of files) {
    if (file.endsWith(".DS_Store")) continue;

    const fileInfo = await stat(file);
    if (fileInfo.isFile) {
      const extension = await extname(file);
      if (!["png", "jpg", "jpeg"].includes(extension)) continue;

      totalFiles.count++;
      if (totalFiles.count > 100) {
        throw new Error("文件总数超过最大限制100个");
      }
      const fileContent = await readFile(file);
      const ext = await extname(file);
      const mineType = `image/${ext}`;
      const blob = new Blob([fileContent.buffer], { type: mineType });
      result.push(blob);
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
  onDrop: (files: Blob[]) => void;
  onStart: () => void;
}) {
  const handleDropAreaClick = async () => {
    onStart();
    const files = await open({
      multiple: true,
      directory: true,
      filters: [
        {
          name: "Image",
          extensions: ["png", "jpg", "jpeg"],
        },
      ],
    });
    if (files) {
      const result = await handleFiles(files);
      onDrop(result);
    }
  };

  return (
    <div
      onClick={handleDropAreaClick}
      className="relative flex mb-10 h-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-800/30"
    >
      <span className="text-gray-500 dark:text-gray-400">
        点击选择文件或文件夹
      </span>
    </div>
  );
}
