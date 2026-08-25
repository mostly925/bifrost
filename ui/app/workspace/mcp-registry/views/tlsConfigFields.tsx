import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SecretVarInput } from "@/components/ui/secretVarInput";
import { Switch } from "@/components/ui/switch";
import type { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface TLSConfigFieldsProps {
	// Loosely typed on purpose: this fragment is shared between the create form
	// (CreateMCPClientRequest) and the edit sheet (MCPClientUpdateSchema), which
	// both carry an identical tls_config.{insecure_skip_verify,ca_cert_pem} shape.
	control: Control<any>;
	disabled?: boolean;
}

/** Skip TLS Verification switch + CA Certificate PEM input, shared by the MCP create form and edit sheet. */
export function TLSConfigFields({ control, disabled }: TLSConfigFieldsProps) {
	const { t } = useTranslation("mcpRegistry");
	return (
		<>
			<FormField
				control={control}
				name="tls_config.insecure_skip_verify"
				render={({ field }) => (
					<FormItem className="flex flex-row items-center justify-between gap-4">
						<div className="space-y-0.5">
							<FormLabel>{t("clients.tls.skipVerifyLabel")}</FormLabel>
							<p className="text-muted-foreground text-sm">{t("clients.tls.skipVerifyDescription")}</p>
						</div>
						<FormControl>
							<Switch
								checked={field.value ?? false}
								onCheckedChange={field.onChange}
								disabled={disabled}
								data-testid="mcp-tls-insecure-skip-verify"
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
						<FormLabel>{t("clients.tls.caCertLabel")}</FormLabel>
						<p className="text-muted-foreground text-xs">{t("clients.tls.caCertDescription")}</p>
						<FormControl>
							<SecretVarInput
								variant="textarea"
								placeholder={t("clients.tls.caCertPlaceholder")}
								className="font-mono text-xs"
								rows={6}
								hideValueWhenEnv
								redactNonEnvValue
								{...field}
								value={field.value}
								disabled={disabled}
								data-testid="mcp-tls-ca-cert-pem"
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</>
	);
}