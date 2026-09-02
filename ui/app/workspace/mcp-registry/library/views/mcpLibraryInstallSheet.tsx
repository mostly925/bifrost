import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecretVarInput } from "@/components/ui/secretVarInput";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { HeadersTable } from "@/components/ui/headersTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, useCreateMCPClientMutation } from "@/lib/store";
import { CreateMCPClientRequest, SecretVar, MCPAuthType, MCPLibraryEntry, MCPTLSConfig } from "@/lib/types/mcp";
import { parseArrayFromText } from "@/lib/utils/array";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { Globe, Info, KeyRound, Radio, ShieldCheck, Terminal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { MCPHeadersAuthorizer } from "../../views/mcpHeadersAuthorizer";
import { OAuth2Authorizer } from "../../views/oauth2Authorizer";
import { authLabel, categoryLabel, transportLabel } from "./mcpLibraryTaxonomy";

const MCP_ICON_FALLBACK = "/images/mcp.svg";

interface MCPLibraryInstallSheetProps {
	server: MCPLibraryEntry;
	open: boolean;
	onClose: () => void;
	onInstalled: () => void;
}

const emptySecretVar: SecretVar = { value: "", ref: "" };

/** Strips empty TLS config so we don't send `{}` to the server. */
function buildTLSConfigPayload(tls: MCPTLSConfig | undefined): MCPTLSConfig | undefined {
	if (!tls) return undefined;
	const hasSkipVerify = tls.insecure_skip_verify === true;
	const hasCACert = tls.ca_cert_pem?.value?.trim() || tls.ca_cert_pem?.ref?.trim();
	if (!hasSkipVerify && !hasCACert) return undefined;
	return { insecure_skip_verify: tls.insecure_skip_verify, ca_cert_pem: hasCACert ? tls.ca_cert_pem : undefined };
}

function isValidOAuthResourceURI(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol !== "" && parsed.hash === "";
	} catch {
		return false;
	}
}

/**
 * Sanitize a catalog server name into a valid MCP client name. The backend
 * only allows [a-zA-Z0-9_] and disallows a leading digit, so we slugify by
 * replacing any run of invalid characters with a single underscore. Case is
 * preserved (e.g. "Maxim AI" -> "Maxim_AI").
 */
