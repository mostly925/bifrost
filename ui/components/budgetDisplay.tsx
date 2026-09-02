import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fiscalQuarterNote, localizedResetDurationLabel, supportsCalendarAlignment } from "@/lib/constants/governance";
import { Budget } from "@/lib/types/governance";
import { cn } from "@/lib/utils";
import { formatCurrency, getEffectiveBudgetLimit, hasActiveBudgetOverride } from "@/lib/utils/governance";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

interface BudgetDisplayProps {
	budgets: Budget[] | null | undefined;
	/** When true, alignable durations (day/week/month/quarter/year) get a "(calendar)" suffix. */
	calendarAligned?: boolean;
}

const formatResetDuration = (t: TFunction<"shared">, duration?: string | null, calendarAligned?: boolean, calendarSuffix = "") => {
	if (!duration) return "";
	const label = localizedResetDurationLabel(t, duration);
	return calendarAligned && supportsCalendarAlignment(duration) ? `${label}${calendarSuffix}` : label;
};

/**
 * Renders a team-style usage bar per budget line: max limit + reset period on top, a
 * color-coded progress bar (emerald < 80% < amber < exhausted = red), and a tooltip with
 * the exact current/max spend. Mirrors RateLimitDisplay for visual consistency across tables.
 */
export function BudgetDisplay({ budgets, calendarAligned }: BudgetDisplayProps) {
	const { t } = useTranslation("shared");

	if (!budgets || budgets.length === 0) {
		return <span className="text-muted-foreground text-sm">-</span>;
	}

	return (
		<div className="min-w-[160px] space-y-2.5">
			{budgets.map((b, idx) => {
				const effectiveMaxLimit = getEffectiveBudgetLimit(b);
				const hasOverride = hasActiveBudgetOverride(b);
				const pct = effectiveMaxLimit > 0 ? Math.min((b.current_usage / effectiveMaxLimit) * 100, 100) : 0;
				const isExhausted = effectiveMaxLimit > 0 && b.current_usage >= effectiveMaxLimit;
				const barClass = isExhausted ? "[&>div]:bg-red-500/70" : pct > 80 ? "[&>div]:bg-amber-500/70" : "[&>div]:bg-emerald-500/70";
				const resetLabel = formatResetDuration(t, b.reset_duration, calendarAligned, t("usageDisplay.calendarSuffix"));

				return (
					<Tooltip key={b.id ?? idx}>
						<TooltipTrigger asChild>
							<div className="space-y-1.5">
								<div className="flex items-center justify-between gap-4">
									<span className="font-medium">
										{formatCurrency(effectiveMaxLimit)}
										{hasOverride ? <span className="text-muted-foreground ml-1 text-[10px]">{t("usageDisplay.overrideLabel")}</span> : null}
									</span>
									<span className="text-muted-foreground text-xs">
										{resetLabel}
										{fiscalQuarterNote(b.reset_duration, b.reset_config)}
									</span>
								</div>
								<Progress value={pct} className={cn("bg-muted/70 dark:bg-muted/30 h-1.5", barClass)} />
							</div>
						</TooltipTrigger>
						<TooltipContent>
							<p className="font-medium">
								{formatCurrency(b.current_usage)} / {formatCurrency(effectiveMaxLimit)}
							</p>
							{hasOverride ? (
								<p className="text-primary-foreground/80 text-xs">
									{t("usageDisplay.basePlusOverride", {
										base: formatCurrency(b.max_limit),
										amount: formatCurrency(b.override_amount ?? 0),
									})}
								</p>
							) : null}
							{b.reset_duration ? (
								<p className="text-primary-foreground/80 text-xs">
									{t("usageDisplay.resets", { duration: resetLabel })}
									{fiscalQuarterNote(b.reset_duration, b.reset_config)}
								</p>
							) : null}
						</TooltipContent>
					</Tooltip>
				);
			})}
		</div>
	);
}