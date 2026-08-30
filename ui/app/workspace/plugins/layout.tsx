import { createFileRoute } from "@tanstack/react-router";
import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useTranslation } from "react-i18next";
import PluginsPage from "./page";

function RouteComponent() {
	const { t } = useTranslation("plugins");
	const hasPluginsAccess = useRbac(RbacResource.Plugins, RbacOperation.View);
	if (!hasPluginsAccess) {
		return <NoPermissionView entity={t("noPermissionEntity")} />;
	}
	return <PluginsPage />;
}

export const Route = createFileRoute("/workspace/plugins")({
	component: RouteComponent,
});