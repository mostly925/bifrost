import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
} from "@/components/ui/alertDialog";
import { getErrorMessage, useDeleteProviderMutation } from "@/lib/store";
import { ModelProvider } from "@/lib/types/config";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { AlertDialogTitle } from "@radix-ui/react-alert-dialog";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Props {
	show: boolean;
	onCancel: () => void;
	onDelete: () => void;
	provider: ModelProvider;
}

export default function ConfirmDeleteProviderDialog({ show, onCancel, onDelete, provider }: Props) {
	const { t } = useTranslation("providers");
	const [deleteProvider, { isLoading: isDeletingProvider }] = useDeleteProviderMutation();
	const hasDeleteAccess = useRbac(RbacResource.ModelProvider, RbacOperation.Delete);

	const onDeleteHandler = () => {
		deleteProvider(provider.name)
			.unwrap()
			.then(() => {
				onDelete();
			})
			.catch((err) => {
				toast.error(t("dialogs.deleteProvider.toasts.deleteFailed"), {
					description: getErrorMessage(err),
				});
			});
	};

	return (
		<AlertDialog open={show}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("dialogs.deleteProvider.title")}</AlertDialogTitle>
					<AlertDialogDescription>{t("dialogs.deleteProvider.description")}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={onCancel}>{t("common.cancel")}</AlertDialogCancel>
					<AlertDialogAction onClick={onDeleteHandler} disabled={isDeletingProvider || !hasDeleteAccess}>
						{isDeletingProvider ? t("dialogs.deleteProvider.deleting") : t("common.delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}