import AppKit
import Darwin
import Foundation

private struct PickerResult: Encodable {
    let status: String
    let filePath: String?
}

private let channelPrefix = "auto-svga-native-picker-"
private let channelArgumentPrefix = "--auto-svga-picker-channel="

private func isLowercaseHexToken(_ token: String) -> Bool {
    token.count == 32 && token.unicodeScalars.allSatisfy {
        (UnicodeScalar("0")...UnicodeScalar("9")).contains($0)
            || (UnicodeScalar("a")...UnicodeScalar("f")).contains($0)
    }
}

private func openResultFile(channelToken: String) -> Int32? {
    let rootPath = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        .appendingPathComponent("\(channelPrefix)\(channelToken)", isDirectory: true)
        .path
    var rootStats = stat()
    guard lstat(rootPath, &rootStats) == 0,
          (rootStats.st_mode & S_IFMT) == S_IFDIR,
          rootStats.st_uid == geteuid(),
          (rootStats.st_mode & 0o7777) == 0o700 else {
        return nil
    }

    let resultPath = URL(fileURLWithPath: rootPath, isDirectory: true)
        .appendingPathComponent("picker-result.json", isDirectory: false)
        .path
    let descriptor = Darwin.open(resultPath, O_WRONLY | O_NOFOLLOW)
    guard descriptor >= 0 else {
        return nil
    }

    var resultStats = stat()
    guard fstat(descriptor, &resultStats) == 0,
          (resultStats.st_mode & S_IFMT) == S_IFREG,
          resultStats.st_uid == geteuid(),
          resultStats.st_nlink == 1,
          (resultStats.st_mode & 0o7777) == 0o600,
          resultStats.st_size == 0 else {
        Darwin.close(descriptor)
        return nil
    }
    return descriptor
}

private final class PickerResultWriter {
    private let descriptor: Int32
    private var didWrite = false

    init(descriptor: Int32) {
        self.descriptor = descriptor
    }

    func finish(status: String, filePath: String? = nil, exitCode: Int32 = 0) -> Never {
        guard !didWrite else {
            exit(1)
        }
        didWrite = true

        let result = PickerResult(status: status, filePath: filePath)
        var data = (try? JSONEncoder().encode(result))
            ?? Data("{\"status\":\"failed\"}".utf8)
        data.append(0x0a)
        let complete = data.withUnsafeBytes { rawBuffer -> Bool in
            guard let baseAddress = rawBuffer.baseAddress else {
                return false
            }
            var offset = 0
            while offset < rawBuffer.count {
                let written = Darwin.write(
                    descriptor,
                    baseAddress.advanced(by: offset),
                    rawBuffer.count - offset
                )
                if written <= 0 {
                    return false
                }
                offset += written
            }
            return true
        }
        if complete {
            _ = fsync(descriptor)
        }
        Darwin.close(descriptor)
        guard complete else {
            exit(1)
        }
        exit(exitCode)
    }
}

guard CommandLine.arguments.count == 2,
      CommandLine.arguments[1].hasPrefix(channelArgumentPrefix) else {
    exit(2)
}
let channelToken = String(CommandLine.arguments[1].dropFirst(channelArgumentPrefix.count))
guard isLowercaseHexToken(channelToken),
      let resultDescriptor = openResultFile(channelToken: channelToken) else {
    exit(2)
}
private let writer = PickerResultWriter(descriptor: resultDescriptor)

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
