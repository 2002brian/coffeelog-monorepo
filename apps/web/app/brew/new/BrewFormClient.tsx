"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import TactileSlider from "@/components/TactileSlider";
import { useBrewData } from "@/hooks/useBrewData";
import {
  triggerLightImpact,
  triggerSuccessNotification,
  triggerWarningNotification,
} from "@/lib/haptics";

type SensoryName = "acidity" | "sweetness" | "body" | "bitterness";
type QuickPreset = {
  id: string;
  title: string;
  summary: string;
  equipmentType?: string;
  equipmentKeywords?: string[];
  values: {
    dose: string;
    water: string;
    temperature: string;
    grindSize: string;
    brewMinutes: string;
    brewSeconds: string;
    bloomMinutes: string;
    bloomSeconds: string;
    sensory?: Partial<Record<SensoryName, number>>;
  };
};

const sensoryDescriptors: Record<SensoryName, string[]> = {
  acidity: ["柔和", "圓潤", "明亮", "活潑", "鮮明"],
  sweetness: ["乾淨", "柔甜", "均衡", "糖漿感", "飽滿"],
  body: ["清透", "絲滑", "圓厚", "綿密", "厚實"],
  bitterness: ["輕柔", "低苦", "結構感", "明顯", "濃烈"],
};

const sensoryMeta: Array<{ name: SensoryName; label: string }> = [
  { name: "acidity", label: "酸度" },
  { name: "sweetness", label: "甜度" },
  { name: "body", label: "醇厚感" },
  { name: "bitterness", label: "苦味強度" },
];

const quickPresets: QuickPreset[] = [
  {
    id: "v60-light",
    title: "V60 標準淺焙",
    summary: "15g · 250g · 92°C",
    equipmentType: "濾杯",
    equipmentKeywords: ["v60", "濾杯"],
    values: {
      dose: "15",
      water: "250",
      temperature: "92",
      grindSize: "24 clicks",
      brewMinutes: "2",
      brewSeconds: "30",
      bloomMinutes: "0",
      bloomSeconds: "30",
      sensory: { acidity: 4, sweetness: 3, body: 2, bitterness: 2 },
    },
  },
  {
    id: "balanced-pour-over",
    title: "均衡手沖預設",
    summary: "18g · 280g · 93°C",
    equipmentType: "濾杯",
    equipmentKeywords: ["kalita", "wave", "origami", "濾杯"],
    values: {
      dose: "18",
      water: "280",
      temperature: "93",
      grindSize: "中細研磨",
      brewMinutes: "2",
      brewSeconds: "45",
      bloomMinutes: "0",
      bloomSeconds: "35",
      sensory: { acidity: 3, sweetness: 4, body: 4, bitterness: 2 },
    },
  },
  {
    id: "iced-pour-over",
    title: "冰手沖基礎",
    summary: "20g · 240g · 90°C",
    equipmentType: "濾杯",
    equipmentKeywords: ["v60", "origami", "濾杯"],
    values: {
      dose: "20",
      water: "240",
      temperature: "90",
      grindSize: "中研磨",
      brewMinutes: "2",
      brewSeconds: "20",
      bloomMinutes: "0",
      bloomSeconds: "40",
      sensory: { acidity: 4, sweetness: 4, body: 3, bitterness: 2 },
    },
  },
];

function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeTimePart(
  event: ChangeEvent<HTMLInputElement>,
  options?: { max?: number }
) {
  const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 2);
  if (!digitsOnly) return "";

  const numeric = Number(digitsOnly);
  if (!Number.isFinite(numeric)) return "";

  if (options?.max !== undefined) {
    return String(Math.min(numeric, options.max));
  }

  return String(numeric);
}

function formatClock(minutes: string, seconds: string) {
  const minuteValue = minutes ? minutes.padStart(2, "0") : "00";
  const secondValue = seconds ? seconds.padStart(2, "0") : "00";
  return `${minuteValue}:${secondValue}`;
}

