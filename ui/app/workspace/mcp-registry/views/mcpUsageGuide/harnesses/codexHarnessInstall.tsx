import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildCodexConfig } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { CodexConfigScope, HarnessInstallProps } from "../types";
import { getRegistrationLabel, getUserHomePrefix } from "../utils";

export function CodexHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation("mcpRegistry");
	const [configScope, setConfigScope] = useState<CodexConfigScope>("user");

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildCodexConfig({
			clientConfig,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey,
		});
	}, [clientConfig, selectedServers, serverScope, virtualKey]);

	const configPath = configScope === "project" ? ".codex/config.toml" : `${getUserHomePrefix(platform)}/.codex/config.toml`;

	return (
		<div className="flex flex-col gap-3">
			<HarnessCommandSection
				canCopyCommand={canGenerateCommand}
				command={config}
				controls={
					<Select value={configScope} onValueChange={(value) => setConfigScope(value as CodexConfigScope)}>
						<SelectTrigger className="w-32" data-testid="mcp-usage-guide-codex-config-scope" size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="user">{t("usageGuide.scope.user")}</SelectItem>
							<SelectItem value="project">{t("usageGuide.scope.project")}</SelectItem>
						</SelectContent>
					</Select>
				}
				copySuccessMessage={t("usageGuide.configCopied")}
				emptyMessage={virtualKey ? t("usageGuide.emptyServers") : t("usageGuide.emptyConfig")}
				harnessName="Codex"
				label="config.toml"
				logoSrc="/images/harness/codex.svg"
				registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
			/>
		</div>
	);
}