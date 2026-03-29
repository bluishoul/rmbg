// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "rmbg-sidecar",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [
        .package(url: "https://github.com/VincentGourbin/RMBG2Swift", branch: "main")
    ],
    targets: [
        .executableTarget(
            name: "rmbg-sidecar",
            dependencies: ["RMBG2Swift"],
            path: "Sources"
        )
    ]
)