function sanitizePrefillNumber(value: string | null) {
  if (!value) {
    return "";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function sanitizePrefillText(value: string | null) {
  return value?.trim() ?? "";
}

function formatGrams(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const normalized = Number(value.toFixed(1));
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(1).replace(/\.0$/, "");
}

function resolveBeanRemainingWeight(bean: {
  remainingWeight?: number | null;
  totalWeight?: number | null;
}) {
  const candidate =
    typeof bean.remainingWeight === "number" && Number.isFinite(bean.remainingWeight)
      ? bean.remainingWeight
      : typeof bean.totalWeight === "number" && Number.isFinite(bean.totalWeight)
        ? bean.totalWeight
        : null;

  if (candidate === null || candidate < 0) {
    return null;
  }

  return candidate;
}

function formatBeanOptionLabel(bean: {
  name: string;
  remainingWeight?: number | null;
  totalWeight?: number | null;
}) {
  const remainingWeight = resolveBeanRemainingWeight(bean);

  if (remainingWeight === null) {
    return `${bean.name} (庫存未知)`;
  }

  return `${bean.name} (剩餘 ${formatGrams(remainingWeight)}g)`;
}

function splitSecondsParam(value: string | null) {
  if (!value) {
    return { minutes: "", seconds: "" };
  }

  const totalSeconds = Number(value);
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return { minutes: "", seconds: "" };
  }

  const safeSeconds = Math.round(totalSeconds);
  return {
    minutes: String(Math.floor(safeSeconds / 60)),
    seconds: String(safeSeconds % 60),
  };
}

function resolvePresetEquipmentId(
  preset: QuickPreset,
  equipmentOptions: Array<{ id: string; name: string; type: string }>,
  currentEquipmentId: string
) {
  const normalizedKeywords = (preset.equipmentKeywords ?? []).map((keyword) =>
    keyword.toLowerCase()
  );

  const keywordMatch = equipmentOptions.find((equipment) => {
    const haystack = `${equipment.name} ${equipment.type}`.toLowerCase();
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });

  if (keywordMatch) {
    return keywordMatch.id;
  }

  if (preset.equipmentType) {
    const typeMatch = equipmentOptions.find(
      (equipment) => equipment.type === preset.equipmentType
    );

    if (typeMatch) {
      return typeMatch.id;
    }
  }

  return currentEquipmentId || equipmentOptions[0]?.id || "";
}

function GroupedSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="px-1">
        <p className="text-[11px] font-semibold text-text-secondary">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-[1.1rem] border border-border-subtle bg-dark-panel shadow-sm transition-colors duration-200">
        {children}
      </div>
    </section>
  );
}

