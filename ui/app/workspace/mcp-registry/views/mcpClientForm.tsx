import { Button } from "@/components/ui/button";
import { SecretVarInput } from "@/components/ui/secretVarInput";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { HeadersTable } from "@/components/ui/headersTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DottedSeparator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, useCreateMCPClientMutation } from "@/lib/store";
import { CreateMCPClientRequest, SecretVar, MCPAuthType, MCPConnectionType, MCPStdioConfig, MCPTLSConfig } from "@/lib/types/mcp";
import { parseArrayFromText } from "@/lib/utils/array";
import { IS_ENTERPRISE } from "@/lib/constants/config";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useGetSCIMProvidersQuery } from "@enterprise/lib/store/apis/scimApi";
import { Info } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation, Trans } from "react-i18next";
import { MCPHeadersAuthorizer } from "./mcpHeadersAuthorizer";
import { OAuthAdvancedFields } from "./oauthAdvancedFields";
import { OAuth2Authorizer } from "./oauth2Authorizer";
import { SectionHeader } from "./sectionHeader";
import { TLSConfigFields } from "./tlsConfigFields";
import { TokenExchangeFields } from "./tokenExchangeFields";

interface ClientFormProps {
	open: boolean;
	onClose: () => void;
	onSaved: () => void;
}

const emptyStdioConfig: MCPStdioConfig = {
	command: "",
	args: [],
	envs: [],
};

const emptySecretVar: SecretVar = { value: "", ref: "" };

/** Strips empty TLS config so we don't send `{}` to the server. */
function buildTLSConfigPayload(tls: MCPTLSConfig | undefined): MCPTLSConfig | undefined {
	if (!tls) return undefined;
	const hasSkipVerify = tls.insecure_skip_verify === true;
	const hasCACert = tls.ca_cert_pem?.value || tls.ca_cert_pem?.type === "env" || tls.ca_cert_pem?.type === "vault";
	if (!hasSkipVerify && !hasCACert) return undefined;
	return { insecure_skip_verify: tls.insecure_skip_verify, ca_cert_pem: hasCACert ? tls.ca_cert_pem : undefined };
}

const emptyForm: CreateMCPClientRequest = {
	name: "",
	is_code_mode_client: false,
	is_ping_available: true,
	connection_type: "http",
	connection_string: emptySecretVar,
	stdio_config: emptyStdioConfig,
	auth_type: "none",
};

function isValidOAuthResourceURI(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol !== "" && parsed.hash === "";
	} catch {
		return false;
	}
}

