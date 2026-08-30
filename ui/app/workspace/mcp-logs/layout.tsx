import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import MCPLogsPage from "./page";

function RouteComponent() {
	const { t } = useTranslation("mcpLogs");
	const hasViewMCPLogsAccess = useRbac(RbacResource.MCPLogs, RbacOperation.View);
	if (!hasViewMCPLogsAccess) {
		return <NoPermissionView entity={t("noPermissionEntity")} />;
	}
	return <MCPLogsPage />;
}

export const Route = createFileRoute("/workspace/mcp-logs")({
	component: RouteComponent,
});