function FieldRow({
  label,
  children,
  isLast = false,
}: {
  label: string;
  children: ReactNode;
  isLast?: boolean;
}) {
  return (
    <label
      className={`grid gap-2 px-4 py-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-center ${
        !isLast ? "border-b border-border-subtle" : ""
      }`}
    >
      <span className="text-sm font-medium text-text-primary transition-colors duration-200">{label}</span>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

function FieldGrid({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="grid grid-cols-2 gap-3 p-4">{children}</div>;
}

function StatField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 rounded-xl border border-border-subtle bg-dark-control px-3 py-3 transition-colors duration-200">
      <span className="text-[11px] font-medium text-text-secondary">{label}</span>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

export default function BrewFormClient() {
  const router = useRouter();
  const { addBrewLog, getActiveBeans, getActiveEquipments } = useBrewData();
  const searchParams = useSearchParams();
  const beanIdParam = searchParams.get("beanId")?.trim() ?? "";
  const equipmentIdParam = searchParams.get("equipmentId")?.trim() ?? "";
  const grinderIdParam = searchParams.get("grinderId")?.trim() ?? "";
  const filterIdParam = searchParams.get("filterId")?.trim() ?? "";
  const prefilledDose = sanitizePrefillNumber(searchParams.get("dose"));
  const prefilledWater = sanitizePrefillNumber(searchParams.get("water"));
  const prefilledTemperature = sanitizePrefillNumber(searchParams.get("temperature"));
  const prefilledGrindSize = sanitizePrefillText(searchParams.get("grindSize"));
  const prefilledBrewClock = splitSecondsParam(searchParams.get("brewTime"));
  const prefilledBloomClock = splitSecondsParam(searchParams.get("bloomTime"));
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "success">(
    "idle"
  );
  const [sensoryScores, setSensoryScores] = useState<Record<SensoryName, number>>({
    acidity: 3,
    sweetness: 3,
    body: 3,
    bitterness: 3,
  });
  const [doseInput, setDoseInput] = useState(prefilledDose);
  const [waterInput, setWaterInput] = useState(prefilledWater);
  const [temperatureInput, setTemperatureInput] = useState(prefilledTemperature);
  const [grindSizeInput, setGrindSizeInput] = useState(prefilledGrindSize);
  const [brewMinutes, setBrewMinutes] = useState(prefilledBrewClock.minutes);
  const [brewSeconds, setBrewSeconds] = useState(prefilledBrewClock.seconds);
  const [bloomMinutes, setBloomMinutes] = useState(prefilledBloomClock.minutes);
  const [bloomSeconds, setBloomSeconds] = useState(prefilledBloomClock.seconds);
  const [selectedBeanId, setSelectedBeanId] = useState(beanIdParam);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(equipmentIdParam);
  const [selectedGrinderId, setSelectedGrinderId] = useState(grinderIdParam);
  const [selectedFilterId, setSelectedFilterId] = useState(filterIdParam);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const beans = useLiveQuery(
    () =>
      getActiveBeans().then((items) =>
        items.map((bean) => ({
          id: bean.id,
          name: bean.name,
          roastLevel: bean.roastLevel,
          remainingWeight: bean.remainingWeight,
          totalWeight: bean.totalWeight,
          status: bean.status,
        }))
      ),
    []
  );
  const equipmentOptions = useLiveQuery(
    () => getActiveEquipments(),
    []
  );
  const dripperOptions = useMemo(
    () => (equipmentOptions ?? []).filter((equipment) => equipment.type === "濾杯"),
    [equipmentOptions]
  );
  const grinderOptions = useMemo(
    () => (equipmentOptions ?? []).filter((equipment) => equipment.type === "磨豆機"),
    [equipmentOptions]
  );
  const filterOptions = useMemo(
    () => (equipmentOptions ?? []).filter((equipment) => equipment.type === "濾紙"),
    [equipmentOptions]
  );
  const defaultBeanId =
    beanIdParam && beans?.some((bean) => bean.id === beanIdParam)
      ? beanIdParam
      : "";
  const selectedBeanValue =
    selectedBeanId && beans?.some((bean) => bean.id === selectedBeanId)
      ? selectedBeanId
      : defaultBeanId;
  const availableBeanCount = (beans ?? []).filter((bean) => {
    const remainingWeight = resolveBeanRemainingWeight(bean);
    return bean.status !== "ARCHIVED" && remainingWeight !== 0;
  }).length;
  const defaultEquipment =
    dripperOptions.length > 0
      ? dripperOptions[0].id
      : equipmentOptions && equipmentOptions.length > 0
        ? equipmentOptions[0].id
        : "";
  const selectedEquipmentValue =
    selectedEquipmentId &&
    equipmentOptions?.some((equipment) => equipment.id === selectedEquipmentId)
      ? selectedEquipmentId
      : defaultEquipment;
  const selectedGrinderValue =
    selectedGrinderId &&
    grinderOptions.some((equipment) => equipment.id === selectedGrinderId)
      ? selectedGrinderId
      : "";
  const selectedFilterValue =
    selectedFilterId &&
    filterOptions.some((equipment) => equipment.id === selectedFilterId)
      ? selectedFilterId
      : "";
  const isSaving = submitState === "saving";
  const ratioPreview = useMemo(() => {
    const dose = parseDecimalInput(doseInput);
    const water = parseDecimalInput(waterInput);

    if (!dose || !water || dose <= 0 || water <= 0) {
      return "1 : --";
    }

    return `1 : ${(water / dose).toFixed(1)}`;
  }, [doseInput, waterInput]);
  const brewTimeSecondsValue =
    brewMinutes === "" || brewSeconds === ""
      ? ""
      : String(Number(brewMinutes) * 60 + Number(brewSeconds));
  const bloomTimeSecondsValue =
    bloomMinutes === "" && bloomSeconds === ""
      ? ""
      : String((Number(bloomMinutes || "0") || 0) * 60 + (Number(bloomSeconds || "0") || 0));
  const brewClock = formatClock(brewMinutes, brewSeconds);
  const bloomClock =
    bloomMinutes || bloomSeconds ? formatClock(bloomMinutes, bloomSeconds) : "00:00";

  function applyQuickPreset(preset: QuickPreset) {
    const nextEquipmentId = resolvePresetEquipmentId(
      preset,
      equipmentOptions ?? [],
      selectedEquipmentId
    );

    setDoseInput(preset.values.dose);
    setWaterInput(preset.values.water);
    setTemperatureInput(preset.values.temperature);
    setGrindSizeInput(preset.values.grindSize);
    setBrewMinutes(preset.values.brewMinutes);
    setBrewSeconds(preset.values.brewSeconds);
    setBloomMinutes(preset.values.bloomMinutes);
    setBloomSeconds(preset.values.bloomSeconds);
    if (nextEquipmentId) {
      setSelectedEquipmentId(nextEquipmentId);
    }
    if (preset.values.sensory) {
      setSensoryScores((current) => ({ ...current, ...preset.values.sensory }));
    }
    setActivePresetId(preset.id);
    void triggerLightImpact();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const beanId = String(formData.get("beanId") ?? "").trim();
    const dose = Number(formData.get("dose"));
    const water = Number(formData.get("water"));
    const temperature = Number(formData.get("temperature"));
    const equipmentId = String(formData.get("equipmentId") ?? "").trim();
    const grinderIdRaw = String(formData.get("grinderId") ?? "").trim();
    const filterIdRaw = String(formData.get("filterId") ?? "").trim();
    const grinderId = grinderIdRaw.length > 0 ? grinderIdRaw : null;
    const filterId = filterIdRaw.length > 0 ? filterIdRaw : null;
    const brewTime = Number(formData.get("brewTime"));
    const grindSizeRaw = String(formData.get("grindSize") ?? "").trim();
    const grindSize = grindSizeRaw.length > 0 ? grindSizeRaw : null;
    const bloomTimeRaw = String(formData.get("bloomTime") ?? "").trim();
    const bloomTime = bloomTimeRaw.length > 0 ? Number(bloomTimeRaw) : null;
    const acidity = Number(formData.get("acidity"));
    const sweetness = Number(formData.get("sweetness"));
    const body = Number(formData.get("body"));
    const bitterness = Number(formData.get("bitterness"));
    const feedbackRaw = String(formData.get("feedback") ?? "").trim();
    const feedback = feedbackRaw.length > 0 ? feedbackRaw : null;

    if (
      !beanId ||
      !Number.isFinite(dose) ||
      !Number.isFinite(water) ||
      !Number.isFinite(temperature) ||
      !equipmentId ||
      !Number.isInteger(brewTime) ||
      (bloomTime !== null && !Number.isInteger(bloomTime)) ||
      !Number.isInteger(acidity) ||
      !Number.isInteger(sweetness) ||
      !Number.isInteger(body) ||
      !Number.isInteger(bitterness)
    ) {
      setError("請完整填寫表單，並確認數值欄位格式正確。");
      setSubmitState("idle");
      void triggerWarningNotification();
      return;
    }

    await triggerLightImpact();
    setSubmitState("saving");
    setError(null);
    setSuccessMessage(null);

    try {
      await addBrewLog({
        beanId,
        equipmentId,
        grinderId,
        filterId,
        dose,
        water,
        temperature,
        brewTime,
        grindSize,
        bloomTime,
        acidity,
        sweetness,
        body,
        bitterness,
        feedback,
      });
      setSuccessMessage(`已記錄沖煮，並從庫存扣除 ${formatGrams(dose)}g。`);
      await triggerSuccessNotification();
      setSubmitState("success");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      router.push("/records");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "建立沖煮紀錄時發生錯誤。";
      setError(message);
      setSubmitState("idle");
      setSuccessMessage(null);
      await triggerWarningNotification();
    }
  }

  if (beans === undefined || equipmentOptions === undefined) {
    return (
      <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <p className="text-sm leading-6 text-text-secondary">
          正在從本地資料庫載入咖啡豆與器具資料。
        </p>
      </section>
    );
  }

  if (beans.length === 0) {
    return (
      <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <p className="text-sm leading-6 text-text-secondary">
          目前沒有可用的咖啡豆資料，請先前往新增咖啡豆。
        </p>
      </section>
    );
  }

  if (availableBeanCount === 0) {
    return (
      <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <p className="text-sm leading-6 text-text-secondary">
          目前沒有可沖煮的咖啡豆。請先補充庫存，或啟用仍有剩餘重量的咖啡豆。
        </p>
      </section>
    );
  }

  if (equipmentOptions.length === 0) {
    return (
      <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <p className="text-sm leading-6 text-text-secondary">
          目前沒有可用的器具資料，請先前往新增器具。
        </p>
      </section>
    );
  }

  if (dripperOptions.length === 0) {
    return (
      <section className="rounded-xl border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
        <p className="text-sm leading-6 text-text-secondary">
          目前還沒有濾杯資料，請先新增至少一個濾杯，才能開始建立沖煮紀錄。
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="overflow-hidden rounded-[1.1rem] border border-border-subtle bg-dark-panel px-4 py-3 shadow-sm transition-colors duration-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-text-secondary">
              沖煮設定
            </p>
          </div>
          <div className="text-right tabular-nums">
            <p className="text-lg font-bold tracking-tight text-text-primary transition-colors duration-200">{brewClock}</p>
            <p className="mt-1 text-[11px] font-semibold text-text-secondary">
              粉水比 {ratioPreview}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="px-1">
          <p className="text-[11px] font-semibold text-text-secondary">快速預設配方</p>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            {quickPresets.map((preset) => {
              const active = preset.id === activePresetId;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyQuickPreset(preset)}
                  className={`inline-flex select-none flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/30 active:scale-95 ${
                    active
                      ? "border-cta-primary/30 bg-dark-control text-text-primary"
                      : "border-border-subtle bg-dark-panel text-text-primary hover:bg-dark-control"
                  }`}
                >
                  <span className="text-sm font-semibold">{preset.title}</span>
                  <span className="mt-1 text-xs text-text-secondary">{preset.summary}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <GroupedSection title="咖啡資訊">
        <FieldRow label="咖啡豆" isLast>
          <select
            name="beanId"
            required
            value={selectedBeanValue}
            onChange={(event) => {
              setSelectedBeanId(event.target.value);
              setActivePresetId(null);
            }}
            enterKeyHint="next"
            className="w-full rounded-xl border border-border-subtle bg-dark-control px-3 py-2.5 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/30"
          >
            <option value="" disabled>
              請選擇咖啡豆
            </option>
            {beans.map((bean) => {
              const remainingWeight = resolveBeanRemainingWeight(bean);
              const isDisabled =
                bean.status === "ARCHIVED" || remainingWeight === 0;

              return (
                <option key={bean.id} value={bean.id} disabled={isDisabled}>
                  {formatBeanOptionLabel(bean)}
                </option>
              );
            })}
          </select>
        </FieldRow>
      </GroupedSection>

      <GroupedSection title="器具配置">
        <FieldRow label="濾杯">
          <select
            name="equipmentId"
            required
            value={selectedEquipmentValue}
            onChange={(event) => {
              setSelectedEquipmentId(event.target.value);
              setActivePresetId(null);
            }}
            enterKeyHint="next"
            className="w-full rounded-xl border border-border-subtle bg-dark-control px-3 py-2.5 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/30"
          >
            {dripperOptions.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name} ({equipment.type})
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="磨豆機">
          <select
            name="grinderId"
            value={selectedGrinderValue}
            onChange={(event) => {
              setSelectedGrinderId(event.target.value);
              setActivePresetId(null);
            }}
            enterKeyHint="next"
            className="w-full rounded-xl border border-border-subtle bg-dark-control px-3 py-2.5 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/30"
          >
            <option value="">未指定磨豆機</option>
            {grinderOptions.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="濾紙" isLast>
          <select
            name="filterId"
            value={selectedFilterValue}
            onChange={(event) => {
              setSelectedFilterId(event.target.value);
              setActivePresetId(null);
            }}
            enterKeyHint="next"
            className="w-full rounded-xl border border-border-subtle bg-dark-control px-3 py-2.5 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/30"
          >
            <option value="">未指定濾紙</option>
            {filterOptions.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
              </option>
            ))}
          </select>
        </FieldRow>
      </GroupedSection>

      <GroupedSection title="配方參數">
        <FieldGrid>
          <StatField label="粉量">
            <input
              type="number"
              name="dose"
              step="0.1"
              min="0"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              enterKeyHint="next"
              required
              value={doseInput}
              onChange={(event) => {
                setDoseInput(event.target.value);
                setActivePresetId(null);
              }}
              className="w-full bg-transparent text-sm font-mono font-semibold tabular-nums text-text-primary focus-visible:outline-none"
              placeholder="20 g"
            />
          </StatField>

          <StatField label="水量">
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="water"
                step="0.1"
                min="0"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                enterKeyHint="next"
                required
                value={waterInput}
                onChange={(event) => {
                  setWaterInput(event.target.value);
                  setActivePresetId(null);
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-mono font-semibold tabular-nums text-text-primary focus-visible:outline-none"
                placeholder="300"
              />
              <span className="text-sm font-semibold text-text-secondary">g</span>
            </div>
          </StatField>

          <StatField label="粉水比">
            <div className="text-sm font-mono font-semibold tabular-nums text-text-primary">
              {ratioPreview}
            </div>
          </StatField>

          <StatField label="水溫">
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="temperature"
                step="0.1"
                min="0"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                enterKeyHint="next"
                required
                value={temperatureInput}
                onChange={(event) => {
                  setTemperatureInput(event.target.value);
                  setActivePresetId(null);
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-mono font-semibold tabular-nums text-text-primary focus-visible:outline-none"
                placeholder="94"
              />
              <span className="text-sm font-semibold text-text-secondary">°C</span>
            </div>
          </StatField>

          <div className="col-span-2">
            <StatField label="研磨度">
              <input
                name="grindSize"
                enterKeyHint="next"
                value={grindSizeInput}
                onChange={(event) => {
                  setGrindSizeInput(event.target.value);
                  setActivePresetId(null);
                }}
                className="w-full bg-transparent text-sm text-text-primary focus-visible:outline-none"
                placeholder="例如 24 clicks"
              />
            </StatField>
          </div>
        </FieldGrid>
      </GroupedSection>

      <GroupedSection title="時間">
        <FieldGrid>
          <StatField label="沖煮時間">
            <div className="space-y-2">
              <input type="hidden" name="brewTime" value={brewTimeSecondsValue} />
              <div className="flex items-center justify-end gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="next"
                  required
                  value={brewMinutes}
                  onChange={(event) => {
                    setBrewMinutes(sanitizeTimePart(event));
                    setActivePresetId(null);
                  }}
                  className="w-10 bg-transparent text-center text-base font-semibold tabular-nums text-text-primary placeholder:text-dark-muted focus-visible:outline-none"
                  placeholder="00"
                  aria-label="沖煮分鐘"
                />
                <span className="text-sm font-semibold text-text-secondary">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="next"
                  required
                  value={brewSeconds}
                  onChange={(event) => {
                    setBrewSeconds(sanitizeTimePart(event, { max: 59 }));
                    setActivePresetId(null);
                  }}
                  className="w-10 bg-transparent text-center text-base font-semibold tabular-nums text-text-primary placeholder:text-dark-muted focus-visible:outline-none"
                  placeholder="00"
                  aria-label="沖煮秒數"
                />
              </div>
              <p className="text-right text-xs text-text-secondary">目前 {brewClock}</p>
            </div>
          </StatField>

          <StatField label="悶蒸時間">
            <div className="space-y-2">
              <input type="hidden" name="bloomTime" value={bloomTimeSecondsValue} />
              <div className="flex items-center justify-end gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="next"
                  value={bloomMinutes}
                  onChange={(event) => {
                    setBloomMinutes(sanitizeTimePart(event));
                    setActivePresetId(null);
                  }}
                  className="w-10 bg-transparent text-center text-base font-semibold tabular-nums text-text-primary placeholder:text-dark-muted focus-visible:outline-none"
                  placeholder="00"
                  aria-label="悶蒸分鐘"
                />
                <span className="text-sm font-semibold text-text-secondary">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="next"
                  value={bloomSeconds}
                  onChange={(event) => {
                    setBloomSeconds(sanitizeTimePart(event, { max: 59 }));
                    setActivePresetId(null);
                  }}
                  className="w-10 bg-transparent text-center text-base font-semibold tabular-nums text-text-primary placeholder:text-dark-muted focus-visible:outline-none"
                  placeholder="00"
                  aria-label="悶蒸秒數"
                />
              </div>
              <p className="text-right text-xs text-text-secondary">目前 {bloomClock}</p>
            </div>
          </StatField>
        </FieldGrid>
      </GroupedSection>

      <section className="space-y-2">
        <div className="px-1">
          <p className="text-[11px] font-semibold text-text-secondary">
            感官評分
          </p>
        </div>
        <div className="rounded-[1.1rem] border border-border-subtle bg-dark-panel px-4 py-4 shadow-sm transition-colors duration-200">
          <div className="grid gap-3">
            {sensoryMeta.map((item) => (
              <TactileSlider
                key={item.name}
                name={item.name}
                label={item.label}
                descriptor={sensoryDescriptors[item.name][sensoryScores[item.name] - 1]}
                value={sensoryScores[item.name]}
                onChange={(value) => {
                  setSensoryScores((current) => ({ ...current, [item.name]: value }));
                  setActivePresetId(null);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <GroupedSection title="筆記">
        <div className="px-4 py-4">
          <textarea
            name="feedback"
            rows={3}
            enterKeyHint="done"
            className="w-full rounded-xl border border-border-subtle bg-dark-control px-3 py-3 text-sm text-text-primary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-primary/30"
            placeholder="記下悶蒸、香氣與萃取流速的觀察。"
          />
        </div>
      </GroupedSection>
      {error ? (
        <div className="rounded-xl border border-status-error/20 bg-status-error/10 px-4 py-4 shadow-sm transition-colors duration-200">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-status-error/12 text-status-error">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-status-error">表單尚未成功送出</p>
              <p className="mt-1 text-sm leading-6 text-status-error">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-status-success/20 bg-status-success/95 px-4 py-3 text-primary-foreground shadow-lg shadow-black/20 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/12">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">沖煮紀錄已儲存</p>
              <p className="mt-1 text-sm leading-6 text-primary-foreground/90">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSaving}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-[1.25rem] border px-5 py-3.5 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed ${
          submitState === "success"
            ? "border-status-success bg-status-success/90 text-primary-foreground shadow-sm"
            : "border-cta-primary bg-cta-primary text-cta-foreground shadow-sm hover:-translate-y-0.5 hover:brightness-105"
        } disabled:opacity-70`}
      >
        {submitState === "success" ? (
          <>
            <CheckCircle2 className="h-4.5 w-4.5" />
            紀錄已儲存
          </>
        ) : isSaving ? (
          <>正在同步紀錄...</>
        ) : (
          "建立沖煮紀錄"
        )}
      </button>
    </form>
  );
}
