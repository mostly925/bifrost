import { createFileRoute } from "@tanstack/react-router";
import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useTranslation } from "react-i18next";
import ObservabilityPage from "./page";

function RouteComponent() {
	const { t } = useTranslation("observability");
	const hasObservabilityAccess = useRbac(RbacResource.Observability, RbacOperation.View);
	if (!hasObservabilityAccess) {
		return <NoPermissionView entity={t("layout.noPermissionEntity")} />;
	}
	return <ObservabilityPage />;
}

export const Route = createFileRoute("/workspace/observability")({
	component: RouteComponent,
});