import Capacitor
import Foundation
import WidgetKit

@objc(WidgetBridgePlugin)
public final class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveWidgetPayload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingDeepLink", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleDeepLinkNotification(_:)),
            name: CoffeeLogWidgetBridgeConstants.deepLinkNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func saveWidgetPayload(_ call: CAPPluginCall) {
        guard let payload = call.getString("payload") else {
            call.reject("Missing widget payload.")
            return
        }

        guard let defaults = UserDefaults(suiteName: CoffeeLogWidgetBridgeConstants.appGroupID) else {
            call.reject("Unable to open App Group container.")
            return
        }

        defaults.set(payload, forKey: CoffeeLogWidgetBridgeConstants.payloadKey)
        defaults.set(Date().timeIntervalSince1970, forKey: CoffeeLogWidgetBridgeConstants.payloadUpdatedAtKey)
        defaults.synchronize()

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve()
    }

    @objc func getPendingDeepLink(_ call: CAPPluginCall) {
        let url = WidgetBridgeStore.shared.consumePendingDeepLink()
        call.resolve([
            "url": url as Any
        ])
    }

    @objc private func handleDeepLinkNotification(_ notification: Notification) {
        guard let url = notification.userInfo?["url"] as? String else {
            return
        }

        notifyListeners("deepLinkOpened", data: [
            "url": url
        ])
    }
}
