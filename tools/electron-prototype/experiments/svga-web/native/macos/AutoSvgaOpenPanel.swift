import AppKit
import Foundation

private struct PickerResult: Encodable {
    let status: String
    let filePath: String?
}

private final class PickerResultWriter {
    private var didWrite = false

    func finish(status: String, filePath: String? = nil, exitCode: Int32 = 0) -> Never {
        guard !didWrite else {
            exit(1)
        }
        didWrite = true

        let result = PickerResult(status: status, filePath: filePath)
        let data = (try? JSONEncoder().encode(result))
            ?? Data("{\"status\":\"failed\"}".utf8)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data("\n".utf8))
        FileHandle.standardOutput.synchronizeFile()
        FileHandle.standardOutput.closeFile()
        exit(exitCode)
    }
}

private let writer = PickerResultWriter()

guard CommandLine.arguments.count == 1 else {
    writer.finish(status: "failed", exitCode: 2)
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
application.finishLaunching()
application.activate(ignoringOtherApps: true)

let panel = NSOpenPanel()
panel.title = "打开文件"
panel.prompt = "打开"
panel.message = "选择 SVGA、Lottie JSON 或 VAP MP4 文件"
panel.canChooseFiles = true
panel.canChooseDirectories = false
panel.allowsMultipleSelection = false
panel.resolvesAliases = false
panel.treatsFilePackagesAsDirectories = false
if #available(macOS 11.0, *) {
    panel.allowedContentTypes = []
} else {
    panel.allowedFileTypes = nil
}
panel.allowsOtherFileTypes = true

switch panel.runModal() {
case .OK:
    guard let selectedPath = panel.url?.path, !selectedPath.isEmpty else {
        writer.finish(status: "failed", exitCode: 1)
    }
    writer.finish(status: "selected", filePath: selectedPath)
case .cancel:
    writer.finish(status: "cancelled")
default:
    writer.finish(status: "failed", exitCode: 1)
}
