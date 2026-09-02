import { getErrorMessage, useAppSelector, useUpdatePluginMutation } from "@/lib/store";
import { MaximConfigSchema, MaximFormSchema } from "@/lib/types/schemas";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MaximFormFragment } from "../../fragments/maximFormFragment";

interface MaximViewProps {
	onDelete?: () => void;
	isDeleting?: boolean;
}

export default function MaximView({ onDelete, isDeleting }: MaximViewProps) {
	const { t } = useTranslation("observability");
	const selectedPlugin = useAppSelector((state) => state.plugin.selectedPlugin);
	const [updatePlugin] = useUpdatePluginMutation();
	const currentConfig = useMemo(
		() => ({ ...((selectedPlugin?.config as MaximConfigSchema) ?? {}), enabled: selectedPlugin?.enabled }),
		[selectedPlugin],
	);

	const handleMaximConfigSave = (config: MaximFormSchema): Promise<void> => {
		return new Promise((resolve, reject) => {
			updatePlugin({
				name: "maxim",
				data: {
					enabled: config.enabled,
					config: config.maxim_config,
				},
			})
				.unwrap()
				.then(() => {
					toast.success(t("maxim.toast.updated"));
					resolve();
				})
				.catch((err) => {
					toast.error(t("maxim.toast.updateFailed"), {
						description: getErrorMessage(err),
					});
					reject(err);
				});
		});
	};

	return (
		<div className="flex w-full flex-col gap-4">
			<div className="flex w-full flex-col gap-2">
				<div className="text-muted-foreground text-xs font-medium">{t("maxim.view.configuration")}</div>
				<div className="text-muted-foreground mb-2 text-xs font-normal">
					<Trans ns="observability" i18nKey="maxim.view.repoIdHint" components={{ 1: <code /> }} />
				</div>
				<MaximFormFragment onSave={handleMaximConfigSave} initialConfig={currentConfig} onDelete={onDelete} isDeleting={isDeleting} />
			</div>
		</div>
	);
}