const ClientForm: React.FC<ClientFormProps> = ({ open, onClose, onSaved }) => {
	const { t } = useTranslation("mcpRegistry");
	const hasCreateMCPClientAccess = useRbac(RbacResource.MCPGateway, RbacOperation.Create);
	const { toast } = useToast();
	const [createMCPClient] = useCreateMCPClientMutation();

	// Token exchange is backed by the deployment's identity-provider
	// integration, so the option only renders when one is enabled. The exact
	// exchange-client requirement is enforced server-side at create; a missing
	// tokenExchangeClient section surfaces as the create error.
	const { data: scimProviders } = useGetSCIMProvidersQuery(undefined, { skip: !IS_ENTERPRISE });
	const enabledScimProvider = scimProviders?.find((p) => (p as { enabled?: boolean }).enabled) as { name?: string } | undefined;
	const idpConfigured = !!enabledScimProvider;
	// Entra's on-behalf-of grant requires use_idp_credentials — see the
	// Prerequisites warning in docs/mcp/auth/token-exchange.mdx for why a
	// dedicated exchange app structurally can't work there.
	const isEntraIdp = ["entra", "azure", "azuread"].includes((enabledScimProvider?.name ?? "").toLowerCase());

	const [isLoading, setIsLoading] = useState(false);
	const [argsText, setArgsText] = useState("");
	// STDIO env vars as a name→value map. Empty value = pass the bare name so the
	// stdio process reads it from Bifrost's host environment.
	const [envVars, setEnvVars] = useState<Record<string, string>>({});
	const [scopesText, setScopesText] = useState("");
	const [tokenExchangeScopesText, setTokenExchangeScopesText] = useState("");
	const [resourceText, setResourceText] = useState("");
	const [oauthFlow, setOauthFlow] = useState<{
		authorizeUrl: string;
		oauthConfigId: string;
		mcpClientId: string;
		isPerUserOauth?: boolean;
	} | null>(null);

	// Per-user-headers admin flow: admin declares the required key names
	// (perUserHeaderKeys), then on Create the MCPHeadersAuthorizer dialog
	// runs a sample-values verify and returns discovered tools. The form
	// then persists the MCP client with those tools attached — first-time
	// end users skip re-discovery that way. Mirrors the OAuth2Authorizer
	// flow exactly: nothing is persisted until the test succeeds.
	const [perUserHeaderKeys, setPerUserHeaderKeys] = useState<string[]>([]);
	const [newHeaderKeyInput, setNewHeaderKeyInput] = useState("");
	const [headersFlow, setHeadersFlow] = useState<{ payload: CreateMCPClientRequest } | null>(null);

	// UI splits the canonical `auth_type` into two dropdowns:
	//   - authKind: none | headers | oauth | token_exchange
	//   - authScope: shared | per_user (hidden when authKind is none or
	//     token_exchange — exchange is inherently per-caller, with no shared
	//     variant to scope)
	// They recombine into the wire `auth_type` ("oauth", "per_user_oauth",
	// "headers", "per_user_headers", "token_exchange", "none") so the backend
	// contract is unchanged.
	const [authScope, setAuthScope] = useState<"shared" | "per_user">("shared");

	const methods = useForm<CreateMCPClientRequest>({ defaultValues: emptyForm });
	const { control, handleSubmit, setValue, watch, reset, setError, clearErrors } = methods;

	const connectionType = watch("connection_type");
	const authType = watch("auth_type");
	const headers = watch("headers");

	const authKind: "none" | "headers" | "oauth" | "token_exchange" =
		authType === "oauth" || authType === "per_user_oauth"
			? "oauth"
			: authType === "headers" || authType === "per_user_headers"
				? "headers"
				: authType === "token_exchange"
					? "token_exchange"
					: "none";

	const applyAuthKind = (kind: "none" | "headers" | "oauth" | "token_exchange") => {
		if (kind === "none" || kind === "token_exchange") {
			setValue("auth_type", kind);
			return;
		}
		if (kind === "oauth") {
			setValue("auth_type", authScope === "per_user" ? "per_user_oauth" : "oauth");
			return;
		}
		setValue("auth_type", authScope === "per_user" ? "per_user_headers" : "headers");
	};

	const applyAuthScope = (scope: "shared" | "per_user") => {
		setAuthScope(scope);
		if (authKind === "oauth") {
			setValue("auth_type", scope === "per_user" ? "per_user_oauth" : "oauth");
		} else if (authKind === "headers") {
			setValue("auth_type", scope === "per_user" ? "per_user_headers" : "headers");
		}
	};

	// Inline header validation (shown live as user edits headers).
	// Both "headers" and "per_user_headers" auth types persist the static
	// headers map via the submit path (see "headers" property of payload
	// below), so the validation gate must cover both — otherwise an empty
	// static header in the per-user flow slips past client validation and
	// opens MCPHeadersAuthorizer with an invalid config the server has to
	// reject.
	let headersValidationError: string | null = null;
	if ((connectionType === "http" || connectionType === "sse") && (authType === "headers" || authType === "per_user_headers") && headers) {
		for (const [key, secretVar] of Object.entries(headers)) {
			if (!secretVar.value && !secretVar.ref) {
				headersValidationError = t("clientForm.errors.headerValueRequired", { key });
				break;
			}
		}
	}

	// Reset form state when dialog opens
	useEffect(() => {
		if (open) {
			reset(emptyForm);
			setArgsText("");
			setEnvVars({});
			setScopesText("");
			setTokenExchangeScopesText("");
			setResourceText("");
			setOauthFlow(null);
			setHeadersFlow(null);
			setPerUserHeaderKeys([]);
			setNewHeaderKeyInput("");
			setAuthScope("shared");
			setIsLoading(false);
		}
	}, [open, reset]);

	const onSubmit = async (data: CreateMCPClientRequest) => {
		let hasErrors = false;

		if (connectionType === "http" || connectionType === "sse") {
			const connVal = data.connection_string?.value?.trim() || "";
			const connRef = data.connection_string?.ref?.trim() || "";
			const isSecret = data.connection_string?.type === "env" || data.connection_string?.type === "vault";
			if (!connVal && !connRef) {
				setError("connection_string", { message: t("clientForm.errors.connectionUrlRequired") });
				hasErrors = true;
			} else if (!isSecret && connVal && !/^https?:\/\/.+/.test(connVal)) {
				setError("connection_string", {
					message: t("clientForm.errors.connectionUrlFormat"),
				});
				hasErrors = true;
			}
		}

		if (connectionType === "stdio") {
			const cmd = data.stdio_config?.command || "";
			if (!cmd.trim()) {
				setError("stdio_config.command", { message: t("clientForm.errors.commandRequired") });
				hasErrors = true;
			} else if (/[<>|&;]/.test(cmd)) {
				setError("stdio_config.command", { message: t("clientForm.errors.commandSpecialChars") });
				hasErrors = true;
			}
		}

		if (authType === "oauth" || authType === "per_user_oauth") {
			if (data.oauth_config?.authorize_url && !/^https?:\/\/.+$/.test(data.oauth_config.authorize_url)) {
				setError("oauth_config.authorize_url", { message: t("clientForm.errors.authorizeUrlFormat") });
				hasErrors = true;
			}
			if (data.oauth_config?.token_url && !/^https?:\/\/.+$/.test(data.oauth_config.token_url)) {
				setError("oauth_config.token_url", { message: t("clientForm.errors.tokenUrlFormat") });
				hasErrors = true;
			}
			if (data.oauth_config?.registration_url && !/^https?:\/\/.+$/.test(data.oauth_config.registration_url)) {
				setError("oauth_config.registration_url", { message: t("clientForm.errors.registrationUrlFormat") });
				hasErrors = true;
			}
			if (resourceText.trim() && !isValidOAuthResourceURI(resourceText.trim())) {
				toast({
					title: t("clientForm.toasts.invalidResourceTitle"),
					description: t("clientForm.toasts.invalidResourceDescription"),
					variant: "destructive",
				});
				hasErrors = true;
			}
		}

		if (authType === "token_exchange") {
			const audience = data.token_exchange?.audience?.trim() || "";
			if (!audience) {
				setError("token_exchange.audience", { message: t("clientForm.errors.audienceRequired") });
				hasErrors = true;
			}
			if (!data.token_exchange?.use_idp_credentials) {
				const exchangeClientId = data.token_exchange?.client_id;
				if (!exchangeClientId?.value && !exchangeClientId?.ref) {
					setError("token_exchange.client_id", { message: t("clientForm.errors.exchangeClientIdRequired") });
					hasErrors = true;
				}
			}
		}

		if (authType === "per_user_headers") {
			if (perUserHeaderKeys.length === 0) {
				toast({
					title: t("clientForm.toasts.headerKeysRequiredTitle"),
					description: t("clientForm.toasts.headerKeysRequiredDescription"),
					variant: "destructive",
				});
				hasErrors = true;
			}
		}

		if (headersValidationError || hasErrors) return;

		setIsLoading(true);

		const payload: CreateMCPClientRequest = {
			...data,
			stdio_config:
				connectionType === "stdio"
					? {
							command: data.stdio_config?.command || "",
							args: parseArrayFromText(argsText),
							// Each row becomes KEY=value, or a bare KEY when no value is given
							// (read from Bifrost's host environment). Rows without a name are skipped.
							envs: Object.entries(envVars)
								.filter(([name]) => name.trim() !== "")
								.map(([name, value]) => {
									const v = value.trim();
									return v ? `${name}=${v}` : name;
								}),
						}
					: undefined,
			tls_config: connectionType === "http" || connectionType === "sse" ? buildTLSConfigPayload(data.tls_config) : undefined,
			oauth_config:
				authType === "oauth" || authType === "per_user_oauth"
					? {
							client_id: data.oauth_config?.client_id ?? emptySecretVar,
							client_secret:
								data.oauth_config?.client_secret?.value ||
								data.oauth_config?.client_secret?.type === "env" ||
								data.oauth_config?.client_secret?.type === "vault"
									? data.oauth_config.client_secret
									: undefined,
							authorize_url: data.oauth_config?.authorize_url || undefined,
							token_url: data.oauth_config?.token_url || undefined,
							registration_url: data.oauth_config?.registration_url || undefined,
							scopes: scopesText.trim() ? parseArrayFromText(scopesText) : undefined,
							server_url: data.connection_string?.value || undefined,
							resource: resourceText.trim() || undefined,
						}
					: undefined,
			// "headers" and "per_user_headers" both can carry static admin
			// headers on data.headers (per-user values are submitted
			// separately by end users). Persist when present.
			headers:
				(authType === "headers" || authType === "per_user_headers") && data.headers && Object.keys(data.headers).length > 0
					? data.headers
					: undefined,
			per_user_header_keys: authType === "per_user_headers" ? perUserHeaderKeys : undefined,
			token_exchange:
				authType === "token_exchange"
					? {
							audience: data.token_exchange?.audience?.trim() || "",
							use_idp_credentials: data.token_exchange?.use_idp_credentials || undefined,
							client_id: data.token_exchange?.use_idp_credentials ? undefined : (data.token_exchange?.client_id ?? emptySecretVar),
							client_secret: data.token_exchange?.use_idp_credentials
								? undefined
								: data.token_exchange?.client_secret?.value ||
									  data.token_exchange?.client_secret?.type === "env" ||
									  data.token_exchange?.client_secret?.type === "vault"
									? data.token_exchange.client_secret
									: undefined,
							scopes: tokenExchangeScopesText.trim() ? parseArrayFromText(tokenExchangeScopesText) : undefined,
							authorization_server_url: data.token_exchange?.authorization_server_url?.trim() || undefined,
						}
					: undefined,
			tools_to_execute: ["*"],
		};

		// Per-user-headers: stash the payload and open the headers test
		// dialog. The dialog collects sample values and POSTs once to
		// /api/mcp/client where the server verifies, discovers tools,
		// and persists in a single round-trip. Mirrors the per-user
		// OAuth flow's single-call shape.
		if (authType === "per_user_headers") {
			setIsLoading(false);
			setHeadersFlow({ payload });
			return;
		}

		try {
			const response = await createMCPClient(payload).unwrap();

			if (response.status === "pending_oauth" && response.authorize_url) {
				setIsLoading(false);
				setOauthFlow({
					authorizeUrl: response.authorize_url,
					oauthConfigId: response.oauth_config_id,
					mcpClientId: response.mcp_client_id,
					isPerUserOauth: authType === "per_user_oauth",
				});
			} else {
				setIsLoading(false);
				toast({ title: t("common.success"), description: t("clientForm.toasts.created") });
				onSaved();
				onClose();
			}
		} catch (error) {
			setIsLoading(false);
			if ((error as any)?.status === 409) {
				setError("name", { message: getErrorMessage(error) });
				return;
			}
			toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
		}
	};

	return (
		<Sheet open={open} onOpenChange={(open) => !open && !oauthFlow && onClose()}>
			<SheetContent className="flex w-full flex-col gap-4 overflow-x-hidden p-0 pt-4">
				<SheetHeader className="flex flex-col items-start px-0 py-4" headerClassName="mb-0 sticky -top-4 bg-card z-10 px-8">
					<SheetTitle>{t("clientForm.title")}</SheetTitle>
					<SheetDescription>{t("clientForm.description")}</SheetDescription>
				</SheetHeader>

				<Form {...methods}>
					<form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col gap-6">
						<div className="grow space-y-4 px-8">
							{/* Name */}
							<FormField
								control={control}
								name="name"
								rules={{
									required: t("clientForm.name.required"),
									minLength: { value: 3, message: t("clientForm.name.minLength") },
									maxLength: { value: 50, message: t("clientForm.name.maxLength") },
									validate: {
										format: (v) => /^[a-zA-Z0-9_]+$/.test(v) || t("clientForm.name.format"),
										noLeadingDigit: (v) => !/^[0-9]/.test(v) || t("clientForm.name.noLeadingDigit"),
									},
								}}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("clientForm.name.label")}</FormLabel>
										<FormControl>
											<Input
												id="client-name"
												data-testid="client-name-input"
												placeholder={t("clientForm.name.placeholder")}
												maxLength={50}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<DottedSeparator />

							{/* Server Behavior */}
							<div className="space-y-4">
								<SectionHeader
									title={t("clientForm.sections.serverBehavior.title")}
									description={t("clientForm.sections.serverBehavior.description")}
								/>
								<div className="divide-y rounded-md border">
									<FormField
										control={control}
										name="is_code_mode_client"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between gap-4 px-4 py-3">
												<div className="flex items-center gap-2">
													<FormLabel htmlFor="code-mode">{t("clientForm.labels.codeModeServer")}</FormLabel>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<a
																	href="https://docs.getbifrost.ai/mcp/code-mode"
																	target="_blank"
																	rel="noopener noreferrer"
																	data-testid="code-mode-link-help"
																	className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none"
																	aria-label={t("clientForm.labels.codeModeAria")}
																>
																	<Info className="h-4 w-4 cursor-help" />
																</a>
															</TooltipTrigger>
															<TooltipContent>
																<p>{t("clientForm.labels.codeModeTooltip")}</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
												<FormControl>
													<Switch
														id="code-mode"
														data-testid="code-mode-switch"
														checked={field.value || false}
														onCheckedChange={field.onChange}
													/>
												</FormControl>
											</FormItem>
										)}
									/>
									<FormField
										control={control}
										name="is_ping_available"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between gap-4 px-4 py-3">
												<div className="flex items-center gap-2">
													<FormLabel htmlFor="ping-available">{t("clientForm.labels.pingAvailable")}</FormLabel>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Info className="text-muted-foreground h-4 w-4 cursor-help" />
															</TooltipTrigger>
															<TooltipContent className="max-w-xs">
																<p>{t("clientForm.tooltips.ping")}</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
												<FormControl>
													<Switch
														id="ping-available"
														data-testid="mcp-is-ping-available"
														checked={field.value === true}
														onCheckedChange={field.onChange}
													/>
												</FormControl>
											</FormItem>
										)}
									/>
									{connectionType === "http" &&
										authType !== "per_user_oauth" &&
										authType !== "per_user_headers" &&
										authType !== "token_exchange" && (
											<FormField
												control={control}
												name="needs_session_stickiness"
												render={({ field }) => (
													<FormItem className="flex flex-row items-center justify-between gap-4 px-4 py-3">
														<div className="flex items-center gap-2">
															<FormLabel htmlFor="needs-session-stickiness">{t("clientForm.labels.persistentConnection")}</FormLabel>
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Info className="text-muted-foreground h-4 w-4 cursor-help" />
																	</TooltipTrigger>
																	<TooltipContent className="max-w-xs">
																		<p>{t("clientForm.tooltips.persistentConnection")}</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														</div>
														<FormControl>
															<Switch
																id="needs-session-stickiness"
																data-testid="mcp-needs-session-stickiness"
																checked={field.value === true}
																onCheckedChange={field.onChange}
															/>
														</FormControl>
													</FormItem>
												)}
											/>
										)}
								</div>
							</div>

							<DottedSeparator />

							{/* Connection & Authentication */}
							<div className="space-y-4">
								<SectionHeader
									title={t("clientForm.sections.connection.title")}
									description={t("clientForm.sections.connection.description")}
								/>
								<div className="space-y-4 rounded-md border p-4">
									<FormField
										control={control}
										name="connection_type"
										render={({ field }) => (
											<FormItem className="w-full">
												<FormLabel>{t("clientForm.labels.connectionType")}</FormLabel>
												<Select
													value={field.value}
													onValueChange={(value: MCPConnectionType) => {
														field.onChange(value);
														if (value === "stdio") {
															setValue("auth_type", "none");
															setValue("headers", undefined);
															setValue("oauth_config", undefined);
														}
														// needs_session_stickiness=false is rejected for
														// non-http connection types; SSE/STDIO always keep
														// a persistent connection regardless, so drop any
														// explicit false picked while http was selected.
														if (value !== "http") {
															setValue("needs_session_stickiness", undefined);
														}
														clearErrors();
													}}
												>
													<FormControl>
														<SelectTrigger className="w-full" data-testid="connection-type-select">
															<SelectValue placeholder={t("clientForm.selects.connectionTypePlaceholder")} />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="http" data-testid="connection-type-http">
															{t("clientForm.selects.http")}
														</SelectItem>
														<SelectItem value="sse" data-testid="connection-type-sse">
															{t("clientForm.selects.sse")}
														</SelectItem>
														<SelectItem value="stdio" data-testid="connection-type-stdio">
															{t("clientForm.selects.stdio")}
														</SelectItem>
													</SelectContent>
												</Select>
												<p className="text-muted-foreground text-xs">{t("clientForm.notes.connectionLocked")}</p>
												<FormMessage />
											</FormItem>
										)}
									/>

									{(connectionType === "http" || connectionType === "sse") && (
										<>
											{/* Connection URL */}
											<FormField
												control={control}
												name="connection_string"
												render={({ field }) => (
													<FormItem>
														<FormLabel>{t("clientForm.labels.connectionUrl")}</FormLabel>
														<SecretVarInput
															value={field.value}
															onChange={(value) => {
																field.onChange(value);
																clearErrors("connection_string");
															}}
															placeholder="http://your-mcp-server:3000 or env.MCP_SERVER_URL"
															data-testid="connection-url-input"
														/>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Auth Type */}
											<FormItem className="w-full">
												<FormLabel>{t("clientForm.labels.authType")}</FormLabel>
												<Select value={authKind} onValueChange={(value: "none" | "headers" | "oauth") => applyAuthKind(value)}>
													<FormControl>
														<SelectTrigger className="w-full" data-testid="auth-type-select">
															<SelectValue placeholder={t("clientForm.selects.authTypePlaceholder")} />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="none" data-testid="auth-type-none">
															{t("clientForm.selects.none")}
														</SelectItem>
														<SelectItem value="headers" data-testid="auth-type-headers">
															{t("clientForm.selects.headers")}
														</SelectItem>
														<SelectItem value="oauth" data-testid="auth-type-oauth">
															{t("clientForm.selects.oauth")}
														</SelectItem>
														{IS_ENTERPRISE && idpConfigured && (
															<SelectItem value="token_exchange" data-testid="auth-type-token-exchange">
																{t("clientForm.selects.tokenExchange")}
															</SelectItem>
														)}
													</SelectContent>
												</Select>
											</FormItem>

											{/* Auth Scope — only meaningful when there's an auth flow with a
											    shared variant; token exchange is inherently per-caller */}
											{authKind !== "none" && authKind !== "token_exchange" && (
												<FormItem className="w-full">
													<FormLabel>{t("clientForm.labels.authScope")}</FormLabel>
													<Select value={authScope} onValueChange={(value: "shared" | "per_user") => applyAuthScope(value)}>
														<FormControl>
															<SelectTrigger className="w-full" data-testid="auth-scope-select">
																<SelectValue placeholder={t("clientForm.selects.authScopePlaceholder")} />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="shared" data-testid="auth-scope-shared">
																{t("clientForm.selects.shared")}
															</SelectItem>
															<SelectItem value="per_user" data-testid="auth-scope-per-user">
																{t("clientForm.selects.perUser")}
															</SelectItem>
														</SelectContent>
													</Select>
												</FormItem>
											)}
										</>
									)}
								</div>
							</div>

							{(connectionType === "http" || connectionType === "sse") && (
								<>
									{authType === "headers" && (
										<>
											<DottedSeparator />
											<div className="space-y-4">
												<SectionHeader
													title={t("clientForm.sections.headers.title")}
													description={t("clientForm.sections.headers.description")}
												/>
												<FormField
													control={control}
													name="headers"
													render={({ field }) => (
														<FormItem data-testid="mcp-headers-table">
															<HeadersTable
																value={field.value || {}}
																onChange={field.onChange}
																keyPlaceholder={t("clientForm.labels.headerName")}
																valuePlaceholder={t("clientForm.labels.headerValue")}
																label=""
																useSecretVarInput
															/>
															{headersValidationError && <p className="text-destructive text-xs">{headersValidationError}</p>}
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>
										</>
									)}

									{authType === "per_user_headers" && (
										<>
											<DottedSeparator />
											<div className="space-y-4">
												{/* Required header keys (admin schema). Same Textarea +
												    comma-separated pattern as workspace/config security
												    Required Headers, so the two surfaces stay visually
												    consistent. End users supply values per-user at first
												    tool use via the inline auth landing page. */}
												<SectionHeader
													title={t("clientForm.sections.requiredHeaders.title")}
													description={t("clientForm.sections.requiredHeaders.description")}
												/>
												<div className="rounded-md border p-4">
													<Textarea
														id="per-user-header-keys"
														data-testid="per-user-header-keys-textarea"
														className="h-24"
														placeholder="X-API-Key, X-Tenant-ID"
														value={newHeaderKeyInput}
														onChange={(e) => {
															setNewHeaderKeyInput(e.target.value);
															setPerUserHeaderKeys(parseArrayFromText(e.target.value));
														}}
													/>
												</div>
											</div>

											{/* Optional static admin headers (e.g. a fixed tenant header) */}
											<div className="space-y-4">
												<SectionHeader
													title={t("clientForm.sections.staticHeaders.title")}
													description={t("clientForm.sections.staticHeaders.description")}
												/>
												<FormField
													control={control}
													name="headers"
													render={({ field }) => (
														<FormItem>
															<HeadersTable
																value={field.value || {}}
																onChange={field.onChange}
																keyPlaceholder={t("clientForm.labels.headerName")}
																valuePlaceholder={t("clientForm.labels.headerValue")}
																label=""
																useSecretVarInput
															/>
															{headersValidationError && <p className="text-destructive text-xs">{headersValidationError}</p>}
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>

											{/* Sample values are collected in the MCPHeadersAuthorizer
											    dialog that opens on Create — mirrors the OAuth flow
											    where the verification step is also a dialog, not an
											    inline panel. */}
										</>
									)}

									{authType === "token_exchange" && (
										<>
											<DottedSeparator />
											<div className="space-y-4" data-testid="token-exchange-fields">
												<SectionHeader
													title={t("clientForm.sections.tokenExchange.title")}
													description={t("clientForm.sections.tokenExchange.description")}
													testId="token-exchange-heading"
												/>
												<div className="space-y-4 rounded-md border p-4">
													<TokenExchangeFields
														control={control}
														gridClassName="space-y-4"
														audienceLabel={
															<>
																{t("clientForm.tokenExchange.audience")} <span className="text-destructive">*</span>
															</>
														}
														audienceTooltip={
															isEntraIdp
																? t("clientForm.tokenExchange.audienceTooltipEntra")
																: t("clientForm.tokenExchange.audienceTooltipDefault")
														}
														audienceTestId="token-exchange-audience-input"
														onAudienceTouched={() => clearErrors("token_exchange.audience")}
														useIdPCredentialsLabel={t("clientForm.tokenExchange.exchangeApplication")}
														useIdPCredentialsDedicatedDescription={t("clientForm.tokenExchange.dedicatedDescription")}
														useIdPCredentialsIdPDescription={t("clientForm.tokenExchange.idpDescription")}
														useIdPCredentialsRequiredWarning={isEntraIdp && t("clientForm.tokenExchange.entraWarning")}
														onUseIdPCredentialsToggled={(checked) => {
															if (checked) clearErrors(["token_exchange.client_id", "token_exchange.client_secret"]);
														}}
														clientIdLabel={
															<>
																{t("clientForm.tokenExchange.exchangeClientId")} <span className="text-destructive">*</span>
															</>
														}
														clientIdTooltip={t("clientForm.tokenExchange.clientIdTooltip")}
														clientIdPlaceholder={t("clientForm.tokenExchange.clientIdPlaceholder")}
														clientIdTestId="token-exchange-client-id-input"
														onClientIdTouched={() => clearErrors("token_exchange.client_id")}
														clientIdRedactNonEnvValue={false}
														clientSecretLabel={t("clientForm.tokenExchange.exchangeClientSecretOptional")}
														clientSecretPlaceholder={t("clientForm.tokenExchange.clientSecretPlaceholder")}
														clientSecretHelperText={t("clientForm.tokenExchange.clientSecretHelper")}
														clientSecretTestId="token-exchange-client-secret-input"
														clientSecretHideValueWhenEnv={false}
														clientSecretMaskNonEnvValue={true}
														clientSecretRedactNonEnvValue={false}
														authServerUrlLabel={t("clientForm.tokenExchange.authServerUrlOptional")}
														authServerUrlTooltip={t("clientForm.tokenExchange.authServerUrlTooltip")}
														authServerUrlTestId="token-exchange-authorization-server-url-input"
														scopes={{
															variant: "textarea",
															value: tokenExchangeScopesText,
															onChange: setTokenExchangeScopesText,
															label: t("clientForm.tokenExchange.scopesOptional"),
															helperText: (
																<>
																	<Trans ns="mcpRegistry" i18nKey="clientForm.tokenExchange.scopesHelper" components={{ code: <code /> }} />
																	{isEntraIdp && (
																		<>
																			{" "}
																			<Trans
																				ns="mcpRegistry"
																				i18nKey="clientForm.tokenExchange.scopesHelperEntra"
																				components={{ code: <code /> }}
																			/>
																		</>
																	)}
																</>
															),
															testId: "token-exchange-scopes-textarea",
														}}
													/>
												</div>
											</div>
										</>
									)}

									{(authType === "oauth" || authType === "per_user_oauth") && (
										<>
											<DottedSeparator />
											<div className="space-y-4">
												<SectionHeader
													title={t("clientForm.sections.oauth.title")}
													description={t("clientForm.sections.oauth.description")}
													testId="oauth-advanced-heading"
												/>
												<div className="space-y-4 rounded-md border p-4">
													<OAuthAdvancedFields
														control={control}
														scopesRaw={scopesText}
														onScopesRawChange={setScopesText}
														scopesLabel={t("clientForm.oauthFields.scopesOptional")}
														scopesTestId="mcp-oauth-scopes-input"
														resource={{ mode: "raw", value: resourceText, onChange: setResourceText }}
														resourceLabel={t("clientForm.oauthFields.resource")}
														resourceTestId="mcp-oauth-resource-input"
														clientIdLabel={t("clientForm.oauthFields.clientIdOptional")}
														clientIdPlaceholder={t("clientForm.oauthFields.clientIdPlaceholder")}
														clientIdHelperText={t("clientForm.oauthFields.clientIdHelper")}
														clientIdTooltip={t("clientForm.oauthFields.clientIdTooltip")}
														clientIdTestId="mcp-oauth-client-id"
														clientSecretLabel={t("clientForm.oauthFields.clientSecretOptional")}
														clientSecretPlaceholder={t("clientForm.oauthFields.clientSecretPlaceholder")}
														clientSecretHelperText={t("clientForm.oauthFields.clientSecretHelper")}
														clientSecretTestId="mcp-oauth-client-secret"
														authorizeUrlLabel={t("clientForm.oauthFields.authorizeUrlOptional")}
														authorizeUrlTestId="mcp-oauth-authorize-url"
														tokenUrlLabel={t("clientForm.oauthFields.tokenUrlOptional")}
														tokenUrlTestId="mcp-oauth-token-url"
														registrationUrlLabel={t("clientForm.oauthFields.registrationUrlOptional")}
														registrationUrlTestId="mcp-oauth-registration-url"
														onFieldTouched={(field) => clearErrors(`oauth_config.${field}`)}
													/>
												</div>
											</div>
										</>
									)}

									<DottedSeparator />

									{/* TLS / Certificate */}
									<div className="space-y-4">
										<SectionHeader
											title={t("clientForm.sections.tls.title")}
											description={t("clientForm.sections.tls.description")}
											testId="tls-config-heading"
										/>
										<div className="space-y-4 rounded-md border p-4">
											<TLSConfigFields control={control} />
										</div>
									</div>
								</>
							)}

							{connectionType === "stdio" && (
								<>
									<div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
										<div className="flex items-start gap-2">
											<Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
											<div className="flex-1">
												<p className="text-xs font-medium text-amber-900">{t("clientForm.notes.dockerTitle")}</p>
												<p className="mt-0.5 text-xs text-amber-800">{t("clientForm.notes.dockerBody")}</p>
											</div>
										</div>
									</div>

									{/* STDIO Command */}
									<FormField
										control={control}
										name="stdio_config.command"
										render={({ field }) => (
											<FormItem>
												<FormLabel>{t("clientForm.labels.command")}</FormLabel>
												<FormControl>
													<Input
														{...field}
														value={field.value ?? ""}
														onChange={(e) => {
															field.onChange(e);
															clearErrors("stdio_config.command");
														}}
														placeholder="node, python, /path/to/executable"
														data-testid="stdio-command-input"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Args (local state) */}
									<div className="space-y-2">
										<Label htmlFor="stdio-args-input">{t("clientForm.labels.args")}</Label>
										<Input
											id="stdio-args-input"
											value={argsText}
											onChange={(e) => setArgsText(e.target.value)}
											placeholder="--port, 3000, --config, config.json"
											data-testid="stdio-args-input"
										/>
									</div>

									{/* Envs (local state) */}
									<div className="space-y-2" role="group" aria-labelledby="stdio-envs-label">
										<div className="flex items-center gap-2">
											<Label id="stdio-envs-label">{t("clientForm.labels.envVars")}</Label>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Info className="text-muted-foreground h-4 w-4 cursor-help" />
													</TooltipTrigger>
													<TooltipContent className="max-w-xs">
														<p>{t("clientForm.tooltips.envVars")}</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
										<HeadersTable
											value={envVars}
											onChange={setEnvVars}
											keyPlaceholder="API_KEY"
											valuePlaceholder={t("clientForm.envValuePlaceholder")}
											label=""
										/>
									</div>
								</>
							)}
						</div>

						{/* Form Footer */}
						<div className="bg-card sticky bottom-0 z-10 flex justify-end gap-2 border-t px-8 py-4">
							<Button type="button" variant="outline" onClick={onClose} disabled={isLoading} data-testid="cancel-client-btn">
								{t("common.cancel")}
							</Button>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="inline-block">
											<Button
												type="submit"
												disabled={isLoading || !hasCreateMCPClientAccess}
												isLoading={isLoading}
												data-testid="save-client-btn"
											>
												{t("clientForm.labels.create")}
											</Button>
										</span>
									</TooltipTrigger>
									{!hasCreateMCPClientAccess && (
										<TooltipContent>
											<p>{t("common.noPermission")}</p>
										</TooltipContent>
									)}
								</Tooltip>
							</TooltipProvider>
						</div>
					</form>
				</Form>
			</SheetContent>

			{/* OAuth Authorizer Popup */}
			{oauthFlow && (
				<OAuth2Authorizer
					open={!!oauthFlow}
					onClose={() => {
						setOauthFlow(null);
					}}
					onSuccess={() => {
						toast({ title: t("common.success"), description: t("clientForm.toasts.oauthConnected") });
						setOauthFlow(null);
						onClose();
						onSaved();
					}}
					onError={(error) => {
						toast({ title: t("clientForm.toasts.oauthErrorTitle"), description: error, variant: "destructive" });
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
			    upstream + discovers tools + persists atomically. Mirrors
			    the per-user OAuth flow's single-call shape. Nothing is
			    committed if the user cancels or verification fails. */}
			{headersFlow && (
				<MCPHeadersAuthorizer
					open={!!headersFlow}
					onClose={() => {
						setHeadersFlow(null);
					}}
					onSuccess={() => {
						setHeadersFlow(null);
						toast({ title: t("common.success"), description: t("clientForm.toasts.perUserHeadersConnected") });
						onSaved();
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
};

export default ClientForm;