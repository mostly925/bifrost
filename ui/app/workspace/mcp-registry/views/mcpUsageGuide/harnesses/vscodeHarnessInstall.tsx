import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildVSCodeConfig, buildVSCodeDeeplink } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { HarnessInstallProps, VSCodeConfigScope } from "../types";
import { getRegistrationLabel } from "../utils";

export function VSCodeHarnessInstall({
	canGenerateCommand,
	clientConfig,
	platform,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation("mcpRegistry");
	const [configScope, setConfigScope] = useState<VSCodeConfigScope>("workspace");

	const serverArgs = useMemo(
		() => ({
			clientConfig,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey: virtualKey!,
		}),
		[clientConfig, selectedServers, serverScope, virtualKey],
	);

	const config = useMemo(() => {
		if (!virtualKey) return "";
		return buildVSCodeConfig(serverArgs);
	}, [serverArgs, virtualKey]);

	const deeplink = useMemo(() => {
		if (!virtualKey) return "";
		return buildVSCodeDeeplink(serverArgs);
	}, [serverArgs, virtualKey]);

	const userConfigPath = {
		linux: "~/.config/Code/User/mcp.json",
		macos: "~/Library/Application Support/Code/User/mcp.json",
		windows: "%APPDATA%/Code/User/mcp.json",
	}[platform];
	const configPath = configScope === "workspace" ? ".vscode/mcp.json" : userConfigPath;

	return (
		<HarnessCommandSection
			canCopyCommand={canGenerateCommand}
			command={config}
			controls={
				<Select value={configScope} onValueChange={(value) => setConfigScope(value as VSCodeConfigScope)}>
					<SelectTrigger className="w-32" data-testid="mcp-usage-guide-vscode-config-scope" size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="workspace">{t("usageGuide.scope.workspace")}</SelectItem>
						<SelectItem value="user">{t("usageGuide.scope.user")}</SelectItem>
					</SelectContent>
				</Select>
			}
			copySuccessMessage={t("usageGuide.configCopied")}
			deeplink={deeplink}
			emptyMessage={virtualKey ? t("usageGuide.emptyServers") : t("usageGuide.emptyConfig")}
			harnessName="VS Code"
			label={t("usageGuide.config")}
			logoSrc="/images/harness/vscode.svg"
			registrationLabel={`${configPath} · ${getRegistrationLabel(serverScope, selectedServers, t)}`}
		/>
	);
}