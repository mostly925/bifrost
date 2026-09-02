import { SecretVarInput } from "@/components/ui/secretVarInput";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ModelMultiselect } from "@/components/ui/modelMultiselect";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagInput } from "@/components/ui/tagInput";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isRedacted } from "@/lib/utils/validation";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Control, UseFormReturn } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { DeploymentsTable } from "./deploymentsTable";

// Providers that support batch APIs
const BATCH_SUPPORTED_PROVIDERS = ["openai", "bedrock", "anthropic", "gemini", "azure", "vertex", "wafer"];

interface Props {
	control: Control<any>;
	providerName: string;
	// For custom providers, the underlying base provider type (e.g. "bedrock").
	// Drives which credential UI renders; falls back to providerName for native providers.
	baseProviderType?: string;
	form: UseFormReturn<any>;
}

// Batch API form field for all providers
function BatchAPIFormField({ control }: { control: Control<any>; form: UseFormReturn<any> }) {
	const { t } = useTranslation("providers");
	return (
		<FormField
			control={control}
			name={`key.use_for_batch_api`}
			render={({ field }) => (
				<FormItem className="flex flex-row items-center justify-between rounded-sm border p-2">
					<div className="space-y-1.5">
						<FormLabel>{t("apiKeys.batch.label")}</FormLabel>
						<FormDescription>{t("apiKeys.batch.description")}</FormDescription>
					</div>
					<FormControl>
						<Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
					</FormControl>
				</FormItem>
			)}
		/>
	);
}

// AWS endpoint services Bifrost dials for Bedrock. `name` is the config field, `placeholder` the
// DNS name shape for that service - S3 differs from the rest, so each is spelled out.
const BEDROCK_VPC_ENDPOINT_SERVICES = [
	{
		name: "runtime",
		labelKey: "apiKeys.vpcEndpoints.services.runtime.label",
		descriptionKey: "apiKeys.vpcEndpoints.services.runtime.description",
		placeholder: "vpce-0abc123-x1y2z3.bedrock-runtime.us-east-1.vpce.amazonaws.com",
	},
	{
		name: "control_plane",
		labelKey: "apiKeys.vpcEndpoints.services.controlPlane.label",
		descriptionKey: "apiKeys.vpcEndpoints.services.controlPlane.description",
		placeholder: "vpce-0abc123-x1y2z3.bedrock.us-east-1.vpce.amazonaws.com",
	},
	{
		name: "mantle",
		labelKey: "apiKeys.vpcEndpoints.services.mantle.label",
		descriptionKey: "apiKeys.vpcEndpoints.services.mantle.description",
		placeholder: "vpce-0abc123-x1y2z3.bedrock-mantle.us-east-1.vpce.amazonaws.com",
	},
	{
		name: "agent_runtime",
		labelKey: "apiKeys.vpcEndpoints.services.agentRuntime.label",
		descriptionKey: "apiKeys.vpcEndpoints.services.agentRuntime.description",
		placeholder: "vpce-0abc123-x1y2z3.bedrock-agent-runtime.us-east-1.vpce.amazonaws.com",
	},
	{
		name: "s3",
		labelKey: "apiKeys.vpcEndpoints.services.s3.label",
		descriptionKey: "apiKeys.vpcEndpoints.services.s3.description",
		placeholder: "bucket.vpce-0abc123-x1y2z3.s3.us-east-1.vpce.amazonaws.com",
	},
] as const;

