import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RenderProviderIcon } from "@/lib/constants/icons";
import type { ModelDetails } from "@/lib/store/apis/providersApi";
import { formatCompactNumber, formatTokenPriceCompact } from "@/lib/utils/numbers";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ModalityIcon } from "./modalityIcon";
import { isKnownProvider } from "./providerUtils";

interface ModelMarketplaceCardProps {
	model: ModelDetails;
}

export default function ModelMarketplaceCard({ model }: ModelMarketplaceCardProps) {
	const { t } = useTranslation("modelMarketplace");
	const { copied, copy } = useCopyToClipboard();

	const architecture = model.architecture as { input_modalities?: string[]; output_modalities?: string[] } | undefined;
	const inputModalities = architecture?.input_modalities ?? [];
	const outputModalities = architecture?.output_modalities ?? [];

	return (
		<Card className="py-0" data-testid="model-marketplace-card">
			<CardContent className="flex flex-col gap-3 px-5 py-4">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-start gap-3">
						{isKnownProvider(model.provider) ? <RenderProviderIcon provider={model.provider} className="mt-0.5 h-6 w-6 shrink-0" /> : null}
						<div className="min-w-0">
							<p className="truncate font-semibold" data-testid="model-marketplace-card-name">
								{model.name}
							</p>
							<div className="text-muted-foreground flex items-center gap-1.5">
								<code className="truncate font-mono text-xs">{model.name}</code>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="text-muted-foreground h-5 w-5"
												onClick={() => copy(model.name)}
												data-testid="model-marketplace-card-copy-id"
											>
												{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
											</Button>
										</TooltipTrigger>
										<TooltipContent>{copied ? t("card.copied") : t("card.copyModelId")}</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
						</div>
					</div>
					<Badge variant="outline" className="shrink-0 gap-1" data-testid="model-marketplace-card-provider">
						{isKnownProvider(model.provider) ? <RenderProviderIcon provider={model.provider} className="h-3.5 w-3.5" /> : null}
						{model.provider}
					</Badge>
				</div>

				<div className="bg-muted/30 grid grid-cols-2 gap-x-6 gap-y-2 rounded-sm border px-3 py-2 text-sm sm:grid-cols-4">
					<div>
						<p className="text-muted-foreground text-xs">{t("card.input")}</p>
						<p className="font-mono" data-testid="model-marketplace-card-input-cost">
							{formatTokenPriceCompact(model.input_cost_per_token)}
							<span className="text-muted-foreground text-xs">{t("card.perMillion")}</span>
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">{t("card.output")}</p>
						<p className="font-mono" data-testid="model-marketplace-card-output-cost">
							{formatTokenPriceCompact(model.output_cost_per_token)}
							<span className="text-muted-foreground text-xs">{t("card.perMillion")}</span>
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">{t("card.context")}</p>
						<p className="font-mono" data-testid="model-marketplace-card-context">
							{model.context_length !== undefined && model.context_length !== null ? formatCompactNumber(model.context_length) : "—"}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">{t("card.modalities")}</p>
						<div className="mt-0.5 flex items-center gap-1.5">
							{inputModalities.map((modality) => (
								<ModalityIcon key={`in-${modality}`} modality={modality} className="h-4 w-4" />
							))}
							{inputModalities.length > 0 && outputModalities.length > 0 ? <span className="text-muted-foreground text-xs">→</span> : null}
							{outputModalities.map((modality) => (
								<ModalityIcon key={`out-${modality}`} modality={modality} className="text-muted-foreground h-4 w-4" />
							))}
							{inputModalities.length === 0 && outputModalities.length === 0 ? (
								<span className="text-muted-foreground text-xs">—</span>
							) : null}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}