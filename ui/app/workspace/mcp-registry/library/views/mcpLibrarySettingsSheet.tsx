import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getErrorMessage, useForceSyncMCPLibraryMutation, useGetCoreConfigQuery, useUpdateCoreConfigMutation } from "@/lib/store";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import { zodResolver } from "@hookform/resolvers/zod";
import type { TFunction } from "i18next";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

interface MCPLibrarySettingsFormData {
	mcp_library_url: string;
	mcp_library_sync_interval_hours: number;
}

// Built with t at render time so validation messages follow the UI language.
function createMCPLibrarySettingsSchema(t: TFunction<"mcpLibrary">) {
	return z.object({
		mcp_library_url: z
			.string()
			.trim()
			.refine(
				(value) => value === "" || value.startsWith("http://") || value.startsWith("https://"),
				t("settingsSheet.validation.urlInvalid"),
			),
		mcp_library_sync_interval_hours: z
			.number({ message: t("settingsSheet.validation.intervalRequired") })
			.min(1, t("settingsSheet.validation.intervalMin"))
			.max(8760, t("settingsSheet.validation.intervalMax")),
	});
}

interface MCPLibrarySettingsSheetProps {
	open: boolean;
	onClose: () => void;
}

export function MCPLibrarySettingsSheet({ open, onClose }: MCPLibrarySettingsSheetProps) {
	const { t } = useTranslation("mcpLibrary");
	const hasSettingsUpdateAccess = useRbac(RbacResource.Settings, RbacOperation.Update);
	const { data: bifrostConfig, isLoading: isConfigLoading, isError: isConfigError } = useGetCoreConfigQuery({ fromDB: true });
	const config = bifrostConfig?.framework_config;
	const [updateCoreConfig, { isLoading }] = useUpdateCoreConfigMutation();
	const [forceSyncMCPLibrary, { isLoading: isForceSyncing }] = useForceSyncMCPLibraryMutation();

	// Rebuild the schema when the language changes so validation messages stay localized.
	const mcpLibrarySettingsSchema = useMemo(() => createMCPLibrarySettingsSchema(t), [t]);
	const resolver = useMemo(() => zodResolver(mcpLibrarySettingsSchema), [mcpLibrarySettingsSchema]);

	const {
		register,
		handleSubmit,
		formState: { errors, isDirty },
		reset,
		watch,
	} = useForm<MCPLibrarySettingsFormData>({
		resolver,
		defaultValues: {
			mcp_library_url: "",
			mcp_library_sync_interval_hours: 24,
		},
	});

	const formValues = watch();

	useEffect(() => {
		if (!open || !config) return;
		reset({
			mcp_library_url: config.mcp_library_url || "",
			mcp_library_sync_interval_hours: Math.round((config.mcp_library_sync_interval || 86400) / 3600),
		});
	}, [config, open, reset]);

	const hasChanges = useMemo(() => {
		if (!config || !isDirty) return false;
		const serverUrl = config.mcp_library_url || "";
		const serverInterval = Math.round((config.mcp_library_sync_interval || 86400) / 3600);
		return formValues.mcp_library_url !== serverUrl || formValues.mcp_library_sync_interval_hours !== serverInterval;
	}, [config, formValues, isDirty]);

	const onSubmit = async (data: MCPLibrarySettingsFormData) => {
		if (!bifrostConfig) {
			toast.error(t("settingsSheet.toasts.loadFailed"));
			return;
		}
		try {
			await updateCoreConfig({
				...bifrostConfig,
				framework_config: {
					...bifrostConfig.framework_config,
					mcp_library_url: data.mcp_library_url,
					mcp_library_sync_interval: data.mcp_library_sync_interval_hours * 3600,
				},
			}).unwrap();
			toast.success(t("settingsSheet.toasts.updated"));
			reset(data);
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	};

	const handleForceSync = async () => {
		try {
			await forceSyncMCPLibrary().unwrap();
			toast.success(t("settingsSheet.toasts.synced"));
		} catch (error) {
			toast.error(getErrorMessage(error));
		}
	};

	return (
		<Sheet open={open} onOpenChange={(sheetOpen) => !sheetOpen && onClose()}>
			<SheetContent className="flex w-full flex-col overflow-x-hidden px-0">
				<SheetHeader className="flex flex-col items-start px-7 pt-8">
					<SheetTitle>{t("settingsSheet.title")}</SheetTitle>
					<SheetDescription>{t("settingsSheet.description")}</SheetDescription>
				</SheetHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
					<div className="flex-1 space-y-4 overflow-y-auto px-8">
						<div className="space-y-2 rounded-sm border p-4">
							<div className="space-y-0.5">
								<Label htmlFor="mcp-library-url">{t("settingsSheet.syncUrl")}</Label>
								<p className="text-muted-foreground text-sm">{t("settingsSheet.syncUrlDescription")}</p>
							</div>
							<Input
								id="mcp-library-url"
								type="text"
								placeholder={t("settingsSheet.syncUrlPlaceholder")}
								data-testid="mcp-library-url-input"
								{...register("mcp_library_url")}
								className={errors.mcp_library_url ? "border-destructive" : ""}
							/>
							{errors.mcp_library_url && <p className="text-destructive text-sm">{errors.mcp_library_url.message}</p>}
						</div>

						<div className="space-y-2 rounded-sm border p-4">
							<div className="space-y-0.5">
								<Label htmlFor="mcp-library-sync-interval">{t("settingsSheet.syncInterval")}</Label>
								<p className="text-muted-foreground text-sm">{t("settingsSheet.syncIntervalDescription")}</p>
							</div>
							<Input
								id="mcp-library-sync-interval"
								type="number"
								data-testid="mcp-library-sync-interval-input"
								className={errors.mcp_library_sync_interval_hours ? "border-destructive" : ""}
								{...register("mcp_library_sync_interval_hours", { valueAsNumber: true })}
							/>
							{errors.mcp_library_sync_interval_hours && (
								<p className="text-destructive text-sm">{errors.mcp_library_sync_interval_hours.message}</p>
							)}
						</div>
					</div>

					<div className="dark:bg-card border-border border-t bg-white px-8 py-4">
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								type="button"
								onClick={handleForceSync}
								disabled={isForceSyncing || !hasSettingsUpdateAccess}
								data-testid="mcp-library-force-sync-btn"
							>
								{isForceSyncing ? t("settingsSheet.syncing") : t("settingsSheet.forceSync")}
							</Button>
							<Button type="button" variant="outline" onClick={onClose} disabled={isLoading} data-testid="mcp-library-settings-cancel-btn">
								{t("settingsSheet.cancel")}
							</Button>
							<Button
								type="submit"
								disabled={!hasChanges || isLoading || isConfigLoading || isConfigError || !hasSettingsUpdateAccess}
								data-testid="mcp-library-settings-save-btn"
							>
								{isLoading ? t("settingsSheet.saving") : t("settingsSheet.save")}
							</Button>
						</div>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
}