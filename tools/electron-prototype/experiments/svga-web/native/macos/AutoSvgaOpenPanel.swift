import AppKit
import Darwin
import Foundation

private struct PickerResult: Encodable {
    let status: String
    let filePath: String?
}

private let channelPrefix = "auto-svga-native-picker-"
private let channelArgumentPrefix = "--auto-svga-picker-channel="
private let channelRootArgumentPrefix = "--auto-svga-picker-root="
private let parentPIDArgumentPrefix = "--auto-svga-picker-parent-pid="
private let pickerLifetime: TimeInterval = 120

private struct PickerChannel {
    let descriptor: Int32
    let rootPath: String
}

private func isLowercaseHexToken(_ token: String) -> Bool {
    token.count == 32 && token.unicodeScalars.allSatisfy {
        (UnicodeScalar("0")...UnicodeScalar("9")).contains($0)
            || (UnicodeScalar("a")...UnicodeScalar("f")).contains($0)
    }
}

private func openResultFile(channelToken: String, rootPath: String) -> PickerChannel? {
    let rootURL = URL(fileURLWithPath: rootPath, isDirectory: true)
    guard rootURL.path == rootPath,
          rootURL.lastPathComponent == "\(channelPrefix)\(channelToken)" else {
        return nil
    }
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
    return PickerChannel(descriptor: descriptor, rootPath: rootPath)
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

private final class PickerLifecycleGuard {
    private let parentPID: pid_t
    private let channelRootPath: String
    private let deadline: Date
    private let writer: PickerResultWriter
    private var timer: Timer?

    init(parentPID: pid_t, channelRootPath: String, writer: PickerResultWriter) {
        self.parentPID = parentPID
        self.channelRootPath = channelRootPath
        self.deadline = Date().addingTimeInterval(pickerLifetime)
        self.writer = writer
    }

    func start() {
        let lifecycleTimer = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.verifyOwnerAndChannel()
        }
        lifecycleTimer.tolerance = 0.02
        RunLoop.main.add(lifecycleTimer, forMode: .common)
        timer = lifecycleTimer
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    private func verifyOwnerAndChannel() {
        errno = 0
        let parentIsAlive = kill(parentPID, 0) == 0 || errno == EPERM
        if !parentIsAlive
            || !FileManager.default.fileExists(atPath: channelRootPath)
            || Date() >= deadline {
            NSApp.abortModal()
            writer.finish(status: "failed", exitCode: 1)
        }
    }
}

guard CommandLine.arguments.count == 4,
      let channelArgument = CommandLine.arguments.first(where: { $0.hasPrefix(channelArgumentPrefix) }),
      let rootArgument = CommandLine.arguments.first(where: { $0.hasPrefix(channelRootArgumentPrefix) }),
      let parentArgument = CommandLine.arguments.first(where: { $0.hasPrefix(parentPIDArgumentPrefix) }) else {
    exit(2)
}
let channelToken = String(channelArgument.dropFirst(channelArgumentPrefix.count))
let channelRootPath = String(rootArgument.dropFirst(channelRootArgumentPrefix.count))
let parentPIDValue = String(parentArgument.dropFirst(parentPIDArgumentPrefix.count))
guard isLowercaseHexToken(channelToken),
      let parentPID = Int32(parentPIDValue),
      parentPID > 1,
      let channel = openResultFile(channelToken: channelToken, rootPath: channelRootPath) else {
    exit(2)
}
private let writer = PickerResultWriter(descriptor: channel.descriptor)

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
application.finishLaunching()

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
panel.center()
panel.makeKeyAndOrderFront(nil)
application.activate(ignoringOtherApps: true)
panel.orderFrontRegardless()

private let lifecycleGuard = PickerLifecycleGuard(
    parentPID: parentPID,
    channelRootPath: channel.rootPath,
    writer: writer
)
lifecycleGuard.start()

switch panel.runModal() {
case .OK:
    lifecycleGuard.stop()
    guard let selectedPath = panel.url?.path, !selectedPath.isEmpty else {
        writer.finish(status: "failed", exitCode: 1)
    }
    writer.finish(status: "selected", filePath: selectedPath)
case .cancel:
    lifecycleGuard.stop()
    writer.finish(status: "cancelled")
default:
    lifecycleGuard.stop()
    writer.finish(status: "failed", exitCode: 1)
}
