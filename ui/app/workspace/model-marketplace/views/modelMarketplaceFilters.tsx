import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RenderProviderIcon } from "@/lib/constants/icons";
import type { ModelDetails } from "@/lib/store/apis/providersApi";
import { useTranslation } from "react-i18next";
import { ModalityIcon } from "./modalityIcon";
import { isKnownProvider } from "./providerUtils";

export interface MarketplaceFilterState {
	inputModalities: string[];
	outputModalities: string[];
	contextBuckets: string[];
	providers: string[];
}

export const EMPTY_FILTERS: MarketplaceFilterState = {
	inputModalities: [],
	outputModalities: [],
	contextBuckets: [],
	providers: [],
};

/** Context-length buckets mirror the per-model context_length values (1K = 1000 tokens). */
const CONTEXT_BUCKETS = [
	{ id: "le64k", min: 0, max: 64_000 },
	{ id: "64k-128k", min: 64_000, max: 128_000 },
	{ id: "128k-256k", min: 128_000, max: 256_000 },
	{ id: "256k-1m", min: 256_000, max: 1_000_000 },
	{ id: "ge1m", min: 1_000_000, max: Number.POSITIVE_INFINITY },
] as const;

type ContextBucketId = (typeof CONTEXT_BUCKETS)[number]["id"];

function coversBucket(bucket: (typeof CONTEXT_BUCKETS)[number], contextLength: number): boolean {
	const aboveMin = contextLength > bucket.min;
	const atOrBelowMax = contextLength <= bucket.max;
	return aboveMin && atOrBelowMax;
}

export function contextBucketId(contextLength?: number): string | undefined {
	if (contextLength === undefined || contextLength === null) return undefined;
	return CONTEXT_BUCKETS.find((bucket) => coversBucket(bucket, contextLength))?.id;
}

const KNOWN_MODALITIES = ["text", "image", "audio", "video", "file", "other"] as const;
type ModalityLabelKey = (typeof KNOWN_MODALITIES)[number];

function modalityLabelKey(modality: string): ModalityLabelKey {
	return (KNOWN_MODALITIES as readonly string[]).includes(modality) ? (modality as ModalityLabelKey) : "other";
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="border-b pb-4 last:border-b-0" data-testid="model-marketplace-filter-section">
			<p className="mb-2 text-sm font-medium">{title}</p>
			{children}
		</div>
	);
}

function toggleValue(values: string[], value: string): string[] {
	return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

interface ModelMarketplaceFiltersProps {
	filters: MarketplaceFilterState;
	onChange: (filters: MarketplaceFilterState) => void;
	availableInputModalities: string[];
	availableOutputModalities: string[];
	availableProviders: ModelDetails["provider"][];
}

export default function ModelMarketplaceFilters({
	filters,
	onChange,
	availableInputModalities,
	availableOutputModalities,
	availableProviders,
}: ModelMarketplaceFiltersProps) {
	const { t } = useTranslation("modelMarketplace");

	const isDirty =
		filters.inputModalities.length > 0 ||
		filters.outputModalities.length > 0 ||
		filters.contextBuckets.length > 0 ||
		filters.providers.length > 0;

	const renderModalityOption = (modality: string, kind: "inputModalities" | "outputModalities") => {
		const labelKey = modalityLabelKey(modality);
		return (
			<Label key={modality} className="flex cursor-pointer items-center gap-2 py-1 text-sm font-normal">
				<Checkbox
					checked={filters[kind].includes(modality)}
					onCheckedChange={() => onChange({ ...filters, [kind]: toggleValue(filters[kind], modality) })}
					data-testid={`model-marketplace-filter-${kind}-${modality}`}
				/>
				<ModalityIcon modality={modality} className="text-muted-foreground h-4 w-4" />
				{t(`filters.modality.${labelKey}`)}
				{labelKey === "other" ? ` (${modality})` : null}
			</Label>
		);
	};

	return (
		<aside className="flex w-56 shrink-0 flex-col gap-4 overflow-auto" data-testid="model-marketplace-filters">
			{isDirty ? (
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-2"
					onClick={() => onChange(EMPTY_FILTERS)}
					data-testid="model-marketplace-filters-clear"
				>
					{t("filters.clear")}
				</button>
			) : null}

			<FilterSection title={t("filters.inputModality")}>
				{availableInputModalities.length === 0 ? (
					<p className="text-muted-foreground text-xs">{t("filters.none")}</p>
				) : (
					availableInputModalities.map((modality) => renderModalityOption(modality, "inputModalities"))
				)}
			</FilterSection>

			<FilterSection title={t("filters.outputModality")}>
				{availableOutputModalities.length === 0 ? (
					<p className="text-muted-foreground text-xs">{t("filters.none")}</p>
				) : (
					availableOutputModalities.map((modality) => renderModalityOption(modality, "outputModalities"))
				)}
			</FilterSection>

			<FilterSection title={t("filters.contextLength")}>
				<div className="flex flex-wrap gap-1.5">
					{CONTEXT_BUCKETS.map((bucket) => {
						const active = filters.contextBuckets.includes(bucket.id);
						return (
							<button
								key={bucket.id}
								type="button"
								className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
									active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent bg-transparent"
								}`}
								onClick={() => onChange({ ...filters, contextBuckets: toggleValue(filters.contextBuckets, bucket.id) })}
								data-testid={`model-marketplace-filter-context-${bucket.id}`}
							>
								{t(`filters.buckets.${bucket.id}`)}
							</button>
						);
					})}
				</div>
			</FilterSection>

			<FilterSection title={t("filters.provider")}>
				{availableProviders.map((provider) => (
					<Label key={provider} className="flex cursor-pointer items-center gap-2 py-1 text-sm font-normal">
						<Checkbox
							checked={filters.providers.includes(provider)}
							onCheckedChange={() => onChange({ ...filters, providers: toggleValue(filters.providers, provider) })}
							data-testid={`model-marketplace-filter-provider-${provider}`}
						/>
						{isKnownProvider(provider) ? <RenderProviderIcon provider={provider} className="h-4 w-4" /> : null}
						{provider}
					</Label>
				))}
			</FilterSection>
		</aside>
	);
}