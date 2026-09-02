import { NoPermissionView } from "@/components/noPermissionView";
import { VirtualKeySelector } from "@/components/entitySelectors/virtualKeySelector";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ModelDetails } from "@/lib/store/apis/providersApi";
import { useGetModelDetailsQuery, useGetVirtualKeyQuery } from "@/lib/store";
import type { VirtualKey } from "@/lib/types/governance";
import ModelMarketplaceCard from "./modelMarketplaceCard";
import ModelMarketplaceFilters, { EMPTY_FILTERS, contextBucketId, type MarketplaceFilterState } from "./modelMarketplaceFilters";

/**
 * Mirrors the backend's governance semantics (core/schemas/account.go): the
 * allowlist is exact-match and case-insensitive with "*" as the only wildcard;
 * an empty allowlist denies everything; the blacklist removes afterwards.
 */
function vkAllowsModel(vk: VirtualKey | undefined, provider: string, model: string): boolean {
	const configs = vk?.provider_configs ?? [];
	const config = configs.find((pc) => pc.provider.toLowerCase() === provider.toLowerCase());
	if (!config) return false;
	const allowed = config.allowed_models ?? [];
	const isAllowed = allowed.includes("*") || allowed.some((m) => m.toLowerCase() === model.toLowerCase());
	const blacklisted = config.blacklisted_models ?? [];
	const isBlacklisted = blacklisted.includes("*") || blacklisted.some((m) => m.toLowerCase() === model.toLowerCase());
	return isAllowed && !isBlacklisted;
}

function parseArchitecture(model: ModelDetails) {
	const architecture = model.architecture as { input_modalities?: string[]; output_modalities?: string[] } | undefined;
	return {
		input: architecture?.input_modalities ?? [],
		output: architecture?.output_modalities ?? [],
	};
}

export default function ModelMarketplaceView() {
	const { t } = useTranslation("modelMarketplace");
	const hasAccess = useRbac(RbacResource.ModelProvider, RbacOperation.View);

	// Search and the virtual-key scope live in the URL so a filtered view can be shared.
	const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
	const [vkId, setVkId] = useQueryState("vk", parseAsString.withDefault(""));
	const [filters, setFilters] = useState<MarketplaceFilterState>(EMPTY_FILTERS);

	const { data: details, isLoading, isError } = useGetModelDetailsQuery({ limit: 5000 });
	const { data: vkData, isLoading: isLoadingVk } = useGetVirtualKeyQuery(vkId, { skip: !vkId });
	const selectedVk = vkData?.virtual_key;

	const catalog = details?.models ?? [];

	const scopedModels = useMemo(() => {
		if (!vkId) return catalog;
		return catalog.filter((model) => vkAllowsModel(selectedVk, model.provider, model.name));
	}, [catalog, vkId, selectedVk]);

	const availableInputModalities = useMemo(
		() => [...new Set(catalog.flatMap((model) => parseArchitecture(model).input))].sort(),
		[catalog],
	);
	const availableOutputModalities = useMemo(
		() => [...new Set(catalog.flatMap((model) => parseArchitecture(model).output))].sort(),
		[catalog],
	);
	const availableProviders = useMemo(() => [...new Set(catalog.map((model) => model.provider))].sort(), [catalog]);

	const filteredModels = useMemo(() => {
		const query = search.trim().toLowerCase();
		return scopedModels.filter((model) => {
			if (query && !model.name.toLowerCase().includes(query)) return false;
			if (filters.providers.length > 0 && !filters.providers.includes(model.provider)) return false;
			const mods = parseArchitecture(model);
			if (filters.inputModalities.length > 0 && !filters.inputModalities.some((m) => mods.input.includes(m))) return false;
			if (filters.outputModalities.length > 0 && !filters.outputModalities.some((m) => mods.output.includes(m))) return false;
			if (filters.contextBuckets.length > 0) {
				const bucket = contextBucketId(model.context_length);
				if (!bucket || !filters.contextBuckets.includes(bucket)) return false;
			}
			return true;
		});
	}, [scopedModels, search, filters]);

	if (!hasAccess) {
		return <NoPermissionView entity={t("noPermissionEntity")} />;
	}

	return (
		<div className="mx-auto flex h-[calc(100dvh-1rem)] min-h-0 w-full max-w-7xl flex-col gap-4 overflow-hidden p-4">
			<div className="flex flex-wrap items-center gap-3">
				<div>
					<h1 className="text-lg font-semibold" data-testid="model-marketplace-title">
						{t("title")}
					</h1>
					<p className="text-muted-foreground text-sm">{t("subtitle", { count: filteredModels.length })}</p>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={t("searchPlaceholder")}
						className="w-56"
						data-testid="model-marketplace-search"
					/>
					<div className="flex items-center gap-1" data-testid="model-marketplace-vk-selector">
						<VirtualKeySelector
							value={vkId}
							onChange={(value) => setVkId(value)}
							fallbackOption={vkId ? { value: vkId, label: selectedVk?.name || vkId } : null}
							placeholder={t("vkSelector.placeholder")}
							className="w-52"
						/>
						{vkId ? (
							<button
								type="button"
								className="text-muted-foreground hover:text-foreground"
								onClick={() => setVkId("")}
								data-testid="model-marketplace-vk-clear"
							>
								<X className="h-4 w-4" />
							</button>
						) : null}
					</div>
				</div>
			</div>

			{vkId ? (
				<Badge variant="secondary" className="w-fit gap-1.5" data-testid="model-marketplace-vk-badge">
					{isLoadingVk ? t("vkSelector.loading") : t("vkSelector.scoped", { name: selectedVk?.name || vkId })}
				</Badge>
			) : null}

			<div className="flex min-h-0 grow gap-6">
				<ModelMarketplaceFilters
					filters={filters}
					onChange={setFilters}
					availableInputModalities={availableInputModalities}
					availableOutputModalities={availableOutputModalities}
					availableProviders={availableProviders}
				/>
				<div className="min-h-0 grow overflow-auto pr-1" data-testid="model-marketplace-list">
					{isLoading ? (
						<div className="flex flex-col gap-3">
							<Skeleton className="h-32 w-full" />
							<Skeleton className="h-32 w-full" />
							<Skeleton className="h-32 w-full" />
						</div>
					) : isError ? (
						<p className="text-muted-foreground text-sm">{t("error")}</p>
					) : filteredModels.length === 0 ? (
						<div className="text-muted-foreground flex flex-col items-center justify-center gap-1 pt-16">
							<p className="text-foreground text-sm font-medium">
								{vkId && catalog.length > 0 && scopedModels.length === 0 ? t("emptyWhitelist.title") : t("empty.title")}
							</p>
							<p className="text-sm">
								{vkId && catalog.length > 0 && scopedModels.length === 0 ? t("emptyWhitelist.description") : t("empty.description")}
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							{filteredModels.map((model) => (
								<ModelMarketplaceCard key={`${model.provider}:${model.name}`} model={model} />
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}