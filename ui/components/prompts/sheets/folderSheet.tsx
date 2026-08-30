import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/store";
import { useCreateFolderMutation, useUpdateFolderMutation } from "@/lib/store/apis/promptsApi";
import { Folder } from "@/lib/types/prompts";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface FolderFormData {
	name: string;
	description: string;
}

interface FolderSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	folder?: Folder;
	onSaved: () => void;
}

export function FolderSheet({ open, onOpenChange, folder, onSaved }: FolderSheetProps) {
	const { t } = useTranslation("prompts");
	const [createFolder, { isLoading: isCreating }] = useCreateFolderMutation();
	const [updateFolder, { isLoading: isUpdating }] = useUpdateFolderMutation();

	const isLoading = isCreating || isUpdating;
	const isEditing = !!folder;

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FolderFormData>({
		defaultValues: { name: "", description: "" },
	});

	useEffect(() => {
		if (open) {
			reset({
				name: folder?.name ?? "",
				description: folder?.description ?? "",
			});
		}
	}, [open, folder, reset]);

	async function onSubmit(data: FolderFormData) {
		try {
			if (isEditing) {
				await updateFolder({
					id: folder.id,
					data: { name: data.name.trim(), description: data.description.trim() || undefined },
				}).unwrap();
				toast.success(t("toasts.folderUpdated"));
			} else {
				await createFolder({
					name: data.name.trim(),
					description: data.description.trim() || undefined,
				}).unwrap();
				toast.success(t("toasts.folderCreated"));
			}
			onSaved();
			onOpenChange(false);
		} catch (err) {
			toast.error(isEditing ? t("toasts.folderUpdateFailed") : t("toasts.folderCreateFailed"), {
				description: getErrorMessage(err),
			});
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				className="p-8"
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					document.getElementById("name")?.focus();
				}}
			>
				<form onSubmit={handleSubmit(onSubmit)}>
					<SheetHeader className="flex flex-col items-start">
						<SheetTitle>{isEditing ? t("folderSheet.editTitle") : t("folderSheet.createTitle")}</SheetTitle>
						<SheetDescription>{isEditing ? t("folderSheet.editDescription") : t("folderSheet.createDescription")}</SheetDescription>
					</SheetHeader>

					<div className="mt-6 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">{t("folderSheet.nameLabel")}</Label>
							<Input
								id="name"
								data-testid="folder-name-input"
								placeholder={t("folderSheet.namePlaceholder")}
								{...register("name", {
									required: t("folderSheet.nameRequired"),
									validate: (v) => v.trim().length > 0 || t("folderSheet.nameBlank"),
								})}
								autoFocus
							/>
							{errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">{t("folderSheet.descriptionLabel")}</Label>
							<Textarea
								id="description"
								data-testid="folder-description-input"
								placeholder={t("folderSheet.descriptionPlaceholder")}
								className="resize-none"
								{...register("description")}
							/>
						</div>
					</div>

					<SheetFooter className="mt-6 flex flex-row items-center justify-end gap-2 p-0">
						<Button type="button" variant="outline" data-testid="folder-cancel" onClick={() => onOpenChange(false)}>
							{t("folderSheet.cancel")}
						</Button>
						<Button type="submit" data-testid="folder-submit" disabled={isLoading}>
							{isLoading ? t("folderSheet.saving") : isEditing ? t("folderSheet.update") : t("folderSheet.create")}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}