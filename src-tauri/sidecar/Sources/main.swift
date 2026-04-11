import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import RMBG2Swift

// MARK: - JSONL Output Helpers

func jsonLine(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        fflush(stdout)
    }
}

func errorLine(_ message: String) {
    jsonLine(["type": "error", "message": message])
}

func progressLine(stage: String, percent: Double, message: String? = nil) {
    var dict: [String: Any] = ["type": "progress", "stage": stage, "percent": percent]
    if let message = message { dict["message"] = message }
    jsonLine(dict)
}

// MARK: - Image I/O Helpers

func loadCGImage(from path: String) -> CGImage? {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        return nil
    }
    return image
}

func saveCGImage(_ image: CGImage, to path: String) -> Bool {
    let url = URL(fileURLWithPath: path)
    let utType = UTType.png
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, utType.identifier as CFString, 1, nil) else {
        return false
    }
    CGImageDestinationAddImage(dest, image, nil)
    return CGImageDestinationFinalize(dest)
}

// MARK: - Commands

func checkModel() async {
    // Use the same cache path as RMBG2Swift library
    let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    let modelDir = cacheDir
        .appendingPathComponent("models")
        .appendingPathComponent("VincentGOURBIN")
        .appendingPathComponent("RMBG-2-CoreML")

    // Check for compiled model (.mlmodelc)
    let compiledModel = modelDir.appendingPathComponent("RMBG-2-native-int8.mlmodelc")
    let modelReady = FileManager.default.fileExists(atPath: compiledModel.path)

    jsonLine([
        "type": "status",
        "downloaded": modelReady,
        "cachePath": modelDir.path
    ])
}

// Use cpuAndGPU — ANE (.all) can deadlock in CLI (non-app) processes,
// and cpuAndGPU is actually faster (~3s vs ~5s on M1 Pro).
let modelConfig = RMBG2Configuration.cpuAndGPU

// MARK: - Gitee Release backup

// 当 HuggingFace 下载失败时（例如国内网络），从 Gitee Release 拉取打包好的 .mlpackage.zip 作为备用源。
// Gitee Release 单文件有大小限制，所以把 zip 切成多份，按顺序拼回原 zip 再解压。
// 顺序必须严格按 aa → ab → ac 排列。
let giteeBackupParts: [String] = [
    "https://gitee.com/bluishoul/rmbg/releases/download/v0.2.0-RMBG-2-native-int8.mlpackage/RMBG-2-native-int8.mlpackage.zip.part-aa",
    "https://gitee.com/bluishoul/rmbg/releases/download/v0.2.0-RMBG-2-native-int8.mlpackage/RMBG-2-native-int8.mlpackage.zip.part-ab",
]

// 缓存目录与 RMBG2Swift 内部一致：~/Library/Caches/models/VincentGOURBIN/RMBG-2-CoreML
func modelCacheDir() -> URL {
    let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    return cacheDir
        .appendingPathComponent("models")
        .appendingPathComponent("VincentGOURBIN")
        .appendingPathComponent("RMBG-2-CoreML")
}

// 从 Gitee Release 分片下载 .mlpackage.zip，拼接后解压进缓存目录。
// 解压后 RMBG2Swift 在下次初始化时会发现缓存里的 .mlpackage 直接编译，不再触发网络下载。
func downloadFromGiteeBackup() async throws {
    guard !giteeBackupParts.isEmpty else {
        throw NSError(domain: "rmbg-sidecar", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "No Gitee backup parts configured"])
    }

    let cacheDir = modelCacheDir()
    if !FileManager.default.fileExists(atPath: cacheDir.path) {
        try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
    }

    let zipDest = cacheDir.appendingPathComponent("RMBG-2-native-int8.mlpackage.zip")
    if FileManager.default.fileExists(atPath: zipDest.path) {
        try? FileManager.default.removeItem(at: zipDest)
    }

    // 创建空的输出 zip，逐分片追加写入
    FileManager.default.createFile(atPath: zipDest.path, contents: nil)
    let outputHandle = try FileHandle(forWritingTo: zipDest)

    let session = URLSession.shared
    let totalParts = giteeBackupParts.count
    // 0 ~ 80% 给下载，80 ~ 100% 留给解压/编译
    let downloadShare: Double = 80.0

    do {
        for (index, urlString) in giteeBackupParts.enumerated() {
            guard let url = URL(string: urlString) else {
                throw NSError(domain: "rmbg-sidecar", code: 1,
                              userInfo: [NSLocalizedDescriptionKey: "Invalid Gitee backup URL: \(urlString)"])
            }

            let basePercent = Double(index) / Double(totalParts) * downloadShare
            progressLine(stage: "download", percent: basePercent,
                         message: "Downloading part \(index + 1)/\(totalParts) from Gitee...")

            let (tempURL, response) = try await session.download(from: url, delegate: nil)

            if let httpResponse = response as? HTTPURLResponse,
               !(200...299).contains(httpResponse.statusCode) {
                throw NSError(domain: "rmbg-sidecar", code: httpResponse.statusCode,
                              userInfo: [NSLocalizedDescriptionKey: "Gitee part \(index + 1) HTTP \(httpResponse.statusCode)"])
            }

            // 流式追加分片到目标 zip，避免一次性把 95MB 读进内存
            let inputHandle = try FileHandle(forReadingFrom: tempURL)
            while autoreleasepool(invoking: { () -> Bool in
                let chunk = inputHandle.readData(ofLength: 1 << 16) // 64KB
                if chunk.isEmpty { return false }
                outputHandle.write(chunk)
                return true
            }) {}
            try? inputHandle.close()
            try? FileManager.default.removeItem(at: tempURL)
        }
    } catch {
        try? outputHandle.close()
        try? FileManager.default.removeItem(at: zipDest)
        throw error
    }

    try? outputHandle.close()

    progressLine(stage: "download", percent: downloadShare, message: "Extracting model...")

    let unzip = Process()
    unzip.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
    unzip.arguments = ["-o", "-q", zipDest.path, "-d", cacheDir.path]
    try unzip.run()
    unzip.waitUntilExit()
    try? FileManager.default.removeItem(at: zipDest)

    guard unzip.terminationStatus == 0 else {
        throw NSError(domain: "rmbg-sidecar", code: 2,
                      userInfo: [NSLocalizedDescriptionKey: "Failed to unzip model package"])
    }

    progressLine(stage: "download", percent: 90, message: "Model extracted")
}

