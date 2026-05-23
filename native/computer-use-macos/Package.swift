// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SerperComputerUseMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "SerperComputerUseMacOSCore",
            targets: ["SerperComputerUseMacOSCore"]
        ),
        .executable(
            name: "serper-computer-use-macos",
            targets: ["SerperComputerUseMacOS"]
        )
    ],
    targets: [
        .target(
            name: "SerperComputerUseMacOSCore",
            path: "Sources/SerperComputerUseMacOSCore"
        ),
        .executableTarget(
            name: "SerperComputerUseMacOS",
            dependencies: ["SerperComputerUseMacOSCore"],
            path: "Sources/SerperComputerUseMacOS"
        ),
        .testTarget(
            name: "SerperComputerUseMacOSTests",
            dependencies: ["SerperComputerUseMacOSCore"],
            path: "Tests/SerperComputerUseMacOSTests"
        )
    ]
)
