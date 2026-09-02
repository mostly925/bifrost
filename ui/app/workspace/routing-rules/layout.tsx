import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";
import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useTranslation } from "react-i18next";
import RoutingRulesPage from "./page";

function RouteComponent() {
	const { t } = useTranslation("routingRules");
	const hasRoutingRulesAccess = useRbac(RbacResource.RoutingRules, RbacOperation.View);
	const childMatches = useChildMatches();
	if (!hasRoutingRulesAccess) {
		return <NoPermissionView entity={t("layout.noPermissionEntity")} />;
	}
	return childMatches.length === 0 ? <RoutingRulesPage /> : <Outlet />;
}

export const Route = createFileRoute("/workspace/routing-rules")({
	component: RouteComponent,
});