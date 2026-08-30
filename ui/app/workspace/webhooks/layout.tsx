import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WebhooksPage from "./page";

function RouteComponent() {
	const { t } = useTranslation("webhooks");
	const hasWebhooksAccess = useRbac(RbacResource.Governance, RbacOperation.View);
	if (!hasWebhooksAccess) {
		return <NoPermissionView entity={t("noPermissionEntity")} />;
	}
	return <WebhooksPage />;
}

export const Route = createFileRoute("/workspace/webhooks")({
	component: RouteComponent,
});