export function sanitizeServerName(name: string): string {
	const cleaned = name
		.trim()
		.replace(/[^a-zA-Z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "");
	// Prefix if it ends up empty or starts with a digit (leading-digit is rejected).
	return /^[0-9]/.test(cleaned) || cleaned === "" ? `mcp_${cleaned}` : cleaned;
}

function buildInitialValues(server: MCPLibraryEntry): CreateMCPClientRequest {
	const authType = (server.auth_type || "none") as MCPAuthType;
	const isStdio = server.connection_type === "stdio";
	return {
		name: sanitizeServerName(server.name),
		is_code_mode_client: false,
		is_ping_available: true,
		connection_type: server.connection_type || "http",
		connection_string: isStdio ? undefined : server.connection_url ? { value: server.connection_url, ref: "" } : emptySecretVar,
		stdio_config: isStdio && server.stdio_config ? server.stdio_config : undefined,
		auth_type: authType,
		headers: authType === "headers" ? { Authorization: { value: "", ref: "" } } : undefined,
	};
}

function TransportIcon({ connectionType }: { connectionType?: string }) {
	switch (connectionType) {
		case "stdio":
			return <Terminal className="size-3.5" />;
		case "sse":
			return <Radio className="size-3.5" />;
		default:
			return <Globe className="size-3.5" />;
	}
}

export function MCPLibraryInstallSheet({ server, open, onClose, onInstalled }: MCPLibraryInstallSheetProps) {
	const { t } = useTranslation("mcpLibrary");
	const hasCreateMCPClientAccess = useRbac(RbacResource.MCPGateway, RbacOperation.Create);
	const { toast } = useToast();
	const [createMCPClient] = useCreateMCPClientMutation();
	const [isLoading, setIsLoading] = useState(false);
	const [scopesText, setScopesText] = useState("");
	const [resourceText, setResourceText] = useState("");
	const [envVars, setEnvVars] = useState<Record<string, string>>({});
	const [oauthFlow, setOauthFlow] = useState<{
		authorizeUrl: string;
		oauthConfigId: string;
		mcpClientId: string;
		isPerUserOauth?: boolean;
	} | null>(null);

	// Per-user-headers admin flow: admin declares the required key names,
	// then on install the MCPHeadersAuthorizer dialog runs a sample-values
	// verify and returns discovered tools.
	const [perUserHeaderKeys, setPerUserHeaderKeys] = useState<string[]>([]);
	const [newHeaderKeyInput, setNewHeaderKeyInput] = useState("");
	const [headersFlow, setHeadersFlow] = useState<{ payload: CreateMCPClientRequest } | null>(null);

	// UI splits the canonical `auth_type` into two dropdowns:
	//   - authKind: none | headers | oauth
	//   - authScope: shared | per_user (hidden when authKind = none)
	// They recombine into the wire `auth_type` so the backend contract is
	// unchanged.
	const [authScope, setAuthScope] = useState<"shared" | "per_user">("shared");

	const defaultValues = useMemo(() => buildInitialValues(server), [server]);
	const form = useForm<CreateMCPClientRequest>({ defaultValues });
	const { control, handleSubmit, reset, setValue, watch, setError, clearErrors } = form;
	const authType = watch("auth_type") || "none";
	const headers = watch("headers");

	const authHelpText = (type: string): string => {
		switch (type) {
			case "headers":
				return t("installSheet.authHelp.headers");
			case "oauth":
				return t("installSheet.authHelp.oauth");
			case "per_user_oauth":
				return t("installSheet.authHelp.per_user_oauth");
			case "per_user_headers":
				return t("installSheet.authHelp.per_user_headers");
			case "token_exchange":
				return t("installSheet.authHelp.token_exchange");
			default:
				return t("installSheet.authHelp.none");
		}
	};

	const authKind: "none" | "headers" | "oauth" =
		authType === "oauth" || authType === "per_user_oauth"
			? "oauth"
			: authType === "headers" || authType === "per_user_headers"
				? "headers"
				: "none";

	const applyAuthKind = (kind: "none" | "headers" | "oauth") => {
		clearErrors();
		if (kind === "none") {
			setValue("auth_type", "none");
			setValue("headers", undefined);
			setValue("oauth_config", undefined);
			return;
		}
		if (kind === "oauth") {
			setValue("auth_type", authScope === "per_user" ? "per_user_oauth" : "oauth");
			setValue("headers", undefined);
			return;
		}
		setValue("auth_type", authScope === "per_user" ? "per_user_headers" : "headers");
		setValue("oauth_config", undefined);
		setValue("headers", { Authorization: { value: "", ref: "" } });
	};

	const applyAuthScope = (scope: "shared" | "per_user") => {
		setAuthScope(scope);
		if (authKind === "oauth") {
			setValue("auth_type", scope === "per_user" ? "per_user_oauth" : "oauth");
		} else if (authKind === "headers") {
			setValue("auth_type", scope === "per_user" ? "per_user_headers" : "headers");
		}
	};

	// Build initial env vars map from stdio_config.envs
	const initialEnvVars = useMemo(() => {
		if (server.connection_type !== "stdio" || !server.stdio_config?.envs) return {};
		const map: Record<string, string> = {};
		for (const env of server.stdio_config.envs) {
			map[env] = "";
		}
		return map;
	}, [server]);

	useEffect(() => {
		if (!open) return;
		reset(defaultValues);
		setScopesText("");
		setResourceText("");
		setEnvVars(initialEnvVars);
		setOauthFlow(null);
		setHeadersFlow(null);
		setPerUserHeaderKeys([]);
		setNewHeaderKeyInput("");
		setAuthScope("shared");
		setIsLoading(false);
	}, [defaultValues, initialEnvVars, open, reset]);

	const headersValidationError = useMemo(() => {
		if ((authType !== "headers" && authType !== "per_user_headers") || !headers) return null;
		for (const [key, secretVar] of Object.entries(headers)) {
			if (!secretVar.value && !secretVar.ref) {
				return t("installSheet.headerValueRequired", { key });
			}
		}
		return null;
	}, [authType, headers, t]);

	const onSubmit = async (data: CreateMCPClientRequest) => {
		let hasErrors = false;

		if (!data.name.trim()) {
			setError("name", { message: t("installSheet.validation.nameRequired") });
			hasErrors = true;
		} else if (!/^[a-zA-Z0-9_]+$/.test(data.name)) {
			setError("name", {
				message: t("installSheet.validation.nameInvalidFormat"),
			});
			hasErrors = true;
		}

		if (authType === "oauth" || authType === "per_user_oauth") {
			if (data.oauth_config?.authorize_url && !/^https?:\/\/.+$/.test(data.oauth_config.authorize_url)) {
				setError("oauth_config.authorize_url", {
					message: t("installSheet.validation.authorizeUrlInvalid"),
				});
				hasErrors = true;
			}
			if (data.oauth_config?.token_url && !/^https?:\/\/.+$/.test(data.oauth_config.token_url)) {
				setError("oauth_config.token_url", {
					message: t("installSheet.validation.tokenUrlInvalid"),
				});
				hasErrors = true;
			}
			if (data.oauth_config?.registration_url && !/^https?:\/\/.+$/.test(data.oauth_config.registration_url)) {
				setError("oauth_config.registration_url", {
					message: t("installSheet.validation.registrationUrlInvalid"),
				});
				hasErrors = true;
			}
			if (resourceText.trim() && !isValidOAuthResourceURI(resourceText.trim())) {
				toast({
					title: t("installSheet.validation.resourceTitle"),
					description: t("installSheet.validation.resourceDescription"),
					variant: "destructive",
				});
				hasErrors = true;
			}
		}

		if (authType === "per_user_headers") {
			if (perUserHeaderKeys.length === 0) {
				toast({
					title: t("installSheet.validation.headerKeysTitle"),
					description: t("installSheet.validation.headerKeysDescription"),
					variant: "destructive",
				});
				hasErrors = true;
			}
		}

		if (headersValidationError || hasErrors) return;

		const isStdio = server.connection_type === "stdio";
		const connectionUrl = server.connection_url || "";
		const stdioConfig =
			isStdio && server.stdio_config
				? {
						command: server.stdio_config.command,
						args: server.stdio_config.args || [],
						envs: (server.stdio_config.envs || []).map((name) => {
							const val = envVars[name]?.trim();
							return val ? `${name}=${val}` : name;
						}),
					}
				: undefined;
		const payload: CreateMCPClientRequest = {
			...data,
			connection_type: server.connection_type || "http",
			connection_string: isStdio ? undefined : { value: connectionUrl, ref: "" },
			stdio_config: stdioConfig,
			is_code_mode_client: false,
			is_ping_available: true,
			tls_config: !isStdio ? buildTLSConfigPayload(data.tls_config) : undefined,
			oauth_config:
				authType === "oauth" || authType === "per_user_oauth"
					? {
							client_id: data.oauth_config?.client_id ?? emptySecretVar,
							client_secret:
								data.oauth_config?.client_secret?.value?.trim() || data.oauth_config?.client_secret?.ref?.trim()
									? data.oauth_config.client_secret
									: undefined,
							authorize_url: data.oauth_config?.authorize_url || undefined,
							token_url: data.oauth_config?.token_url || undefined,
							registration_url: data.oauth_config?.registration_url || undefined,
							scopes: scopesText.trim() ? parseArrayFromText(scopesText) : undefined,
							server_url: connectionUrl || undefined,
							resource: resourceText.trim() || undefined,
						}
					: undefined,
			headers:
				(authType === "headers" || authType === "per_user_headers") && data.headers && Object.keys(data.headers).length > 0
					? data.headers
					: undefined,
			per_user_header_keys: authType === "per_user_headers" ? perUserHeaderKeys : undefined,
			tools_to_execute: ["*"],
		};

		// Per-user-headers: stash the payload and open the headers test dialog.
		if (authType === "per_user_headers") {
			setHeadersFlow({ payload });
			return;
		}

		try {
			setIsLoading(true);
			const response = await createMCPClient(payload).unwrap();
			setIsLoading(false);

			if (response.status === "pending_oauth" && response.authorize_url) {
				setOauthFlow({
					authorizeUrl: response.authorize_url,
					oauthConfigId: response.oauth_config_id,
					mcpClientId: response.mcp_client_id,
					isPerUserOauth: authType === "per_user_oauth",
				});
				return;
			}

			toast({
				title: t("installSheet.toasts.installedTitle"),
				description: t("installSheet.toasts.installedDescription", { name: server.name }),
			});
			onInstalled();
			onClose();
		} catch (error) {
			setIsLoading(false);
			if ((error as any)?.status === 409) {
				setError("name", { message: getErrorMessage(error) });
				return;
			}
			toast({
				title: t("installSheet.toasts.errorTitle"),
				description: getErrorMessage(error),
				variant: "destructive",
			});
		}
	};

	const iconUrl = server.icon_url || MCP_ICON_FALLBACK;
	const isStdio = server.connection_type === "stdio";
	const isOauth = authType === "oauth" || authType === "per_user_oauth";
	const isPerUserHeaders = authType === "per_user_headers";
	const displayUrl =
		server.connection_url || (server.stdio_config ? `${server.stdio_config.command} ${(server.stdio_config.args || []).join(" ")}` : "—");
	const installButtonLabel = isOauth || isPerUserHeaders ? t("installSheet.continue") : t("installSheet.install");

	return (
		<Sheet open={open} onOpenChange={(sheetOpen) => !sheetOpen && !oauthFlow && !headersFlow && onClose()}>
			<SheetContent className="flex w-full flex-col overflow-x-hidden p-0 pt-4 sm:max-w-2xl">
				<SheetHeader className="flex flex-col items-start px-0 py-4" headerClassName="mb-0 sticky px-8 -top-4 bg-card z-10">
					<SheetTitle>{t("installSheet.title")}</SheetTitle>
					<SheetDescription>{t("installSheet.description")}</SheetDescription>
				</SheetHeader>

				<Form {...form}>
					<form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
						<div className="flex-1 space-y-6 px-8 pt-5 pb-6">
							<section className="border-b pb-5">
								<div className="bg-muted/10 flex items-start gap-3 rounded-sm border p-3">
									<div className="bg-background flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border">
										<img
											src={iconUrl}
											alt=""
											className="h-full w-full object-contain p-1"
											onError={(event) => {
												event.currentTarget.onerror = null;
												event.currentTarget.src = MCP_ICON_FALLBACK;
											}}
										/>
									</div>
									<div className="min-w-0 flex-1 space-y-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">{server.name}</p>
											<p className="text-muted-foreground truncate font-mono text-xs">{displayUrl}</p>
										</div>
										<div className="flex min-w-0 flex-wrap items-center gap-1.5">
											<Badge variant="outline" className="bg-background">
												<TransportIcon connectionType={server.connection_type} />
												{transportLabel(t, server.connection_type)}
											</Badge>
											<Badge variant="outline" className="bg-background">
												<ShieldCheck className="size-3.5" />
												{authLabel(t, server.auth_type)}
											</Badge>
											{server.category && (
												<Badge variant="secondary" className="max-w-full truncate">
													{categoryLabel(t, server.category)}
												</Badge>
											)}
										</div>
									</div>
								</div>
							</section>

							<section className="space-y-4">
								<div className="space-y-1">
									<h3 className="text-sm font-medium">{t("installSheet.clientDetails")}</h3>
									<p className="text-muted-foreground text-sm">{t("installSheet.clientDetailsDescription")}</p>
								</div>

								<FormField
									control={control}
									name="name"
									rules={{
										required: t("installSheet.validation.nameRequired"),
										minLength: {
											value: 3,
											message: t("installSheet.validation.nameMinLength"),
										},
										maxLength: {
											value: 50,
											message: t("installSheet.validation.nameMaxLength"),
										},
										validate: {
											format: (value) => /^[a-zA-Z0-9_]+$/.test(value) || t("installSheet.validation.nameInvalidFormat"),
											noLeadingDigit: (value) => !/^[0-9]/.test(value) || t("installSheet.validation.nameNoLeadingDigit"),
										},
									}}
									render={({ field }) => (
										<FormItem>
											<FormLabel>{t("installSheet.serverName")}</FormLabel>
											<FormControl>
												<Input {...field} data-testid="library-mcp-name-input" maxLength={50} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</section>

							{isStdio && server.stdio_config?.envs && server.stdio_config.envs.length > 0 && (
								<section className="space-y-4 border-t pt-5">
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<h3 className="text-sm font-medium">{t("installSheet.launchEnvironment")}</h3>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Info className="text-muted-foreground h-4 w-4 cursor-help" />
													</TooltipTrigger>
													<TooltipContent className="max-w-xs">
														<p>{t("installSheet.launchEnvironmentTooltip")}</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
										<p className="text-muted-foreground text-sm">{t("installSheet.launchEnvironmentDescription")}</p>
									</div>
									<HeadersTable
										value={envVars}
										onChange={setEnvVars}
										fixedKeys={server.stdio_config.envs}
										keyPlaceholder={t("installSheet.varNamePlaceholder")}
										valuePlaceholder={t("installSheet.varValuePlaceholder")}
										label=""
									/>
								</section>
							)}

							<section className="space-y-4 border-t pt-5">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<KeyRound className="text-muted-foreground size-4" />
										<h3 className="text-sm font-medium">{t("installSheet.authentication")}</h3>
									</div>
									<p className="text-muted-foreground text-sm">{authHelpText(authType)}</p>
								</div>

								{/* Authentication Type */}
								<FormItem className="w-full">
									<FormLabel>{t("installSheet.authType")}</FormLabel>
									<Select value={authKind} onValueChange={(value: "none" | "headers" | "oauth") => applyAuthKind(value)}>
										<FormControl>
											<SelectTrigger className="w-full" data-testid="library-auth-type-select">
												<SelectValue placeholder={t("installSheet.authTypePlaceholder")} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="none" data-testid="library-auth-type-none">
												{t("installSheet.authKindNone")}
											</SelectItem>
											<SelectItem value="headers" data-testid="library-auth-type-headers">
												{t("installSheet.authKindHeaders")}
											</SelectItem>
											<SelectItem value="oauth" data-testid="library-auth-type-oauth">
												{t("installSheet.authKindOauth")}
											</SelectItem>
										</SelectContent>
									</Select>
								</FormItem>

								{/* Auth Scope — only meaningful when there's an auth flow */}
								{authKind !== "none" && (
									<FormItem className="w-full">
										<FormLabel>{t("installSheet.authScope")}</FormLabel>
										<Select value={authScope} onValueChange={(value: "shared" | "per_user") => applyAuthScope(value)}>
											<FormControl>
												<SelectTrigger className="w-full" data-testid="library-auth-scope-select">
													<SelectValue placeholder={t("installSheet.authScopePlaceholder")} />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="shared" data-testid="library-auth-scope-shared">
													{t("installSheet.authScopeShared")}
												</SelectItem>
												<SelectItem value="per_user" data-testid="library-auth-scope-per-user">
													{t("installSheet.authScopePerUser")}
												</SelectItem>
											</SelectContent>
										</Select>
									</FormItem>
								)}

								{authType === "headers" && (
									<FormField
										control={control}
										name="headers"
										render={({ field }) => (
											<FormItem data-testid="library-mcp-headers-table">
												<HeadersTable
													value={field.value || {}}
													onChange={field.onChange}
													keyPlaceholder={t("installSheet.headerNamePlaceholder")}
													valuePlaceholder={t("installSheet.headerValuePlaceholder")}
													label={t("installSheet.headersLabel")}
													useSecretVarInput
												/>
												{headersValidationError && <p className="text-destructive text-xs">{headersValidationError}</p>}
												<FormMessage />
											</FormItem>
										)}
									/>
								)}

								{authType === "per_user_headers" && (
									<div className="space-y-4">
										{/* Required header keys (admin schema). End users supply values
										    per-user on install via the MCPHeadersAuthorizer dialog. */}
										<div className="space-y-1">
											<div className="space-y-0.5">
												<div className="text-sm font-medium">{t("installSheet.requiredHeaders")}</div>
												<p className="text-muted-foreground text-sm">
													<Trans ns="mcpLibrary" i18nKey="installSheet.requiredHeadersDescription" components={{ 1: <code /> }} />
												</p>
											</div>
											<Textarea
												id="library-per-user-header-keys"
												data-testid="library-per-user-header-keys-textarea"
												className="h-24"
												placeholder={t("installSheet.requiredHeadersPlaceholder")}
												value={newHeaderKeyInput}
												onChange={(e) => {
													setNewHeaderKeyInput(e.target.value);
													setPerUserHeaderKeys(parseArrayFromText(e.target.value));
												}}
											/>
										</div>

										{/* Optional static admin headers (e.g. a fixed tenant header) */}
										<FormField
											control={control}
											name="headers"
											render={({ field }) => (
												<FormItem>
													<HeadersTable
														value={field.value || {}}
														onChange={field.onChange}
														keyPlaceholder={t("installSheet.headerNamePlaceholder")}
														valuePlaceholder={t("installSheet.headerValuePlaceholder")}
														label={t("installSheet.staticHeadersLabel")}
														useSecretVarInput
													/>
													{headersValidationError && <p className="text-destructive text-xs">{headersValidationError}</p>}
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
								)}

								{isOauth && (
									<Accordion type="single" collapsible className="w-full">
										<AccordionItem value="oauth-advanced" className="border-b-0">
											<AccordionTrigger className="py-0" data-testid="library-oauth-advanced-trigger">
												<span className="text-sm font-medium">{t("installSheet.oauthAdvanced")}</span>
											</AccordionTrigger>
											<AccordionContent className="space-y-4 pt-4 pb-0">
												<FormField
													control={control}
													name="oauth_config.client_id"
													render={({ field }) => (
														<FormItem>
															<div className="flex items-center gap-2">
																<FormLabel>{t("installSheet.oauthClientId")}</FormLabel>
																<TooltipProvider>
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<Info className="text-muted-foreground h-4 w-4 cursor-help" />
																		</TooltipTrigger>
																		<TooltipContent className="max-w-xs">
																			<p>{t("installSheet.oauthClientIdTooltip")}</p>
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
															</div>
															<FormControl>
																<SecretVarInput
																	value={field.value}
																	onChange={field.onChange}
																	placeholder={t("installSheet.oauthClientIdPlaceholder")}
																	data-testid="library-oauth-client-id"
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												<FormField
													control={control}
													name="oauth_config.client_secret"
													render={({ field }) => (
														<FormItem>
															<FormLabel>{t("installSheet.oauthClientSecret")}</FormLabel>
															<FormControl>
																<SecretVarInput
																	value={field.value}
																	onChange={field.onChange}
																	placeholder={t("installSheet.oauthClientSecretPlaceholder")}
																	hideValueWhenEnv
																	maskNonEnvValue
																	data-testid="library-oauth-client-secret"
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												<div className="grid gap-4 sm:grid-cols-2">
													<FormField
														control={control}
														name="oauth_config.authorize_url"
														render={({ field }) => (
															<FormItem>
																<FormLabel>{t("installSheet.oauthAuthorizeUrl")}</FormLabel>
																<FormControl>
																	<Input
																		{...field}
																		value={field.value ?? ""}
																		onChange={(event) => {
																			field.onChange(event);
																			clearErrors("oauth_config.authorize_url");
																		}}
																		placeholder={t("installSheet.autoDiscoveredPlaceholder")}
																		data-testid="library-oauth-authorize-url"
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>

													<FormField
														control={control}
														name="oauth_config.token_url"
														render={({ field }) => (
															<FormItem>
																<FormLabel>{t("installSheet.oauthTokenUrl")}</FormLabel>
																<FormControl>
																	<Input
																		{...field}
																		value={field.value ?? ""}
																		onChange={(event) => {
																			field.onChange(event);
																			clearErrors("oauth_config.token_url");
																		}}
																		placeholder={t("installSheet.autoDiscoveredPlaceholder")}
																		data-testid="library-oauth-token-url"
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>
												</div>

												<FormField
													control={control}
													name="oauth_config.registration_url"
													render={({ field }) => (
														<FormItem>
															<FormLabel>{t("installSheet.oauthRegistrationUrl")}</FormLabel>
															<FormControl>
																<Input
																	{...field}
																	value={field.value ?? ""}
																	onChange={(event) => {
																		field.onChange(event);
																		clearErrors("oauth_config.registration_url");
																	}}
																	placeholder={t("installSheet.autoDiscoveredPlaceholder")}
																	data-testid="library-oauth-registration-url"
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>

												<div className="space-y-2">
													<Label>{t("installSheet.scopes")}</Label>
													<Input
														value={scopesText}
														onChange={(event) => setScopesText(event.target.value)}
														placeholder={t("installSheet.scopesPlaceholder")}
														data-testid="library-oauth-scopes-input"
													/>
												</div>
												<div className="space-y-2">
													<Label>{t("installSheet.resource")}</Label>
													<Input
														value={resourceText}
														onChange={(event) => setResourceText(event.target.value)}
														placeholder={t("installSheet.resourcePlaceholder")}
														data-testid="library-oauth-resource-input"
													/>
												</div>
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								)}

								{/* TLS / Certificate — only for remote (HTTP/SSE) connections */}
								{!isStdio && (
									<Accordion type="single" collapsible className="w-full">
										<AccordionItem value="tls-config" className="border-b-0">
											<AccordionTrigger className="py-0" data-testid="library-tls-config-trigger">
												<span className="text-sm font-medium">{t("installSheet.tlsSection")}</span>
											</AccordionTrigger>
											<AccordionContent className="space-y-4 pt-4 pb-0">
												<FormField
													control={control}
													name="tls_config.insecure_skip_verify"
													render={({ field }) => (
														<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
															<div className="space-y-0.5">
																<FormLabel>{t("installSheet.skipTlsVerification")}</FormLabel>
																<p className="text-muted-foreground text-sm">{t("installSheet.skipTlsVerificationDescription")}</p>
															</div>
															<FormControl>
																<Switch
																	checked={field.value ?? false}
																	onCheckedChange={field.onChange}
																	data-testid="library-mcp-tls-insecure-skip-verify"
																/>
															</FormControl>
														</FormItem>
													)}
												/>
												<FormField
													control={control}
													name="tls_config.ca_cert_pem"
													render={({ field }) => (
														<FormItem>
															<FormLabel>{t("installSheet.caCertificate")}</FormLabel>
															<FormControl>
																<SecretVarInput
																	variant="textarea"
																	placeholder={t("installSheet.caCertificatePlaceholder")}
																	className="font-mono text-xs"
																	rows={6}
																	hideValueWhenEnv
																	redactNonEnvValue
																	{...field}
																	value={field.value}
																	data-testid="library-mcp-tls-ca-cert-pem"
																/>
															</FormControl>
															<p className="text-muted-foreground text-sm">{t("installSheet.caCertificateDescription")}</p>
															<FormMessage />
														</FormItem>
													)}
												/>
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								)}
							</section>
						</div>

						<div className="border-border bg-card sticky bottom-0 z-10 border-t px-8 py-4">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-muted-foreground text-sm">
									{isOauth
										? t("installSheet.footerOauth")
										: isPerUserHeaders
											? t("installSheet.footerPerUserHeaders")
											: t("installSheet.footerTools")}
								</p>
								<div className="flex justify-end gap-2">
									<Button type="button" variant="outline" onClick={onClose} disabled={isLoading} data-testid="library-install-cancel-btn">
										{t("installSheet.cancel")}
									</Button>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="inline-block">
													<Button
														type="submit"
														disabled={isLoading || !hasCreateMCPClientAccess}
														isLoading={isLoading}
														data-testid="library-install-submit-btn"
													>
														{installButtonLabel}
													</Button>
												</span>
											</TooltipTrigger>
											{!hasCreateMCPClientAccess && (
												<TooltipContent>
													<p>{t("installSheet.noPermissionTooltip")}</p>
												</TooltipContent>
											)}
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
						</div>
					</form>
				</Form>
			</SheetContent>

			{oauthFlow && (
				<OAuth2Authorizer
					open={!!oauthFlow}
					onClose={() => setOauthFlow(null)}
					onSuccess={() => {
						toast({
							title: t("installSheet.toasts.installedTitle"),
							description: t("installSheet.toasts.oauthDescription", { name: server.name }),
						});
						setOauthFlow(null);
						onInstalled();
						onClose();
					}}
					onError={(error) => {
						toast({
							title: t("installSheet.toasts.oauthErrorTitle"),
							description: error,
							variant: "destructive",
						});
					}}
					onConflict={(error) => {
						setOauthFlow(null);
						setError("name", { message: error });
					}}
					authorizeUrl={oauthFlow.authorizeUrl}
					oauthConfigId={oauthFlow.oauthConfigId}
					mcpClientId={oauthFlow.mcpClientId}
					isPerUserOauth={oauthFlow.isPerUserOauth}
				/>
			)}

			{/* Per-user-headers create dialog. Collects sample values inline,
			    then calls POST /api/mcp/client once — the server verifies
			    upstream + discovers tools + persists atomically. */}
			{headersFlow && (
				<MCPHeadersAuthorizer
					open={!!headersFlow}
					onClose={() => setHeadersFlow(null)}
					onSuccess={() => {
						setHeadersFlow(null);
						toast({
							title: t("installSheet.toasts.installedTitle"),
							description: t("installSheet.toasts.perUserHeadersDescription", { name: server.name }),
						});
						onInstalled();
						onClose();
					}}
					onError={() => {
						/* error toast handled by the dialog itself */
					}}
					onConflict={(error) => {
						setHeadersFlow(null);
						setError("name", { message: error });
					}}
					perUserHeaderKeys={perUserHeaderKeys}
					submitHandler={async (values) => {
						await createMCPClient({ ...headersFlow.payload, user_headers: values }).unwrap();
					}}
				/>
			)}
		</Sheet>
	);
}