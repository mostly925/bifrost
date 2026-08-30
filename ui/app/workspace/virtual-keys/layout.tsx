import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import VirtualKeysRedirectPage from "./page";

function RouteComponent() {
	const { t } = useTranslation("virtualKeys");
	const hasVirtualKeysAccess = useRbac(RbacResource.VirtualKeys, RbacOperation.View);
	if (!hasVirtualKeysAccess) {
		return <NoPermissionView entity={t("noPermissionEntity")} />;
	}
	return <VirtualKeysRedirectPage />;
}

export const Route = createFileRoute("/workspace/virtual-keys")({
	component: RouteComponent,
});