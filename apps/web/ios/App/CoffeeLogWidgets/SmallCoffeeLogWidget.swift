import SwiftUI
import WidgetKit

private struct SmallWidgetView: View {
    let entry: CoffeeLogWidgetEntry

    private let cornerRadius: CGFloat = 28

    private var status: WidgetStatusStyle {
        WidgetStatusStyle(rawValue: entry.payload?.status ?? "no_data")
    }

    private var primaryValue: String {
        guard let payload = entry.payload else {
            return "0"
        }

        switch status {
        case .noData:
            return "0"
        case .insufficientData:
            return "\(payload.counts.total)"
        case .needsTweak:
            return formatScore(payload.scores.recentAverage)
        case .hallOfFame:
            return formatScore(payload.bestRecipe?.score ?? payload.scores.latest)
        case .normal:
            return "\(payload.counts.week)"
        }
    }

    private var primaryLabel: String {
        switch status {
        case .noData, .normal:
            return "本週沖煮"
        case .insufficientData:
            return "已記錄杯數"
        case .needsTweak:
            return "最近 3 杯"
        case .hallOfFame:
            return "最佳分數"
        }
    }

    private var secondaryValue: String {
        guard let payload = entry.payload else {
            return "尚無資料"
        }

        switch status {
        case .noData:
            return "從第一杯開始"
        case .insufficientData:
            return "再 \(max(0, 3 - payload.counts.total)) 杯"
        case .needsTweak:
            return "本週 \(payload.counts.week) 杯"
        case .hallOfFame, .normal:
            return "平均 \(formatScore(payload.scores.weekAverage))"
        }
    }

    var body: some View {
        widgetContainer {
            VStack(alignment: .leading, spacing: 12) {
                Text(status.label)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)

                VStack(alignment: .leading, spacing: 4) {
                    Text(primaryLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(primaryValue)
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)
                        .minimumScaleFactor(0.65)
                }

                Spacer()

                VStack(alignment: .leading, spacing: 4) {
                    Text(status.title)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(secondaryValue)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(18)
        }
        .widgetURL(WidgetDeepLink.small(for: status))
    }

    @ViewBuilder
    private func widgetContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content()
                .containerBackground(for: .widget) {
                    backgroundGradient
                }
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(backgroundGradient)
                content()
            }
        }
    }

    private var backgroundGradient: LinearGradient {
        switch status {
        case .needsTweak:
            return LinearGradient(colors: [Color(red: 0.30, green: 0.12, blue: 0.14), Color(red: 0.14, green: 0.08, blue: 0.10)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .hallOfFame:
            return LinearGradient(colors: [Color(red: 0.13, green: 0.22, blue: 0.17), Color(red: 0.08, green: 0.12, blue: 0.10)], startPoint: .topLeading, endPoint: .bottomTrailing)
        default:
            return LinearGradient(colors: [Color(red: 0.15, green: 0.15, blue: 0.17), Color(red: 0.08, green: 0.08, blue: 0.10)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }

    private func formatScore(_ value: Double?) -> String {
        guard let value else {
            return "0.0"
        }

        return String(format: "%.1f", value)
    }
}

struct SmallCoffeeLogWidget: Widget {
    let kind = "SmallCoffeeLogWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CoffeeLogWidgetProvider()) { entry in
            SmallWidgetView(entry: entry)
        }
        .configurationDisplayName("CoffeeLog Small")
        .description("顯示本週摘要與關鍵狀態。")
        .supportedFamilies([.systemSmall])
    }
}
