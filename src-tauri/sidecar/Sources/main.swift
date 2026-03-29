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

func downloadModel() async {
    do {
        progressLine(stage: "download", percent: 0, message: "Initializing model download...")

        let _ = try await RMBG2(configuration: modelConfig) { progress, status in
            let percent = progress * 100
            progressLine(stage: "download", percent: percent, message: "\(status)")
        }

        progressLine(stage: "download", percent: 100, message: "Model ready")
        jsonLine(["type": "done", "success": true])
    } catch {
        errorLine("Failed to download model: \(error.localizedDescription)")
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
