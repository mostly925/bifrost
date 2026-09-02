// Governance-related constants
import type { TFunction } from "i18next";
import i18n from "@/lib/i18n";

/**
 * Reset periods offered on budgets and rate limits. Labels are i18n keys into the
 * shared namespace so every page renders them in the active language; use
 * localizedResetDurationOptions / localizedResetDurationLabel at render time.
 */
export const resetDurationOptions = [
	{ labelKey: "resetPeriods.everyMinute", value: "1m" },
	{ labelKey: "resetPeriods.every5Minutes", value: "5m" },
	{ labelKey: "resetPeriods.every15Minutes", value: "15m" },
	{ labelKey: "resetPeriods.every30Minutes", value: "30m" },
	{ labelKey: "resetPeriods.hourly", value: "1h" },
	{ labelKey: "resetPeriods.every6Hours", value: "6h" },
	{ labelKey: "resetPeriods.daily", value: "1d" },
	{ labelKey: "resetPeriods.weekly", value: "1w" },
	{ labelKey: "resetPeriods.monthly", value: "1M" },
] as const;

// Reset periods offered on budgets. Quarterly is budget-only: resetDurationOptions
// above is shared with the rate-limit selects, and the backend has no notion of a
// quarterly token or request limit, so adding "1Q" there would offer a window it
// cannot enforce.
export const budgetResetDurationOptions = [...resetDurationOptions, { labelKey: "resetPeriods.quarterly", value: "1Q" }] as const;

export interface LocalizedDurationOption {
	label: string;
	value: string;
}

/** Options with labels resolved through the given t (bind `useTranslation("shared")`). */
export function localizedResetDurationOptions(t: TFunction<"shared">): LocalizedDurationOption[] {
	return resetDurationOptions.map(({ labelKey, value }) => ({ label: t(labelKey), value }));
}

/** Same as localizedResetDurationOptions plus the budget-only Quarterly period. */
export function localizedBudgetResetDurationOptions(t: TFunction<"shared">): LocalizedDurationOption[] {
	return budgetResetDurationOptions.map(({ labelKey, value }) => ({ label: t(labelKey), value }));
}

/** Localized display label for a duration value; unknown values pass through unchanged. */
export function localizedResetDurationLabel(t: TFunction<"shared">, duration: string): string {
	const option = budgetResetDurationOptions.find((option) => option.value === duration);
	return option ? t(option.labelKey) : duration;
}

/** Standalone variant for non-hook contexts (CSV export, module helpers); renders in the active language. */
export function localizedResetDurationLabelStandalone(duration: string): string {
	const option = budgetResetDurationOptions.find((option) => option.value === duration);
	return option ? i18n.t(option.labelKey, { ns: "shared" }) : duration;
}

// Durations that support calendar-aligned resets (snap to day/week/month/quarter/year boundaries).
// Must stay in sync with IsCalendarAlignableDuration in framework/configstore/tables/utils.go.
// Case matters: "M" is a month while "m" is a minute, so "1q" is not a quarter.
export const supportsCalendarAlignment = (duration: string): boolean => duration.length > 0 && /[dwMQY]$/.test(duration);

const MONTH_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Locale tag for month names, derived from the active UI language.
function monthLocale(): string {
	return i18n.language === "zh" ? "zh-CN" : "en-US";
}

function monthShort(monthIndex: number): string {
	return new Intl.DateTimeFormat(monthLocale(), { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, monthIndex, 1)));
}

// Fall back to January for a missing, fractional, or out-of-range month, matching
// BudgetResetConfig.QuarterStart on the Go side. Number.isInteger also rejects a
// fractional month, which would otherwise index the month tables between slots.
function normalizeQuarterStart(startMonth?: number): number {
	return startMonth !== undefined && Number.isInteger(startMonth) && startMonth >= 1 && startMonth <= 12 ? startMonth : 1;
}

// Month indices (0-11) for the four fiscal quarters — the single source of the
// modulo-3 boundary math the preview string, chip ranges, and reset date all build on.
function quarterMonthIndices(startMonth?: number): { first: number; last: number }[] {
	const start = normalizeQuarterStart(startMonth);
	return [0, 1, 2, 3].map((quarter) => {
		const first = (start - 1 + quarter * 3) % 12;
		return { first, last: (first + 2) % 12 };
	});
}