// VPC endpoint host overrides for AWS PrivateLink. Collapsed by default: most deployments reach
// Bedrock over the public regional endpoints and never set these.
function VPCEndpointsFormField({
	control,
	configKey,
	services,
}: {
	control: Control<any>;
	configKey: string;
	services: readonly {
		name: string;
		labelKey: (typeof BEDROCK_VPC_ENDPOINT_SERVICES)[number]["labelKey"];
		descriptionKey: (typeof BEDROCK_VPC_ENDPOINT_SERVICES)[number]["descriptionKey"];
		placeholder: string;
	}[];
}) {
	const { t } = useTranslation("providers");
	return (
		<Accordion type="single" collapsible className="w-full">
			<AccordionItem value="vpc-endpoints" className="rounded-sm border px-2 last:border-b">
				<AccordionTrigger className="py-2 hover:no-underline" data-testid="bedrock-vpc-endpoints-trigger">
					<span className="block space-y-1.5 pr-2">
						<span className="block text-sm leading-none font-medium">{t("apiKeys.vpcEndpoints.title")}</span>
						<span className="text-muted-foreground block text-sm font-normal">{t("apiKeys.vpcEndpoints.description")}</span>
					</span>
				</AccordionTrigger>
				<AccordionContent className="space-y-4 pt-2 pb-3">
					{services.map((service) => (
						<FormField
							key={service.name}
							control={control}
							name={`${configKey}.endpoints.${service.name}`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t(service.labelKey)}</FormLabel>
									<FormDescription>{t(service.descriptionKey)}</FormDescription>
									<FormControl>
										<SecretVarInput
											data-testid={`apikey-bedrock-endpoint-${service.name}-input`}
											placeholder={service.placeholder}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					))}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

export function ApiKeyFormFragment({ control, providerName, baseProviderType, form }: Props) {
	const { t } = useTranslation("providers");
	// Credential UI keys off the base provider type for custom providers; the
	// model list, deployments table, and API calls still use the real providerName.
	const effectiveProvider = baseProviderType ?? providerName;
	const isBedrock = effectiveProvider === "bedrock";
	const isBedrockMantle = effectiveProvider === "bedrock_mantle";
	const isVertex = effectiveProvider === "vertex";
	const isAzure = effectiveProvider === "azure";
	const isReplicate = effectiveProvider === "replicate";
	const isVLLM = effectiveProvider === "vllm";
	const isOllama = effectiveProvider === "ollama";
	const isSGL = effectiveProvider === "sgl";
	const isDeepseek = effectiveProvider === "deepseek";
	const isFireworks = effectiveProvider === "fireworks";
	const isKeylessProvider = isOllama || isSGL;
	const supportsBatchAPI = BATCH_SUPPORTED_PROVIDERS.includes(effectiveProvider);

	// Auth type state for Azure: 'api_key', 'entra_id', or 'default_credential'
	const [azureAuthType, setAzureAuthType] = useState<"api_key" | "entra_id" | "default_credential">("api_key");

	// Auth type state for Bedrock: 'iam_role', 'explicit', or 'api_key'
	const [bedrockAuthType, setBedrockAuthType] = useState<"iam_role" | "explicit" | "api_key">("iam_role");

	// Auth type state for Bedrock Mantle: 'iam_role', 'explicit', or 'api_key'
	const [bedrockMantleAuthType, setBedrockMantleAuthType] = useState<"iam_role" | "explicit" | "api_key">("iam_role");

	// Auth type state for Vertex: 'service_account', 'service_account_json', or 'api_key'
	const [vertexAuthType, setVertexAuthType] = useState<"service_account" | "service_account_json" | "api_key">("service_account");

	// Detect auth type from existing form values when editing
	useEffect(() => {
		if (form.formState.isDirty) return;
		if (isAzure) {
			const clientId = form.getValues("key.azure_key_config.client_id");
			const clientSecret = form.getValues("key.azure_key_config.client_secret");
			const tenantId = form.getValues("key.azure_key_config.tenant_id");
			const apiKey = form.getValues("key.value");
			const hasEntraField =
				clientId?.value || clientId?.ref || clientSecret?.value || clientSecret?.ref || tenantId?.value || tenantId?.ref;
			const hasApiKey = apiKey?.value || apiKey?.ref;
			let detected: "api_key" | "entra_id" | "default_credential" = "api_key";
			if (hasEntraField) {
				detected = "entra_id";
			} else if (!hasApiKey) {
				detected = "default_credential";
			}
			setAzureAuthType(detected);
			form.setValue("key.azure_key_config._auth_type", detected);
		}
	}, [isAzure, form]);

	useEffect(() => {
		if (form.formState.isDirty) return;
		if (isVertex) {
			const authCredentials = form.getValues("key.vertex_key_config.auth_credentials")?.value;
			const authCredentialsEnv = form.getValues("key.vertex_key_config.auth_credentials")?.ref;
			const apiKey = form.getValues("key.value")?.value;
			const apiKeyEnv = form.getValues("key.value")?.ref;
			let detected: "service_account" | "service_account_json" | "api_key" = "service_account";
			if (authCredentials || authCredentialsEnv) {
				detected = "service_account_json";
			} else if (apiKey || apiKeyEnv) {
				detected = "api_key";
			}
			setVertexAuthType(detected);
			form.setValue("key.vertex_key_config._auth_type", detected);
		}
	}, [isVertex, form]);

	useEffect(() => {
		if (form.formState.isDirty) return;
		if (isBedrock) {
			const accessKey = form.getValues("key.bedrock_key_config.access_key");
			const secretKey = form.getValues("key.bedrock_key_config.secret_key");
			const apiKey = form.getValues("key.value");
			const hasExplicitCreds = accessKey?.value || accessKey?.ref || secretKey?.value || secretKey?.ref;
			const hasApiKey = apiKey?.value || apiKey?.ref;
			let detected: "iam_role" | "explicit" | "api_key" = "iam_role";
			if (hasExplicitCreds) {
				detected = "explicit";
			} else if (hasApiKey) {
				detected = "api_key";
			}
			setBedrockAuthType(detected);
			form.setValue("key.bedrock_key_config._auth_type", detected);
		}
	}, [isBedrock, form]);

	useEffect(() => {
		if (form.formState.isDirty) return;
		if (isBedrockMantle) {
			const accessKey = form.getValues("key.bedrock_mantle_key_config.access_key");
			const secretKey = form.getValues("key.bedrock_mantle_key_config.secret_key");
			const apiKey = form.getValues("key.value");
			const hasExplicitCreds = accessKey?.value || accessKey?.ref || secretKey?.value || secretKey?.ref;
			const hasApiKey = apiKey?.value || apiKey?.ref;
			let detected: "iam_role" | "explicit" | "api_key" = "iam_role";
			if (hasExplicitCreds) {
				detected = "explicit";
			} else if (hasApiKey) {
				detected = "api_key";
			}
			setBedrockMantleAuthType(detected);
			form.setValue("key.bedrock_mantle_key_config._auth_type", detected);
		}
		// form.formState.defaultValues is a dependency so detection re-runs when ProviderKeyForm
		// repopulates an existing key via form.reset(...) after mount, not only on first render.
	}, [isBedrockMantle, form, form.formState.defaultValues]);

	return (
		<div data-tab="api-keys" className="space-y-4 overflow-hidden">
			<div className="flex items-start gap-4">
				<div className="flex-1">
					<FormField
						control={control}
						name={`key.name`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.name.label")}</FormLabel>
								<FormControl>
									<Input placeholder={t("apiKeys.name.placeholder")} type="text" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<FormField
					control={control}
					name={`key.weight`}
					render={({ field }) => (
						<FormItem>
							<div className="flex items-center gap-2">
								<FormLabel>{t("apiKeys.weight.label")}</FormLabel>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<span>
												<Info className="text-muted-foreground h-3 w-3" />
											</span>
										</TooltipTrigger>
										<TooltipContent className="max-w-sm">
											<p>{t("apiKeys.weight.tooltip")}</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</div>
							<FormControl>
								<Input
									placeholder="1.0"
									className="w-[260px]"
									value={field.value === undefined || field.value === null ? "" : String(field.value)}
									onChange={(e) => {
										// Keep as string during typing to allow partial input
										field.onChange(e.target.value === "" ? "" : e.target.value);
									}}
									onBlur={(e) => {
										const v = e.target.value.trim();
										if (v !== "") {
											const num = parseFloat(v);
											if (!isNaN(num)) {
												field.onChange(num);
											}
										}
										field.onBlur();
									}}
									name={field.name}
									ref={field.ref}
									type="text"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>
			{/* Hide API Key field for providers with dedicated auth tabs */}
			{!isAzure && !isBedrock && !isBedrockMantle && !isVertex && (
				<FormField
					control={control}
					name={`key.value`}
					render={({ field }) => (
						<FormItem>
							<FormLabel>{isVLLM ? t("apiKeys.apiKey.optional") : t("apiKeys.apiKey.label")}</FormLabel>
							<FormControl>
								<SecretVarInput placeholder={t("apiKeys.apiKey.placeholder")} type="text" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			)}
			{!isVLLM && (
				<>
					<FormField
						control={control}
						name={`key.models`}
						render={({ field }) => (
							<FormItem>
								<div className="flex items-center gap-2">
									<FormLabel>{t("apiKeys.allowedModels.label")}</FormLabel>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span>
													<Info className="text-muted-foreground h-3 w-3" />
												</span>
											</TooltipTrigger>
											<TooltipContent className="max-w-sm">
												<p>{t("apiKeys.allowedModels.tooltip")}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
								<FormControl>
									<ModelMultiselect
										data-testid="api-keys-models-multiselect"
										provider={providerName}
										allowAllOption={true}
										value={field.value || []}
										onChange={(models: string[]) => {
											const hadStar = (field.value || []).includes("*");
											const hasStar = models.includes("*");
											if (!hadStar && hasStar) {
												field.onChange(["*"]);
											} else if (hadStar && hasStar && models.length > 1) {
												field.onChange(models.filter((m: string) => m !== "*"));
											} else {
												field.onChange(models);
											}
										}}
										placeholder={
											(field.value || []).includes("*")
												? t("apiKeys.allowedModels.placeholderAll")
												: (field.value || []).length === 0
													? t("apiKeys.allowedModels.placeholderNone")
													: t("apiKeys.allowedModels.placeholderSearch")
										}
										unfiltered={true}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name={`key.blacklisted_models`}
						render={({ field }) => (
							<FormItem data-testid="apikey-blacklisted-models-field">
								<div className="flex items-center gap-2">
									<FormLabel>{t("apiKeys.blockedModels.label")}</FormLabel>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span>
													<Info className="text-muted-foreground h-3 w-3" />
												</span>
											</TooltipTrigger>
											<TooltipContent className="max-w-sm">
												<p>{t("apiKeys.blockedModels.tooltip")}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
								<FormControl>
									<ModelMultiselect
										data-testid="api-keys-blocked-models-multiselect"
										provider={providerName}
										allowAllOption={true}
										value={field.value || []}
										onChange={(models: string[]) => {
											const hadStar = (field.value || []).includes("*");
											const hasStar = models.includes("*");
											if (!hadStar && hasStar) {
												field.onChange(["*"]);
											} else if (hadStar && hasStar && models.length > 1) {
												field.onChange(models.filter((m: string) => m !== "*"));
											} else {
												field.onChange(models);
											}
										}}
										placeholder={
											(field.value || []).includes("*")
												? t("apiKeys.blockedModels.placeholderAll")
												: (field.value || []).length === 0
													? t("apiKeys.blockedModels.placeholderNone")
													: t("apiKeys.blockedModels.placeholderSearch")
										}
										unfiltered={true}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name={`key.aliases`}
						render={({ field }) => (
							<FormItem data-testid="apikey-deployments-field">
								<FormLabel>{t("apiKeys.deployments.label")}</FormLabel>
								<FormDescription>{t("apiKeys.deployments.description")}</FormDescription>
								<FormControl>
									<div data-testid="apikey-deployments-table">
										<DeploymentsTable
											providerName={providerName}
											value={field.value}
											onChange={(next) => {
												form.clearErrors("key.aliases");
												field.onChange(Object.keys(next).length > 0 ? next : {});
											}}
										/>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</>
			)}
			{supportsBatchAPI && !isBedrock && !isAzure && !isVertex && <BatchAPIFormField control={control} form={form} />}
			{isAzure && (
				<div className="space-y-4">
					<Separator className="my-6" />
					<div className="space-y-2">
						<FormLabel>{t("apiKeys.auth.method")}</FormLabel>
						<Tabs
							value={azureAuthType}
							onValueChange={(v) => {
								setAzureAuthType(v as "api_key" | "entra_id" | "default_credential");
								form.setValue("key.azure_key_config._auth_type", v, { shouldDirty: true, shouldValidate: true });
								if (v === "entra_id" || v === "default_credential") {
									// Clear API key when switching away from API Key
									form.setValue("key.value", undefined, { shouldDirty: true });
								}
								if (v === "api_key" || v === "default_credential") {
									// Clear Entra ID fields when switching away from Entra ID
									form.setValue("key.azure_key_config.client_id", undefined, { shouldDirty: true });
									form.setValue("key.azure_key_config.client_secret", undefined, { shouldDirty: true });
									form.setValue("key.azure_key_config.tenant_id", undefined, { shouldDirty: true });
									form.setValue("key.azure_key_config.scopes", undefined, { shouldDirty: true });
								}
							}}
						>
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger data-testid="apikey-azure-default-credential-tab" value="default_credential">
									{t("apiKeys.auth.tabs.defaultCredential")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-azure-api-key-tab" value="api_key">
									{t("apiKeys.auth.tabs.apiKey")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-azure-entra-id-tab" value="entra_id">
									{t("apiKeys.auth.tabs.entraId")}
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
					{azureAuthType === "api_key" && (
						<FormField
							control={control}
							name={`key.value`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("apiKeys.apiKey.label")}</FormLabel>
									<FormControl>
										<SecretVarInput placeholder={t("apiKeys.apiKey.placeholder")} type="text" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}
					{azureAuthType === "default_credential" && (
						<p className="text-muted-foreground text-sm">{t("apiKeys.azure.defaultCredentialNote")}</p>
					)}

					<FormField
						control={control}
						name={`key.azure_key_config.endpoint`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.azure.endpoint.label")}</FormLabel>
								<FormControl>
									<SecretVarInput placeholder={t("apiKeys.placeholders.azureEndpoint")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{azureAuthType === "entra_id" && (
						<>
							<FormField
								control={control}
								name={`key.azure_key_config.client_id`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.azure.clientId.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.azureClientId")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.azure_key_config.client_secret`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.azure.clientSecret.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.azureClientSecret")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.azure_key_config.tenant_id`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.azure.tenantId.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.azureTenantId")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.azure_key_config.scopes`}
								render={({ field }) => (
									<FormItem>
										<div className="flex items-center gap-2">
											<FormLabel>{t("apiKeys.azure.scopes.label")}</FormLabel>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<span>
															<Info className="text-muted-foreground h-3 w-3" />
														</span>
													</TooltipTrigger>
													<TooltipContent>
														<p>{t("apiKeys.azure.scopes.tooltip")}</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
										<FormControl>
											<TagInput
												data-testid="apikey-azure-scopes-input"
												placeholder={t("apiKeys.azure.scopes.placeholder")}
												value={field.value ?? []}
												onValueChange={field.onChange}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</>
					)}
					{supportsBatchAPI && <BatchAPIFormField control={control} form={form} />}
				</div>
			)}
			{isVertex && (
				<div className="space-y-4">
					<Separator className="my-6" />
					<div className="space-y-2">
						<FormLabel>{t("apiKeys.auth.method")}</FormLabel>
						<Tabs
							value={vertexAuthType}
							onValueChange={(v) => {
								setVertexAuthType(v as "service_account" | "service_account_json" | "api_key");
								form.setValue("key.vertex_key_config._auth_type", v, { shouldDirty: true, shouldValidate: true });
								if (v === "service_account" || v === "api_key") {
									// Clear auth credentials when switching away from service account JSON
									form.setValue("key.vertex_key_config.auth_credentials", undefined, { shouldDirty: true });
								}
								if (v === "service_account" || v === "service_account_json") {
									// Clear API key when switching away from API Key
									form.setValue("key.value", undefined, { shouldDirty: true });
								}
							}}
						>
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger data-testid="apikey-vertex-service-account-tab" value="service_account">
									{t("apiKeys.auth.tabs.serviceAccountAttached")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-vertex-service-account-json-tab" value="service_account_json">
									{t("apiKeys.auth.tabs.serviceAccountJson")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-vertex-api-key-tab" value="api_key">
									{t("apiKeys.auth.tabs.apiKey")}
								</TabsTrigger>
							</TabsList>
						</Tabs>
						{vertexAuthType === "service_account" && <p className="text-muted-foreground text-sm">{t("apiKeys.vertex.attachedNote")}</p>}
					</div>

					<FormField
						control={control}
						name={`key.vertex_key_config.project_id`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.vertex.projectId.label")}</FormLabel>
								<FormControl>
									<SecretVarInput placeholder={t("apiKeys.placeholders.gcpProjectId")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name={`key.vertex_key_config.project_number`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.vertex.projectNumber.label")}</FormLabel>
								<FormControl>
									<SecretVarInput placeholder={t("apiKeys.placeholders.gcpProjectNumber")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name={`key.vertex_key_config.region`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.vertex.region.label")}</FormLabel>
								<FormDescription>
									<Trans ns="providers" i18nKey="apiKeys.vertex.region.description">
										Multi-region-only models are automatically routed to Google&apos;s matching multi-region endpoint. Turn on{" "}
										<span className="font-medium">Force single region</span> below to always use exactly this region.
									</Trans>
								</FormDescription>
								<FormControl>
									<SecretVarInput placeholder={t("apiKeys.placeholders.vertexRegion")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{vertexAuthType === "service_account_json" && (
						<FormField
							control={control}
							name={`key.vertex_key_config.auth_credentials`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("apiKeys.vertex.authCredentials.label")}</FormLabel>
									<FormDescription>{t("apiKeys.vertex.authCredentials.description")}</FormDescription>
									<FormControl>
										<SecretVarInput
											data-testid="apikey-vertex-auth-credentials-input"
											variant="textarea"
											rows={4}
											placeholder='{"type":"service_account","project_id":"your-gcp-project",...} or env.VERTEX_CREDENTIALS'
											inputClassName="font-mono text-sm"
											{...field}
										/>
									</FormControl>
									{isRedacted(field.value?.value ?? "") && (
										<div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
											<Info className="h-3 w-3" />
											<span>{t("apiKeys.vertex.authCredentials.storedSecurely")}</span>
										</div>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					{vertexAuthType === "api_key" && (
						<FormField
							control={control}
							name={`key.value`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("apiKeys.apiKey.geminiOnly")}</FormLabel>
									<FormControl>
										<SecretVarInput
											data-testid="apikey-vertex-api-key-input"
											placeholder={t("apiKeys.apiKey.placeholder")}
											type="text"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}
					<FormField
						control={control}
						name="key.vertex_key_config.force_single_region"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-sm border p-2">
								<div className="space-y-1.5">
									<FormLabel>{t("apiKeys.vertex.forceSingleRegion.label")}</FormLabel>
									<FormDescription>{t("apiKeys.vertex.forceSingleRegion.description")}</FormDescription>
								</div>
								<FormControl>
									<Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
								</FormControl>
							</FormItem>
						)}
					/>
					{supportsBatchAPI && <BatchAPIFormField control={control} form={form} />}
				</div>
			)}
			{isReplicate && (
				<div className="space-y-4">
					<Separator className="my-6" />
					<FormField
						control={control}
						name="key.replicate_key_config.use_deployments_endpoint"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-sm border p-2">
								<div className="space-y-1.5">
									<FormLabel>{t("apiKeys.replicate.useDeploymentsEndpoint.label")}</FormLabel>
									<FormDescription>{t("apiKeys.replicate.useDeploymentsEndpoint.description")}</FormDescription>
								</div>
								<FormControl>
									<Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
								</FormControl>
							</FormItem>
						)}
					/>
				</div>
			)}
			{isVLLM && (
				<div className="space-y-4">
					<Separator className="my-6" />
					<FormField
						control={control}
						name="key.vllm_key_config.url"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.serverUrl.label")}</FormLabel>
								<FormDescription>{t("apiKeys.vllm.serverUrl.description")}</FormDescription>
								<FormControl>
									<SecretVarInput data-testid="key-input-vllm-url" placeholder="http://vllm-server:8000" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name="key.vllm_key_config.model_name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.vllm.modelName.label")}</FormLabel>
								<FormDescription>{t("apiKeys.vllm.modelName.description")}</FormDescription>
								<FormControl>
									<Input data-testid="key-input-vllm-model-name" placeholder="meta-llama/Llama-3-70b-hf" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			)}
			{isKeylessProvider && (
				<div className="space-y-4">
					<FormField
						control={control}
						name={`key.${isOllama ? "ollama_key_config" : "sgl_key_config"}.url`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.serverUrl.label")}</FormLabel>
								<FormDescription>
									{t("apiKeys.keyless.serverUrl.description", {
										provider: isOllama ? "Ollama" : "SGLang",
										url: isOllama ? "http://localhost:11434" : "http://localhost:30000",
										envVar: isOllama ? "env.OLLAMA_URL" : "env.SGL_URL",
									})}
								</FormDescription>
								<FormControl>
									<SecretVarInput
										data-testid={`key-input-${isOllama ? "ollama" : "sgl"}-url`}
										placeholder={isOllama ? "http://localhost:11434" : "http://localhost:30000"}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			)}
			{(isSGL || isDeepseek || isFireworks || isVLLM) && (
				<div className="space-y-4">
					<FormField
						control={control}
						name="key.use_anthropic_endpoints"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-sm border p-2">
								<div className="space-y-1.5">
									<FormLabel htmlFor="use-anthropic-endpoints-alias-override-switch">{t("apiKeys.anthropicEndpoints.label")}</FormLabel>
									<FormDescription>{t("apiKeys.anthropicEndpoints.description")}</FormDescription>
								</div>
								<FormControl>
									<Switch
										id="use-anthropic-endpoints-alias-override-switch"
										checked={field.value ?? false}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
							</FormItem>
						)}
					/>
				</div>
			)}
			{isBedrock && (
				<div className="space-y-4">
					<Separator className="my-6" />
					<div className="space-y-2">
						<FormLabel>{t("apiKeys.auth.method")}</FormLabel>
						<Tabs
							value={bedrockAuthType}
							onValueChange={(v) => {
								setBedrockAuthType(v as "iam_role" | "explicit" | "api_key");
								form.setValue("key.bedrock_key_config._auth_type", v, { shouldDirty: true, shouldValidate: true });
								if (v === "iam_role") {
									// Clear explicit credentials and API key when switching to IAM Role
									form.setValue("key.bedrock_key_config.access_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_key_config.secret_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_key_config.session_token", undefined, { shouldDirty: true });
									form.setValue("key.value", undefined, { shouldDirty: true });
								} else if (v === "explicit") {
									// Clear API key when switching to Explicit Credentials
									form.setValue("key.value", undefined, { shouldDirty: true });
								} else if (v === "api_key") {
									// Clear AWS credentials and assume-role fields when switching to API Key
									form.setValue("key.bedrock_key_config.access_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_key_config.secret_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_key_config.session_token", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_key_config.role_arn", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_key_config.external_id", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_key_config.session_name", undefined, { shouldDirty: true });
								}
							}}
						>
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger data-testid="apikey-bedrock-iam-role-tab" value="iam_role">
									{t("apiKeys.auth.tabs.iamRole")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-bedrock-explicit-credentials-tab" value="explicit">
									{t("apiKeys.auth.tabs.explicit")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-bedrock-api-key-tab" value="api_key">
									{t("apiKeys.auth.tabs.apiKey")}
								</TabsTrigger>
							</TabsList>
						</Tabs>
						{bedrockAuthType === "iam_role" && <p className="text-muted-foreground text-sm">{t("apiKeys.credentials.iamNote")}</p>}
						{bedrockAuthType === "api_key" && <p className="text-muted-foreground text-sm">{t("apiKeys.credentials.apiKeyNote")}</p>}
					</div>

					{bedrockAuthType === "explicit" && (
						<>
							<FormField
								control={control}
								name={`key.bedrock_key_config.access_key`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.accessKey.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.awsAccessKey")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_key_config.secret_key`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.secretKey.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.awsSecretKey")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_key_config.session_token`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.sessionToken.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.awsSessionToken")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</>
					)}

					{bedrockAuthType === "api_key" && (
						<FormField
							control={control}
							name={`key.value`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("apiKeys.apiKey.label")}</FormLabel>
									<FormControl>
										<SecretVarInput
											data-testid="apikey-bedrock-api-key-input"
											placeholder={t("apiKeys.placeholders.bedrockApiKey")}
											type="text"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					<FormField
						control={control}
						name={`key.bedrock_key_config.region`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.credentials.region.label")}</FormLabel>
								<FormControl>
									<SecretVarInput placeholder={t("apiKeys.placeholders.awsRegion")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={control}
						name={`key.bedrock_key_config.project_id`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.credentials.mantleProjectId.label")}</FormLabel>
								<FormDescription>{t("apiKeys.credentials.mantleProjectId.description")}</FormDescription>
								<FormControl>
									<SecretVarInput
										data-testid="apikey-bedrock-project-id-input"
										placeholder={t("apiKeys.placeholders.bedrockProjectId")}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{bedrockAuthType !== "api_key" && (
						<>
							<FormField
								control={control}
								name={`key.bedrock_key_config.role_arn`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.roleArn.label")}</FormLabel>
										<FormDescription>{t("apiKeys.credentials.roleArn.description")}</FormDescription>
										<FormControl>
											<SecretVarInput
												data-testid="apikey-bedrock-role-arn-input"
												placeholder={t("apiKeys.placeholders.roleArn")}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_key_config.external_id`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.externalId.label")}</FormLabel>
										<FormDescription>{t("apiKeys.credentials.externalId.description")}</FormDescription>
										<FormControl>
											<SecretVarInput
												data-testid="apikey-bedrock-external-id-input"
												placeholder={t("apiKeys.placeholders.externalId")}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_key_config.session_name`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.sessionName.label")}</FormLabel>
										<FormDescription>{t("apiKeys.credentials.sessionName.description")}</FormDescription>
										<FormControl>
											<SecretVarInput
												data-testid="apikey-bedrock-session-name-input"
												placeholder={t("apiKeys.placeholders.sessionName")}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</>
					)}
					<FormField
						control={control}
						name={`key.bedrock_key_config.arn`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.credentials.arn.label")}</FormLabel>
								<FormControl>
									<SecretVarInput placeholder={t("apiKeys.placeholders.inferenceProfileArn")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{supportsBatchAPI && (
						<FormField
							control={control}
							name={`key.bedrock_key_config.batch_role_arn`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("apiKeys.credentials.batchRoleArn.label")}</FormLabel>
									<FormDescription>{t("apiKeys.credentials.batchRoleArn.description")}</FormDescription>
									<FormControl>
										<SecretVarInput
											data-testid="apikey-bedrock-batch-role-arn-input"
											placeholder={t("apiKeys.placeholders.batchRoleArn")}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}
					{supportsBatchAPI && <BatchAPIFormField control={control} form={form} />}
					<VPCEndpointsFormField control={control} configKey="key.bedrock_key_config" services={BEDROCK_VPC_ENDPOINT_SERVICES} />
				</div>
			)}

			{isBedrockMantle && (
				<div className="space-y-4">
					<Separator className="my-6" />
					<div className="space-y-2">
						<FormLabel>{t("apiKeys.auth.method")}</FormLabel>
						<Tabs
							value={bedrockMantleAuthType}
							onValueChange={(v) => {
								setBedrockMantleAuthType(v as "iam_role" | "explicit" | "api_key");
								form.setValue("key.bedrock_mantle_key_config._auth_type", v, { shouldDirty: true, shouldValidate: true });
								if (v === "iam_role") {
									// Clear explicit credentials and API key when switching to IAM Role
									form.setValue("key.bedrock_mantle_key_config.access_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_mantle_key_config.secret_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_mantle_key_config.session_token", undefined, { shouldDirty: true });
									form.setValue("key.value", undefined, { shouldDirty: true });
								} else if (v === "explicit") {
									// Clear API key when switching to Explicit Credentials
									form.setValue("key.value", undefined, { shouldDirty: true });
								} else if (v === "api_key") {
									// Clear AWS credentials and assume-role fields when switching to API Key
									form.setValue("key.bedrock_mantle_key_config.access_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_mantle_key_config.secret_key", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_mantle_key_config.session_token", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_mantle_key_config.role_arn", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_mantle_key_config.external_id", undefined, { shouldDirty: true });
									form.setValue("key.bedrock_mantle_key_config.session_name", undefined, { shouldDirty: true });
								}
							}}
						>
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger data-testid="apikey-bedrock-mantle-iam-role-tab" value="iam_role">
									{t("apiKeys.auth.tabs.iamRole")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-bedrock-mantle-explicit-credentials-tab" value="explicit">
									{t("apiKeys.auth.tabs.explicit")}
								</TabsTrigger>
								<TabsTrigger data-testid="apikey-bedrock-mantle-api-key-tab" value="api_key">
									{t("apiKeys.auth.tabs.apiKey")}
								</TabsTrigger>
							</TabsList>
						</Tabs>
						{bedrockMantleAuthType === "iam_role" && <p className="text-muted-foreground text-sm">{t("apiKeys.credentials.iamNote")}</p>}
						{bedrockMantleAuthType === "api_key" && (
							<p className="text-muted-foreground text-sm">{t("apiKeys.credentials.mantleApiKeyNote")}</p>
						)}
					</div>

					{bedrockMantleAuthType === "explicit" && (
						<>
							<FormField
								control={control}
								name={`key.bedrock_mantle_key_config.access_key`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.accessKey.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.awsAccessKey")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_mantle_key_config.secret_key`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.secretKey.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.awsSecretKey")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_mantle_key_config.session_token`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.sessionToken.label")}</FormLabel>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.awsSessionToken")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</>
					)}

					{bedrockMantleAuthType === "api_key" && (
						<FormField
							control={control}
							name={`key.value`}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("apiKeys.apiKey.label")}</FormLabel>
									<FormControl>
										<SecretVarInput
											data-testid="apikey-bedrock-mantle-api-key-input"
											placeholder={t("apiKeys.placeholders.bedrockMantleApiKey")}
											type="text"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

					<FormField
						control={control}
						name={`key.bedrock_mantle_key_config.region`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.credentials.region.label")}</FormLabel>
								<FormControl>
									<SecretVarInput placeholder={t("apiKeys.placeholders.awsRegion")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={control}
						name={`key.bedrock_mantle_key_config.project_id`}
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("apiKeys.credentials.projectId.label")}</FormLabel>
								<FormDescription>{t("apiKeys.credentials.projectId.description")}</FormDescription>
								<FormControl>
									<SecretVarInput
										data-testid="apikey-bedrock-mantle-project-id-input"
										placeholder={t("apiKeys.placeholders.bedrockProjectId")}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{bedrockMantleAuthType !== "api_key" && (
						<>
							<FormField
								control={control}
								name={`key.bedrock_mantle_key_config.role_arn`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.roleArn.label")}</FormLabel>
										<FormDescription>{t("apiKeys.credentials.roleArn.description")}</FormDescription>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.roleArn")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_mantle_key_config.external_id`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.externalId.label")}</FormLabel>
										<FormDescription>{t("apiKeys.credentials.externalId.description")}</FormDescription>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.externalId")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={control}
								name={`key.bedrock_mantle_key_config.session_name`}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("apiKeys.credentials.sessionName.label")}</FormLabel>
										<FormDescription>{t("apiKeys.credentials.sessionName.description")}</FormDescription>
										<FormControl>
											<SecretVarInput placeholder={t("apiKeys.placeholders.sessionName")} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</>
					)}
					<VPCEndpointsFormField
						control={control}
						configKey="key.bedrock_mantle_key_config"
						services={BEDROCK_VPC_ENDPOINT_SERVICES.filter((s) => s.name === "mantle")}
					/>
				</div>
			)}
		</div>
	);
}