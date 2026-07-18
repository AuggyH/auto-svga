import AppKit
import Foundation

private struct PickerResult: Encodable {
    let status: String
    let filePath: String?
}

private func writeResult(status: String, filePath: String? = nil) {
    let result = PickerResult(status: status, filePath: filePath)
    guard let data = try? JSONEncoder().encode(result) else {
        FileHandle.standardOutput.write(Data("{\"status\":\"failed\"}\n".utf8))
        return
    }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}

guard CommandLine.arguments.count == 1 else {
    writeResult(status: "failed")
    exit(2)
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
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
        writeResult(status: "failed")
        exit(1)
    }
    writeResult(status: "selected", filePath: selectedPath)
case .cancel:
    writeResult(status: "cancelled")
default:
    writeResult(status: "failed")
}