/**
 * Renders the four fiscal quarters implied by a start month, e.g. April gives
 * "Q1 Apr-Jun · Q2 Jul-Sep · Q3 Oct-Dec · Q4 Jan-Mar".
 *
 * This preview is the setting's main affordance, not decoration. Quarter
 * boundaries repeat every three months, so the start month only changes reset
 * dates modulo 3: January, April, July and October all reset on the same days.
 * An operator picking "April" for a UK or Indian fiscal year would otherwise see
 * no change anywhere in the UI and reasonably conclude the setting is broken.
 * The preview shows what actually differs, which is the Q1-Q4 labelling.
 *
 * Out-of-range or missing months fall back to January, matching
 * BudgetResetConfig.QuarterStart on the Go side.
 */
export function formatQuarterPreview(startMonth?: number): string {
	return quarterMonthIndices(startMonth)
		.map((month, quarter) => `Q${quarter + 1} ${monthShort(month.first)}-${monthShort(month.last)}`)
		.join(" · ");
}

/**
 * Compact read-only note naming a quarterly budget's fiscal-year start, e.g.
 * " · FY starts Apr". Returns "" for non-quarterly budgets and for a January /
 * unset start (the default), so it only ever appears when it changes behaviour.
 * Callers append it after the reset-period label (which already reads "Quarterly").
 */
export function fiscalQuarterNote(resetDuration?: string, resetConfig?: { quarter_start_month?: number } | null): string {
	if (!resetDuration || !resetDuration.endsWith("Q")) return "";
	const start = resetConfig?.quarter_start_month;
	// Number.isInteger also rejects undefined/NaN; a fractional month like 2.5 would
	// otherwise pass the range check and index the month formatter between slots.
	if (start === undefined || !Number.isInteger(start) || start === 1 || start < 1 || start > 12) return "";
	return ` · ${i18n.t("fiscalYear.starts", { month: monthShort(start - 1), ns: "shared" })}`;
}

/**
 * The four fiscal quarters as `{label, range}` for the quarter-map chips, e.g.
 * April → `[{label:"Q1", range:"Apr–Jun"}, …]`. Uses an en-dash to match the design.
 */
export function quarterRanges(startMonth?: number): { label: string; range: string }[] {
	return quarterMonthIndices(startMonth).map((month, quarter) => ({
		label: `Q${quarter + 1}`,
		range: `${monthShort(month.first)}–${monthShort(month.last)}`,
	}));
}

/** Index (0-3) of the fiscal quarter containing `now`, for the current-quarter highlight. */
export function currentQuarterIndex(startMonth?: number, now: Date = new Date()): number {
	const start = normalizeQuarterStart(startMonth);
	return Math.floor(((now.getMonth() - (start - 1) + 12) % 12) / 3);
}

/**
 * First day of the next fiscal quarter strictly after `now`, for a fiscal year
 * starting `startMonth` (1-12). Display-only — the authoritative reset schedule
 * lives in BudgetResetConfig.QuarterStart on the Go side.
 */
export function nextQuarterReset(startMonth?: number, now: Date = new Date()): Date {
	const start = normalizeQuarterStart(startMonth);
	const candidates: Date[] = [];
	for (let year = now.getFullYear() - 1; year <= now.getFullYear() + 1; year++) {
		for (let quarter = 0; quarter < 4; quarter++) {
			// A month index past 11 rolls into the next year, which is exactly the
			// wrap we want for fiscal years that start late in the calendar year.
			candidates.push(new Date(year, start - 1 + quarter * 3, 1));
		}
	}
	return candidates.filter((date) => date > now).sort((a, b) => a.getTime() - b.getTime())[0];
}

// Month choices for the fiscal quarter start select, localized via the active language.
export const quarterStartMonthOptions = (): LocalizedDurationOption[] =>
	MONTH_INDEXES.map((monthIndex) => ({
		label: new Intl.DateTimeFormat(monthLocale(), { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, monthIndex, 1))),
		value: String(monthIndex + 1),
	}));