func downloadModel() async {
    progressLine(stage: "download", percent: 0, message: "Initializing model download...")

    // Step 1: 尝试默认下载（HuggingFace）
    do {
        let _ = try await RMBG2(configuration: modelConfig) { progress, status in
            let percent = progress * 100
            progressLine(stage: "download", percent: percent, message: "\(status)")
        }

        progressLine(stage: "download", percent: 100, message: "Model ready")
        jsonLine(["type": "done", "success": true])
        return
    } catch {
        // 默认源失败，回退到 Gitee Release
        progressLine(stage: "download", percent: 0,
                     message: "HuggingFace failed (\(error.localizedDescription)), trying Gitee mirror...")
    }

    // Step 2: 从 Gitee Release 下载并解压到缓存
    do {
        try await downloadFromGiteeBackup()
    } catch {
        errorLine("Failed to download model from Gitee mirror: \(error.localizedDescription)")
        return
    }

    // Step 3: 再次初始化 RMBG2 — 此时缓存中已有 .mlpackage，库只需编译，不会再触发网络下载
    do {
        let _ = try await RMBG2(configuration: modelConfig) { progress, status in
            let percent = progress * 100
            progressLine(stage: "download", percent: percent, message: "\(status)")
        }

        progressLine(stage: "download", percent: 100, message: "Model ready")
        jsonLine(["type": "done", "success": true])
    } catch {
        errorLine("Failed to compile model after Gitee download: \(error.localizedDescription)")
    }
}

func processImage(inputPath: String, outputPath: String) async {
    let startTime = CFAbsoluteTimeGetCurrent()

    // Load input image
    guard let inputImage = loadCGImage(from: inputPath) else {
        errorLine("Failed to load image: \(inputPath)")
        return
    }

    progressLine(stage: "inference", percent: 0, message: "Loading model...")

    do {
        let rmbg = try await RMBG2(configuration: modelConfig) { progress, status in
            // Only report download progress if model isn't cached yet
            let percent = progress * 100
            progressLine(stage: "download", percent: percent, message: "\(status)")
        }

        progressLine(stage: "inference", percent: 10, message: "Running inference...")

        let result = try await rmbg.removeBackground(from: inputImage)

        progressLine(stage: "inference", percent: 90, message: "Saving result...")

        // Save the result image (transparent background)
        guard saveCGImage(result.image, to: outputPath) else {
            errorLine("Failed to save result image to: \(outputPath)")
            return
        }

        let totalTime = CFAbsoluteTimeGetCurrent() - startTime

        jsonLine([
            "type": "result",
            "input": inputPath,
            "output": outputPath,
            "inferenceTime": result.inferenceTime,
            "totalTime": totalTime
        ])
    } catch {
        errorLine("Inference failed: \(error.localizedDescription)")
    }
}

// MARK: - Main

let args = CommandLine.arguments

guard args.count >= 2 else {
    errorLine("Usage: rmbg-sidecar <command> [args...]")
    errorLine("Commands: check-model, download-model, process <input> <output>")
    exit(1)
}

let command = args[1]

switch command {
case "check-model":
    await checkModel()

case "download-model":
    await downloadModel()

case "process":
    guard args.count >= 4 else {
        errorLine("Usage: rmbg-sidecar process <input-path> <output-path>")
        exit(1)
    }
    let inputPath = args[2]
    let outputPath = args[3]
    await processImage(inputPath: inputPath, outputPath: outputPath)

default:
    errorLine("Unknown command: \(command)")
    errorLine("Commands: check-model, download-model, process <input> <output>")
    exit(1)
}
