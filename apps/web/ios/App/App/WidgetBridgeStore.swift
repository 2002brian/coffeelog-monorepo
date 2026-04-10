import Foundation

enum CoffeeLogWidgetBridgeConstants {
    static let appGroupID = "group.com.brianwu.coffeelog"
    static let payloadKey = "coffeelog.widget.payload"
    static let payloadUpdatedAtKey = "coffeelog.widget.payload.updatedAt"
    static let deepLinkNotification = Notification.Name("CoffeeLogWidgetDeepLinkOpened")
}

final class WidgetBridgeStore {
    static let shared = WidgetBridgeStore()

    private let lock = NSLock()
    private var pendingDeepLinkURL: String?

    private init() {}

    func setPendingDeepLink(url: String) {
        lock.lock()
        pendingDeepLinkURL = url
        lock.unlock()
    }

    func consumePendingDeepLink() -> String? {
        lock.lock()
        defer {
            pendingDeepLinkURL = nil
            lock.unlock()
        }

        return pendingDeepLinkURL
    }
}
