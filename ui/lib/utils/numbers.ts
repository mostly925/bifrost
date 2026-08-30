import i18n from "@/lib/i18n";

export const COMPACT_NUMBER_FORMAT = {
	notation: "compact",
	compactDisplay: "short",
	maximumFractionDigits: 2,
} as const;

// Intl 直接接受 i18n 的基础语言码（"en" / "zh"）
function getCurrentLocale(): string {
	return i18n.language || "en";
}

export function formatCompactNumber(value: number, maximumFractionDigits = 2): string {
	if (!Number.isFinite(value)) return "0";
	return new Intl.NumberFormat(getCurrentLocale(), {
		...COMPACT_NUMBER_FORMAT,
		maximumFractionDigits,
	}).format(value);
}

export function formatCurrencyNumber(value: number, maximumFractionDigits = 2): string {
	if (!Number.isFinite(value)) return "$0";
	if (value !== 0 && Math.abs(value) < 0.01) {
		return `$${value.toFixed(4)}`;
	}
	return new Intl.NumberFormat(getCurrentLocale(), {
		...COMPACT_NUMBER_FORMAT,
		style: "currency",
		currency: "USD",
		// narrowSymbol 保证各语言下都显示 "$" 而非 "US$"
		currencyDisplay: "narrowSymbol",
		maximumFractionDigits,
	}).format(value);
}

const TOKEN_PRICE_MULTIPLIER = 1_000_000;

function formatTokenPriceValue(cost: number): string {
	return `$${(cost * TOKEN_PRICE_MULTIPLIER).toLocaleString(getCurrentLocale(), {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

export function formatTokenPriceCompact(cost?: number): string {
	if (cost === undefined || cost === null) return "—";
	return formatTokenPriceValue(cost);
}

export function formatTokenPriceFull(cost?: number): string {
	if (cost === undefined || cost === null) return "Not available";
	return `${formatTokenPriceValue(cost)} / 1M tokens`;
}

/** Per-1M like token pricing, but for fields priced per character. */
export function formatCharacterPriceFull(cost?: number): string {
	if (cost === undefined || cost === null) return "Not available";
	return `${formatTokenPriceValue(cost)} / 1M characters`;
}