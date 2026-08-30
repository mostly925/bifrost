// Confirmation dialog for revoking an OAuth grant. Open/confirm are driven by
// the page; the copy explains that the refresh token stops rotating immediately
// while the current short-lived access token keeps working until it expires.

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alertDialog";
import { Trans, useTranslation } from "react-i18next";

interface RevokeGrantDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export default function RevokeGrantDialog({ open, onOpenChange, onConfirm }: RevokeGrantDialogProps) {
	const { t } = useTranslation(["oauthGrants", "common"]);
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("revokeDialog.title")}</AlertDialogTitle>
					<AlertDialogDescription>
						<Trans
							ns="oauthGrants"
							i18nKey="revokeDialog.description"
							components={{
								1: <code className="bg-muted rounded px-1 py-0.5 text-xs" />,
							}}
						/>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel data-testid="oauth-grants-revoke-cancel-btn">{t("common:actions.cancel")}</AlertDialogCancel>
					<AlertDialogAction data-testid="oauth-grants-revoke-confirm-btn" onClick={onConfirm}>
						{t("actions.revoke")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}