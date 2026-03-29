import { Command } from "@tauri-apps/plugin-shell";
import { tempDir, join } from "@tauri-apps/api/path";

type JsonLineProgress = {
  type: "progress";
  stage: string;
  percent: number;
  message?: string;
};

type JsonLineResult = {
  type: "result";
  input: string;
  output: string;
  inferenceTime: number;
  totalTime: number;
};

type JsonLineError = {
  type: "error";
  message: string;
};

type JsonLineStatus = {
  type: "status";
  downloaded: boolean;
  cachePath: string;
};

type JsonLineDone = {
  type: "done";
  success: boolean;
};

type JsonLine =
  | JsonLineProgress
  | JsonLineResult
  | JsonLineError
  | JsonLineStatus
  | JsonLineDone;

function parseJsonLine(line: string): JsonLine | null {
  try {
    return JSON.parse(line.trim());
  } catch {
    return null;
  }
}

export type ModelStatus = {
  downloaded: boolean;
  cachePath: string;
};

export type ProgressCallback = (
  stage: string,
  percent: number,
  message?: string
) => void;

export type MattingResult = {
  outputPath: string;
  inferenceTime: number;
  totalTime: number;
};

export async function checkModelStatus(): Promise<ModelStatus> {
  return new Promise((resolve, reject) => {
    const cmd = Command.sidecar("binaries/rmbg-sidecar", ["check-model"]);

    cmd.stdout.on("data", (line) => {
      const parsed = parseJsonLine(line);
      if (parsed?.type === "status") {
        resolve({
          downloaded: parsed.downloaded,
          cachePath: parsed.cachePath,
        });
      }
    });

    cmd.stderr.on("data", (line) => {
      console.error("[sidecar check-model stderr]", line);
    });

    cmd.on("close", (data) => {
      if (data.code !== 0) {
        reject(new Error(`Sidecar exited with code ${data.code}`));
      }
    });

    cmd.spawn().catch(reject);
  });
}

export async function downloadModel(
  onProgress?: ProgressCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = Command.sidecar("binaries/rmbg-sidecar", ["download-model"]);

    cmd.stdout.on("data", (line) => {
      const parsed = parseJsonLine(line);
      if (!parsed) return;

      if (parsed.type === "progress" && onProgress) {
        onProgress(parsed.stage, parsed.percent, parsed.message);
      } else if (parsed.type === "done") {
        resolve();
      } else if (parsed.type === "error") {
        reject(new Error(parsed.message));
      }
    });

    cmd.stderr.on("data", (line) => {
      console.error("[sidecar stderr]", line);
    });

    cmd.on("error", (error) => {
      reject(new Error(`Sidecar process error: ${error}`));
    });

    cmd.on("close", (data) => {
      if (data.code !== 0) {
        reject(new Error(`Sidecar exited with code ${data.code}`));
      }
    });

    cmd.spawn().catch(reject);
  });
}

export async function removeBackground(
  inputPath: string,
  onProgress?: ProgressCallback
): Promise<MattingResult> {
  const tmp = await tempDir();
  const outputFileName = `rmbg-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const outputPath = await join(tmp, outputFileName);

  console.log("[sidecar] spawn:", "process", inputPath, "->", outputPath);

  return new Promise((resolve, reject) => {
    let resolved = false;
    const cmd = Command.sidecar("binaries/rmbg-sidecar", [
      "process",
      inputPath,
      outputPath,
    ]);

    cmd.stdout.on("data", (line) => {
      console.log("[sidecar stdout]", line);
      const parsed = parseJsonLine(line);
      if (!parsed) return;

      if (parsed.type === "progress" && onProgress) {
        onProgress(parsed.stage, parsed.percent, parsed.message);
      } else if (parsed.type === "result") {
        resolved = true;
        resolve({
          outputPath: parsed.output,
          inferenceTime: parsed.inferenceTime,
          totalTime: parsed.totalTime,
        });
      } else if (parsed.type === "error") {
        resolved = true;
        reject(new Error(parsed.message));
      }
    });

    cmd.stderr.on("data", (line) => {
      console.error("[sidecar stderr]", line);
    });

    cmd.on("error", (error) => {
      console.error("[sidecar error]", error);
      if (!resolved) reject(new Error(`Sidecar process error: ${error}`));
    });

    cmd.on("close", (data) => {
      console.log("[sidecar close]", data);
      if (!resolved && data.code !== 0) {
        reject(new Error(`Sidecar exited with code ${data.code}`));
      }
    });

    cmd.spawn()
      .then((child) => console.log("[sidecar] spawned pid:", child.pid))
      .catch((err) => {
        console.error("[sidecar spawn error]", err);
        reject(err);
      });
  });
}
