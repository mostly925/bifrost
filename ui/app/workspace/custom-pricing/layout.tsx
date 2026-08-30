import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";
import { NoPermissionView } from "@/components/noPermissionView";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { useTranslation } from "react-i18next";
import CustomPricingPage from "./page";

function CustomPricingLayout({ children }: { children: React.ReactNode }) {
	const { t } = useTranslation("customPricing");
	const hasSettingsAccess = useRbac(RbacResource.Settings, RbacOperation.View);
	if (!hasSettingsAccess) {
		return <NoPermissionView entity={t("noPermissionEntity")} />;
	}
	return <>{children}</>;
}

function RouteComponent() {
	const childMatches = useChildMatches();
	return <CustomPricingLayout>{childMatches.length === 0 ? <CustomPricingPage /> : <Outlet />}</CustomPricingLayout>;
}

export const Route = createFileRoute("/workspace/custom-pricing")({
	component: RouteComponent,
});