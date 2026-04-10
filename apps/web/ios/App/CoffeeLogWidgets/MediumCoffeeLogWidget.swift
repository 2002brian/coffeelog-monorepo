import SwiftUI
import WidgetKit

private struct MediumWidgetView: View {
    let entry: CoffeeLogWidgetEntry

    private let cornerRadius: CGFloat = 30

    private var status: WidgetStatusStyle {
        WidgetStatusStyle(rawValue: entry.payload?.status ?? "no_data")
    }

    var body: some View {
        widgetContainer {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("本週趨勢")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)

                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text("\(entry.payload?.counts.week ?? 0)")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(.primary)
                        Text("杯")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    HStack(alignment: .bottom, spacing: 6) {
                        ForEach(Array((entry.payload?.trend ?? []).enumerated()), id: \.offset) { _, point in
                            Capsule()
                                .fill(point.score == nil ? Color.white.opacity(0.12) : Color.white.opacity(0.72))
                                .frame(width: 12, height: barHeight(for: point.score))
                        }
                    }
                    .frame(height: 54, alignment: .bottom)

                    Text(status.title)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.primary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: 10) {
                    Text("風味之選")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)

                    if let bestRecipe = entry.payload?.bestRecipe {
                        Text(bestRecipe.beanName)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                        Text(bestRecipe.equipmentName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)

                        Spacer(minLength: 6)

                        HStack(alignment: .lastTextBaseline, spacing: 6) {
                            Text(String(format: "%.1f", bestRecipe.score))
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundStyle(scoreColor)
                            Text(bestRecipe.ratio)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        Spacer()
                        Text("先多記錄幾杯，這裡會慢慢浮現你的風味之選。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.leading)
                        Spacer()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(15)
                .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(18)
        }
        .widgetURL(WidgetDeepLink.medium(hasBestRecipe: entry.payload?.bestRecipe != nil))
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
            return LinearGradient(colors: [Color(red: 0.28, green: 0.12, blue: 0.13), Color(red: 0.10, green: 0.08, blue: 0.10)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .hallOfFame:
            return LinearGradient(colors: [Color(red: 0.16, green: 0.24, blue: 0.18), Color(red: 0.09, green: 0.11, blue: 0.10)], startPoint: .topLeading, endPoint: .bottomTrailing)
        default:
            return LinearGradient(colors: [Color(red: 0.14, green: 0.15, blue: 0.18), Color(red: 0.08, green: 0.09, blue: 0.11)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }

    private var scoreColor: Color {
        switch status {
        case .needsTweak:
            return Color(red: 1.0, green: 0.52, blue: 0.49)
        case .hallOfFame:
            return Color(red: 0.52, green: 0.88, blue: 0.64)
        default:
            return .primary
        }
    }

    private func barHeight(for score: Double?) -> CGFloat {
        guard let score else {
            return 14
        }

        return CGFloat(16 + (score / 5.0) * 34)
    }
}

struct MediumCoffeeLogWidget: Widget {
    let kind = "MediumCoffeeLogWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CoffeeLogWidgetProvider()) { entry in
            MediumWidgetView(entry: entry)
        }
        .configurationDisplayName("CoffeeLog Medium")
        .description("顯示近期節奏與風味之選。")
        .supportedFamilies([.systemMedium])
    }
}
