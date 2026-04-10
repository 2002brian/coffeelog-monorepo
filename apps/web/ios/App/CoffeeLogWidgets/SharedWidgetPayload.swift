import Foundation

enum CoffeeLogWidgetConstants {
    static let appGroupID = "group.com.brianwu.coffeelog"
    static let payloadKey = "coffeelog.widget.payload"
}

struct CoffeeLogWidgetPayload: Decodable {
    struct Counts: Decodable {
        let total: Int
        let today: Int
        let week: Int
    }

    struct Scores: Decodable {
        let weekAverage: Double?
        let recentAverage: Double?
        let latest: Double?
    }

    struct BestRecipe: Decodable {
        let beanName: String
        let equipmentName: String
        let score: Double
        let brewedAt: Double
        let ratio: String
    }

    struct TrendPoint: Decodable {
        let label: String
        let cups: Int
        let score: Double?
    }

    let status: String
    let generatedAt: Double
    let counts: Counts
    let scores: Scores
    let bestRecipe: BestRecipe?
    let trend: [TrendPoint]
    let updatedAt: Double?
}

enum WidgetStatusStyle {
    case noData
    case insufficientData
    case needsTweak
    case hallOfFame
    case normal

    init(rawValue: String) {
        switch rawValue {
        case "no_data":
            self = .noData
        case "insufficient_data":
            self = .insufficientData
        case "needs_tweak":
            self = .needsTweak
        case "hall_of_fame":
            self = .hallOfFame
        default:
            self = .normal
        }
    }

    var label: String {
        switch self {
        case .noData:
            return "等待第一杯"
        case .insufficientData:
            return "慢慢累積"
        case .needsTweak:
            return "風味探索中"
        case .hallOfFame:
            return "今日驚喜"
        case .normal:
            return "穩穩沖煮"
        }
    }

    var title: String {
        switch self {
        case .noData:
            return "從第一杯開始"
        case .insufficientData:
            return "再多記錄幾杯"
        case .needsTweak:
            return "試著微調看看"
        case .hallOfFame:
            return "把驚喜留住"
        case .normal:
            return "維持好節奏"
        }
    }
}

enum WidgetDeepLink {
    static func small(for status: WidgetStatusStyle) -> URL {
        switch status {
        case .noData, .insufficientData:
            return URL(string: "coffeelog://brew/new?source=widget&size=small")!
        case .needsTweak, .normal, .hallOfFame:
            return URL(string: "coffeelog://records?source=widget&size=small")!
        }
    }

    static func medium(hasBestRecipe: Bool) -> URL {
        if hasBestRecipe {
            return URL(string: "coffeelog://brew/new?source=widget&size=medium&recipe=best")!
        }

        return URL(string: "coffeelog://records?source=widget&size=medium")!
    }
}

enum CoffeeLogWidgetStore {
    static func loadPayload() -> CoffeeLogWidgetPayload? {
        guard
            let defaults = UserDefaults(suiteName: CoffeeLogWidgetConstants.appGroupID),
            let rawValue = defaults.string(forKey: CoffeeLogWidgetConstants.payloadKey),
            let data = rawValue.data(using: .utf8)
        else {
            return nil
        }

        return try? JSONDecoder().decode(CoffeeLogWidgetPayload.self, from: data)
    }
}
