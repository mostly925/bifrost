import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildClaudeCodeCommand } from "../commandBuilders";
import { HarnessCommandSection } from "../harnessCommandSection";
import type { ClaudeScope, HarnessInstallProps } from "../types";
import { getRegistrationLabel } from "../utils";

export function ClaudeCodeHarnessInstall({
	canGenerateCommand,
	clientConfig,
	selectedServers,
	serverScope,
	virtualKey,
}: HarnessInstallProps) {
	const { t } = useTranslation("mcpRegistry");
	const [scope, setScope] = useState<ClaudeScope>("local");

	const command = useMemo(() => {
		if (!virtualKey) return "";
		return buildClaudeCodeCommand({
			clientConfig,
			scope,
			selectedServers: serverScope === "selected" ? selectedServers : undefined,
			virtualKey,
		});
	}, [clientConfig, scope, selectedServers, serverScope, virtualKey]);

	return (
		<HarnessCommandSection
			canCopyCommand={canGenerateCommand}
			command={command}
			controls={
				<Select value={scope} onValueChange={(value) => setScope(value as ClaudeScope)}>
					<SelectTrigger className="w-32" data-testid="mcp-usage-guide-claude-scope" size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="local">{t("usageGuide.scope.local")}</SelectItem>
						<SelectItem value="project">{t("usageGuide.scope.project")}</SelectItem>
						<SelectItem value="user">{t("usageGuide.scope.user")}</SelectItem>
					</SelectContent>
				</Select>
			}
			emptyMessage={virtualKey ? t("usageGuide.emptyServers") : t("usageGuide.emptyCommand")}
			harnessName="Claude Code"
			logoSrc="/images/harness/claudecode.svg"
			registrationLabel={getRegistrationLabel(serverScope, selectedServers, t)}
		/>
	);
}