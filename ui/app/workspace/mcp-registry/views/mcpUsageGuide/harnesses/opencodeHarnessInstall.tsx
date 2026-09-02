import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildOpenCodeConfig } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { HarnessInstallProps } from "../types";
import { getRegistrationLabel } from "../utils";

export function OpenCodeHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation("mcpRegistry");
	const configPath = {
		linux: "~/.config/opencode/opencode.json",
		macos: "~/.config/opencode/opencode.json",
		windows: "%APPDATA%/opencode/opencode.json",
	}[platform];

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildOpenCodeConfig({
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
			harnessName="OpenCode"
			label={t("usageGuide.config")}
			logoSrc="/images/harness/opencode.svg"
			registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
		/>
	);
}