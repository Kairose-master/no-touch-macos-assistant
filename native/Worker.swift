import AppKit
import EventKit
import Foundation

struct Request: Decodable {
    let operation: String
    let title: String?
    let dueAt: String?
    let timeZone: String?
    let calendarId: String?
    let reminderId: String?
    let operationId: String?
    let folder: String?
}
enum WorkerError: Error { case blocked(String) }
func require(_ condition: Bool, _ code: String) throws { if !condition { throw WorkerError.blocked(code) } }
func iso(_ date: Date) -> String { ISO8601DateFormatter().string(from: date) }
func dateFrom(_ text: String) -> Date? {
    let f = ISO8601DateFormatter()
    if let date = f.date(from: text) { return date }
    f.formatOptions.insert(.withFractionalSeconds)
    return f.date(from: text)
}
func authorized() throws {
    try require(EKEventStore.authorizationStatus(for: .reminder) == .fullAccess, "REMINDERS_ACCESS_REQUIRED")
}
func ownCalendar(_ store: EKEventStore, _ identifier: String?) throws -> EKCalendar {
    try authorized()
    guard let identifier, let calendar = store.calendar(withIdentifier: identifier) else { throw WorkerError.blocked("OWN_CALENDAR_MISSING") }
    try require(calendar.title.hasPrefix("NoTouch Demo"), "CALENDAR_OUT_OF_SCOPE")
    return calendar
}
func reminders(_ store: EKEventStore, _ calendar: EKCalendar) async -> [EKReminder] {
    await withCheckedContinuation { continuation in
        store.fetchReminders(matching: store.predicateForReminders(in: [calendar])) { continuation.resume(returning: $0 ?? []) }
    }
}
func record(_ reminder: EKReminder) throws -> [String: Any] {
    guard let due = reminder.dueDateComponents, let zone = due.timeZone,
          let date = due.date ?? due.calendar?.date(from: due) else { throw WorkerError.blocked("DUE_DATE_UNVERIFIED") }
    return ["reminderId": reminder.calendarItemIdentifier, "title": reminder.title ?? "", "dueAt": iso(date), "timeZone": zone.identifier, "hasAlarm": reminder.hasAlarms, "verified": true]
}
@main
@MainActor
struct Worker {
    static func main() async {
        NSApplication.shared.setActivationPolicy(.accessory)
        do {
            let request = try JSONDecoder().decode(Request.self, from: FileHandle.standardInput.readDataToEndOfFile())
            let result = try await perform(request)
            let data = try JSONSerialization.data(withJSONObject: ["ok": true, "data": result], options: [.sortedKeys])
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data("\n".utf8))
        } catch {
            let code: String
            if case WorkerError.blocked(let reason) = error { code = reason } else { code = "NATIVE_OPERATION_FAILED" }
            let data = try! JSONSerialization.data(withJSONObject: ["ok": false, "error": ["code": code]])
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data("\n".utf8))
            exit(1)
        }
    }
    static func perform(_ request: Request) async throws -> [String: Any] {
        switch request.operation {
        case "status":
            return ["remindersAuthorization": EKEventStore.authorizationStatus(for: .reminder).rawValue, "fullAccess": EKEventStore.authorizationStatus(for: .reminder) == .fullAccess, "bundleId": Bundle.main.bundleIdentifier ?? "unknown"]
        case "desktop-state":
            let point = NSEvent.mouseLocation
            return ["frontmostBundleId": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "", "cursorX": point.x, "cursorY": point.y]
        case "request-reminders":
            let store = EKEventStore()
            let granted = try await store.requestFullAccessToReminders()
            return ["granted": granted]
        case "prepare-reminders":
            try authorized()
            let store = EKEventStore()
            guard let title = request.title, title.hasPrefix("NoTouch Demo"), title.count <= 100 else { throw WorkerError.blocked("INVALID_SAMPLE_LIST") }
            let matches = store.calendars(for: .reminder).filter { $0.title == title }
            try require(matches.count <= 1, "AMBIGUOUS_SAMPLE_LIST")
            if let existing = matches.first { return ["calendarId": existing.calendarIdentifier, "title": existing.title] }
            guard let source = store.sources.first(where: { $0.sourceType == .local }) ?? store.defaultCalendarForNewReminders()?.source else { throw WorkerError.blocked("NO_REMINDER_SOURCE") }
            let calendar = EKCalendar(for: .reminder, eventStore: store)
            calendar.title = title
            calendar.source = source
            try store.saveCalendar(calendar, commit: true)
            return ["calendarId": calendar.calendarIdentifier, "title": calendar.title]
        case "create-reminder":
            let store = EKEventStore()
            let calendar = try ownCalendar(store, request.calendarId)
            guard let title = request.title, title.hasPrefix("NoTouch Demo"), title.count <= 200,
                  let dueText = request.dueAt, let due = dateFrom(dueText),
                  let timeZoneName = request.timeZone, let zone = TimeZone(identifier: timeZoneName),
                  let operationId = request.operationId, operationId.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw WorkerError.blocked("INVALID_REMINDER_INPUT") }
            let operationURL = URL(string: "notouch-operation://" + operationId)!
            let existing = await reminders(store, calendar).filter { $0.url == operationURL }
            try require(existing.count <= 1, "AMBIGUOUS_OPERATION")
            if let reminder = existing.first {
                let output = try record(reminder)
                try require(reminder.title == title && output["dueAt"] as? String == iso(due), "OPERATION_INPUT_CHANGED")
                return output
            }
            var gregorian = Calendar(identifier: .gregorian)
            gregorian.timeZone = zone
            var components = gregorian.dateComponents([.year, .month, .day, .hour, .minute, .second], from: due)
            components.calendar = gregorian
            components.timeZone = zone
            let reminder = EKReminder(eventStore: store)
            reminder.calendar = calendar
            reminder.title = title
            reminder.dueDateComponents = components
            reminder.url = operationURL
            reminder.addAlarm(EKAlarm(absoluteDate: due))
            try store.save(reminder, commit: true)
            return try record(reminder)
        case "read-reminder":
            let store = EKEventStore()
            let calendar = try ownCalendar(store, request.calendarId)
            guard let identifier = request.reminderId, let reminder = store.calendarItem(withIdentifier: identifier) as? EKReminder else { throw WorkerError.blocked("OWN_REMINDER_MISSING") }
            try require(reminder.calendar.calendarIdentifier == calendar.calendarIdentifier && reminder.title.hasPrefix("NoTouch Demo"), "REMINDER_OUT_OF_SCOPE")
            return try record(reminder)
        case "open-folder":
            guard let folder = request.folder else { throw WorkerError.blocked("SAMPLE_FOLDER_REQUIRED") }
            let url = URL(fileURLWithPath: folder).standardizedFileURL
            try require(url.resolvingSymlinksInPath().path == url.path && url.lastPathComponent == "files", "UNSAFE_SAMPLE_FOLDER")
            let marker = url.deletingLastPathComponent().appendingPathComponent(".no-touch-fixture")
            let markerValue = try String(contentsOf: marker, encoding: .utf8)
            try require(markerValue == "no-touch-fixture-v1", "SAMPLE_MARKER_REQUIRED")
            guard let finder = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.finder") else { throw WorkerError.blocked("FINDER_UNAVAILABLE") }
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.activates = false
            configuration.addsToRecentItems = false
            configuration.promptsUserIfNeeded = false
            let _ = try await NSWorkspace.shared.open([url], withApplicationAt: finder, configuration: configuration)
            return ["opened": true, "activationRequested": false]
        default: throw WorkerError.blocked("OPERATION_NOT_ALLOWED")
        }
    }
}
