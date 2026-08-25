import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ComplexityRouterPage from "./page";

function RouteComponent() {
	const { t } = useTranslation("complexityRouter");
	const hasRoutingRulesAccess = useRbac(RbacResource.RoutingRules, RbacOperation.View);
	if (!hasRoutingRulesAccess) {
		return <NoPermissionView entity={t("noPermissionEntity")} />;
	}
	return <ComplexityRouterPage />;
}

export const Route = createFileRoute("/workspace/complexity-router")({
	component: RouteComponent,
});