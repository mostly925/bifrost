import AlertingPlaceholderView from "./alertingPlaceholderView";
import { useTranslation } from "react-i18next";

export default function AlertChannelsView() {
	const { t } = useTranslation("enterprise");
	return (
		<AlertingPlaceholderView
			title={t("upsell.alertingChannels.title")}
			description={t("upsell.alertingChannels.description")}
			readmeLink="https://docs.getbifrost.ai/enterprise/alerting/alert-channels"
			testIdPrefix="alert-channels"
		/>
	);
}