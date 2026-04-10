import Foundation
import WidgetKit

struct CoffeeLogWidgetEntry: TimelineEntry {
    let date: Date
    let payload: CoffeeLogWidgetPayload?
}

struct CoffeeLogWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> CoffeeLogWidgetEntry {
        CoffeeLogWidgetEntry(date: Date(), payload: CoffeeLogWidgetStore.loadPayload())
    }

    func getSnapshot(in context: Context, completion: @escaping (CoffeeLogWidgetEntry) -> Void) {
        completion(CoffeeLogWidgetEntry(date: Date(), payload: CoffeeLogWidgetStore.loadPayload()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CoffeeLogWidgetEntry>) -> Void) {
        let entry = CoffeeLogWidgetEntry(date: Date(), payload: CoffeeLogWidgetStore.loadPayload())
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}
