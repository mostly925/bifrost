import AlertingPlaceholderView from "./alertingPlaceholderView";
import { useTranslation } from "react-i18next";

export default function AlertRulesView() {
	const { t } = useTranslation("enterprise");
	return (
		<AlertingPlaceholderView
			title={t("upsell.alertingRules.title")}
			description={t("upsell.alertingRules.description")}
			readmeLink="https://docs.getbifrost.ai/enterprise/alerting/alert-rules"
			testIdPrefix="alert-rules"
		/>
	);
}