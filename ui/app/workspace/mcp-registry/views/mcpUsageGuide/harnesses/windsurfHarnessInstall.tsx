import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildWindsurfConfig } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { HarnessInstallProps } from "../types";
import { getRegistrationLabel, getUserHomePrefix } from "../utils";

export function WindsurfHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation("mcpRegistry");
	const configPath = `${getUserHomePrefix(platform)}/.codeium/windsurf/mcp_config.json`;

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildWindsurfConfig({
			clientConfig,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey,
		});
	}, [clientConfig, selectedServers, serverScope, virtualKey]);

	return (
		<HarnessCommandSection
			canCopyCommand={canGenerateCommand}
			command={config}
			controls={null}
			copySuccessMessage={t("usageGuide.configCopied")}
			emptyMessage={virtualKey ? t("usageGuide.emptyServers") : t("usageGuide.emptyConfig")}
			harnessName="Windsurf (Devin)"
			label={t("usageGuide.config")}
			logoSrc="/images/harness/windsurf.svg"
			registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
		/>
	);
}