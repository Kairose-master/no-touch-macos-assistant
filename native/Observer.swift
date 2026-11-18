import AppKit
import Foundation
NSApplication.shared.setActivationPolicy(.prohibited)
let initialCursor = NSEvent.mouseLocation
let initialFrontmost = NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
var activations = 0
var activationBundles: [String] = []
var cursorChanged = false
let center = NSWorkspace.shared.notificationCenter
let observer = center.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { notification in
    activations += 1
    let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
    activationBundles.append(app?.bundleIdentifier ?? "unknown")
}
let timer = Timer.scheduledTimer(withTimeInterval: 0.025, repeats: true) { _ in
    let point = NSEvent.mouseLocation
    if point.x != initialCursor.x || point.y != initialCursor.y { cursorChanged = true }
}
func emit(_ value: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}
func finish() {
    timer.invalidate()
    center.removeObserver(observer)
    emit(["ready": false, "focusActivationEvents": activations, "activationBundles": activationBundles, "focusUnchangedThroughout": activations == 0 && initialFrontmost == (NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""), "cursorUnchangedThroughout": !cursorChanged, "cursorSampleIntervalMs": 25])
    exit(0)
}
DispatchQueue.global().async {
    _ = readLine()
    DispatchQueue.main.async { finish() }
}
let watchdog = Timer.scheduledTimer(withTimeInterval: 300, repeats: false) { _ in finish() }
emit(["ready": true])
NSApplication.shared.run()
