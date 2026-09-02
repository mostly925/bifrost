import AlertingPlaceholderView from "./alertingPlaceholderView";
import { useTranslation } from "react-i18next";

export default function AlertHistoryView() {
	const { t } = useTranslation("enterprise");
	return (
		<AlertingPlaceholderView
			title={t("upsell.alertingHistory.title")}
			description={t("upsell.alertingHistory.description")}
			readmeLink="https://docs.getbifrost.ai/enterprise/alerting/alert-history"
			testIdPrefix="alert-history"
		/>
	);
}