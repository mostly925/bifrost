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
import { CopyableId } from "@/components/copyableId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BudgetUsageResetDialog from "@/components/ui/budgetUsageResetDialog";
import { useBudgetUsageResetPrompt } from "@/hooks/useBudgetUsageResetPrompt";
import MultiBudgetLines, { BudgetLineEntry } from "@/components/ui/multibudgets";
import NumberAndSelect from "@/components/ui/numberAndSelect";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { localizedResetDurationOptions, supportsCalendarAlignment } from "@/lib/constants/governance";
import { getErrorMessage, useCreateCustomerMutation, useUpdateCustomerMutation } from "@/lib/store";
import { CreateBudgetRequest, CreateCustomerRequest, Customer, UpdateCustomerRequest } from "@/lib/types/governance";
import { Validator } from "@/lib/utils/validation";
import { RbacOperation, RbacResource, useRbac } from "@enterprise/lib";
import isEqual from "lodash.isequal";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

interface CustomerSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	customer?: Customer | null;
	onSuccess?: () => void;
}

interface CustomerFormData {
	name: string;
	budgets: BudgetLineEntry[];
	tokenMaxLimit: number | undefined;
	tokenResetDuration: string;
	requestMaxLimit: number | undefined;
	requestResetDuration: string;
	calendarAligned: boolean;
	isDirty: boolean;
}

const createInitialState = (customer?: Customer | null): Omit<CustomerFormData, "isDirty"> => {
	return {
		name: customer?.name || "",
		budgets: (customer?.budgets ?? []).map((b) => ({
			id: b.id,
			max_limit: b.max_limit,
			reset_duration: b.reset_duration,
			reset_config: b.reset_config,
		})),
		tokenMaxLimit: customer?.rate_limit?.token_max_limit ?? undefined,
		tokenResetDuration: customer?.rate_limit?.token_reset_duration || "1h",
		requestMaxLimit: customer?.rate_limit?.request_max_limit ?? undefined,
		requestResetDuration: customer?.rate_limit?.request_reset_duration || "1h",
		calendarAligned: customer?.calendar_aligned ?? false,
	};
};

export default function CustomerSheet({ open, onOpenChange, customer, onSuccess }: CustomerSheetProps) {
	const { t } = useTranslation("governance");
	const { t: tCommon } = useTranslation("common");
	const { t: tShared } = useTranslation("shared");
	const isEditing = !!customer;
	const [initialState, setInitialState] = useState<Omit<CustomerFormData, "isDirty">>(createInitialState(customer));
	const [formData, setFormData] = useState<CustomerFormData>({
		...createInitialState(customer),
		isDirty: false,
	});
	const [nameError, setNameError] = useState<string | null>(null);

	const [showCalendarAlignWarning, setShowCalendarAlignWarning] = useState(false);
	// Defers the save until the operator says whether to clear accumulated spend.
	const resetPrompt = useBudgetUsageResetPrompt<boolean>();

	const hasCreateAccess = useRbac(RbacResource.Customers, RbacOperation.Create);
	const hasUpdateAccess = useRbac(RbacResource.Customers, RbacOperation.Update);
	const hasPermission = isEditing ? hasUpdateAccess : hasCreateAccess;

	const [createCustomer, { isLoading: isCreating }] = useCreateCustomerMutation();
	const [updateCustomer, { isLoading: isUpdating }] = useUpdateCustomerMutation();
	const loading = isCreating || isUpdating;

	useEffect(() => {
		if (open) {
			const init = createInitialState(customer);
			setInitialState(init);
			setFormData({ ...init, isDirty: false });
			setNameError(null);
		}
	}, [open, customer]);

	const handleCalendarAlignedChange = (checked: boolean) => {
		if (checked && isEditing && !initialState.calendarAligned) {
			setShowCalendarAlignWarning(true);
		} else {
			updateField("calendarAligned", checked);
		}
	};

	useEffect(() => {
		const currentData = {
			name: formData.name,
			budgets: formData.budgets,
			tokenMaxLimit: formData.tokenMaxLimit,
			tokenResetDuration: formData.tokenResetDuration,
			requestMaxLimit: formData.requestMaxLimit,
			requestResetDuration: formData.requestResetDuration,
			calendarAligned: formData.calendarAligned,
		};
		setFormData((prev) => ({
			...prev,
			isDirty: !isEqual(initialState, currentData),
		}));
	}, [
		formData.name,
		formData.budgets,
		formData.tokenMaxLimit,
		formData.tokenResetDuration,
		formData.requestMaxLimit,
		formData.requestResetDuration,
		formData.calendarAligned,
		initialState,
	]);

	const canCalendarAlign = useMemo(() => {
		const hasAlignableBudget = formData.budgets.some(
			(b) => b.max_limit !== undefined && b.max_limit !== null && supportsCalendarAlignment(b.reset_duration),
		);
		const hasAlignableRateLimit =
			(formData.tokenMaxLimit !== undefined && formData.tokenMaxLimit !== null && supportsCalendarAlignment(formData.tokenResetDuration)) ||
			(formData.requestMaxLimit !== undefined &&
				formData.requestMaxLimit !== null &&
				supportsCalendarAlignment(formData.requestResetDuration));
		return hasAlignableBudget || hasAlignableRateLimit;
	}, [formData.budgets, formData.tokenMaxLimit, formData.tokenResetDuration, formData.requestMaxLimit, formData.requestResetDuration]);

	// Reset calendarAligned when no duration supports alignment,
	// so a hidden toggle doesn't silently submit calendar_aligned: true.
	useEffect(() => {
		if (!formData.calendarAligned) return;
		if (!canCalendarAlign) {
			updateField("calendarAligned", false);
		}
	}, [canCalendarAlign, formData.calendarAligned]);

	const tokenMaxLimitNum = formData.tokenMaxLimit;
	const requestMaxLimitNum = formData.requestMaxLimit;

	const hasDuplicateDuration = useMemo(() => {
		const seen = new Set<string>();
		return formData.budgets
			.filter((b) => b.max_limit !== undefined && b.max_limit !== null)
			.some((b) => {
				if (seen.has(b.reset_duration)) return true;
				seen.add(b.reset_duration);
				return false;
			});
	}, [formData.budgets]);

	const validator = useMemo(
		() =>
			new Validator([
				Validator.required(formData.name.trim(), t("customers.sheet.errors.nameRequired")),
				Validator.custom(formData.isDirty, t("common.noChanges")),
				Validator.custom(!hasDuplicateDuration, t("customers.sheet.errors.budgetUniquePeriods")),
				...(formData.budgets.some((b) => b.max_limit !== undefined && b.max_limit !== null && b.max_limit < 0.01)
					? [Validator.custom(false, t("customers.sheet.errors.budgetMin"))]
					: []),
				...(formData.tokenMaxLimit !== undefined && formData.tokenMaxLimit !== null
					? [
							Validator.minValue(tokenMaxLimitNum ?? 0, 1, t("errors.limits.tokenMin")),
							Validator.required(formData.tokenResetDuration, t("errors.limits.tokenDurationRequired")),
						]
					: []),
				...(formData.requestMaxLimit !== undefined && formData.requestMaxLimit !== null
					? [
							Validator.minValue(requestMaxLimitNum ?? 0, 1, t("errors.limits.requestMin")),
							Validator.required(formData.requestResetDuration, t("errors.limits.requestDurationRequired")),
						]
					: []),
			]),
		[formData, hasDuplicateDuration, tokenMaxLimitNum, requestMaxLimitNum, t],
	);

	const updateField = <K extends keyof CustomerFormData>(field: K, value: CustomerFormData[K]) => {
		if (field === "name") {
			setNameError(null);
		}
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	// A budget config change on an existing customer is when clearing accumulated
	// spend becomes a meaningful choice; creating one has no usage to reset.
	const budgetsChanged = () => {
		if (!isEditing || !customer) return false;
		const signature = (rows: { max_limit?: number | null; reset_duration?: string; reset_config?: { quarter_start_month?: number } }[]) =>
			[...rows]
				.map((r) => `${r.max_limit ?? ""}:${r.reset_duration ?? ""}:${r.reset_config?.quarter_start_month ?? ""}`)
				.sort()
				.join("|");
		const next = formData.budgets.filter((b) => b.max_limit !== undefined && b.max_limit !== null);
		return signature(next) !== signature(customer.budgets ?? []);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validator.isValid()) {
			toast.error(validator.getFirstError());
			return;
		}

		if (budgetsChanged()) {
			resetPrompt.ask(true);
			return;
		}
		await saveCustomer(false);
	};

	const saveCustomer = async (resetBudgetUsage: boolean) => {
		const budgetRequests: CreateBudgetRequest[] = formData.budgets
			.filter((b) => b.max_limit !== undefined && b.max_limit !== null)
			.map((b) => ({ id: b.id, max_limit: b.max_limit!, reset_duration: b.reset_duration, reset_config: b.reset_config }));

		try {
			if (isEditing && customer) {
				const updateData: UpdateCustomerRequest = {
					name: formData.name,
					calendar_aligned: formData.calendarAligned,
					budgets: budgetRequests,
					// Only sent when the operator explicitly chose to clear spend.
					reset_budget_usage: resetBudgetUsage || undefined,
				};

				const hadRateLimit = !!customer.rate_limit;
				const hasRateLimit =
					(tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null) ||
					(requestMaxLimitNum !== undefined && requestMaxLimitNum !== null);
				if (hasRateLimit) {
					updateData.rate_limit = {
						token_max_limit: tokenMaxLimitNum,
						token_reset_duration: tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null ? formData.tokenResetDuration : undefined,
						request_max_limit: requestMaxLimitNum,
						request_reset_duration:
							requestMaxLimitNum !== undefined && requestMaxLimitNum !== null ? formData.requestResetDuration : undefined,
					};
				} else if (hadRateLimit) {
					updateData.rate_limit = {} as UpdateCustomerRequest["rate_limit"];
				}

				await updateCustomer({ customerId: customer.id, data: updateData }).unwrap();
				toast.success(t("customers.toasts.updated"));
			} else {
				const createData: CreateCustomerRequest = {
					name: formData.name,
					calendar_aligned: formData.calendarAligned,
					budgets: budgetRequests,
				};

				if (
					(tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null) ||
					(requestMaxLimitNum !== undefined && requestMaxLimitNum !== null)
				) {
					createData.rate_limit = {
						token_max_limit: tokenMaxLimitNum,
						token_reset_duration: tokenMaxLimitNum !== undefined && tokenMaxLimitNum !== null ? formData.tokenResetDuration : undefined,
						request_max_limit: requestMaxLimitNum,
						request_reset_duration:
							requestMaxLimitNum !== undefined && requestMaxLimitNum !== null ? formData.requestResetDuration : undefined,
					};
				}

				await createCustomer(createData).unwrap();
				toast.success(t("customers.toasts.created"));
			}

			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			if (error?.status === 409) {
				setNameError(getErrorMessage(error));
				return;
			}
			toast.error(getErrorMessage(error));
		}
	};

	const isSubmitDisabled = loading || !validator.isValid() || !hasPermission;

	const getTooltipMessage = () => {
		if (!hasPermission) return t("common.noPermission");
		if (loading) return tCommon("actions.saving");
		return validator.getFirstError() || t("common.fixValidationErrors");
	};

	const showCalendarAlignToggle = canCalendarAlign;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="max-w-[900px] p-0 pt-4 sm:max-w-2xl" data-testid="customer-dialog-content">
				<SheetHeader className="flex flex-col items-start px-0 py-4" headerClassName="mb-0 sticky -top-4 bg-card z-10 px-8">
					<SheetTitle className="flex items-center gap-2">
						{isEditing ? t("customers.sheet.titleEdit") : t("customers.sheet.titleCreate")}
						{customer?.id && <CopyableId id={customer.id} entityLabel="Customer" />}
					</SheetTitle>
					<SheetDescription>{isEditing ? t("customers.sheet.descriptionEdit") : t("customers.sheet.descriptionCreate")}</SheetDescription>
				</SheetHeader>

				<form onSubmit={handleSubmit} className="flex flex-1 flex-col">
					<div className="flex-1 px-8 py-4">
						<div className="space-y-6">
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="name">{t("customers.sheet.nameLabel")}</Label>
									<Input
										id="name"
										data-testid="customer-name-input"
										placeholder={t("customers.sheet.namePlaceholder")}
										value={formData.name}
										maxLength={50}
										onChange={(e) => updateField("name", e.target.value)}
									/>
									{nameError && <p className="text-destructive text-sm">{nameError}</p>}
									<p className="text-muted-foreground text-sm">{t("customers.sheet.nameHint")}</p>
								</div>
							</div>

							<MultiBudgetLines
								data-testid="customer-budgets"
								label={t("customers.sheet.budgetLimits")}
								lines={formData.budgets}
								onChange={(lines) => updateField("budgets", lines)}
							/>

							<NumberAndSelect
								id="tokenMaxLimit"
								label={t("customers.sheet.maximumTokens")}
								value={formData.tokenMaxLimit}
								selectValue={formData.tokenResetDuration}
								onChangeNumber={(value) => updateField("tokenMaxLimit", value)}
								onChangeSelect={(value) => updateField("tokenResetDuration", value)}
								options={localizedResetDurationOptions(tShared)}
							/>

							<NumberAndSelect
								id="requestMaxLimit"
								label={t("customers.sheet.maximumRequests")}
								value={formData.requestMaxLimit}
								selectValue={formData.requestResetDuration}
								onChangeNumber={(value) => updateField("requestMaxLimit", value)}
								onChangeSelect={(value) => updateField("requestResetDuration", value)}
								options={localizedResetDurationOptions(tShared)}
							/>

							{showCalendarAlignToggle && (
								<div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
									<div className="space-y-0.5">
										<Label htmlFor="customer-calendar-aligned-toggle" className="text-sm font-normal">
											{t("calendar.title")}
										</Label>
										<p className="text-muted-foreground text-xs">{t("calendar.description")}</p>
									</div>
									<Switch
										id="customer-calendar-aligned-toggle"
										checked={formData.calendarAligned}
										onCheckedChange={handleCalendarAlignedChange}
										data-testid="customer-calendar-aligned-toggle"
									/>
								</div>
							)}

							<AlertDialog open={showCalendarAlignWarning} onOpenChange={setShowCalendarAlignWarning}>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>{t("calendar.warningTitle")}</AlertDialogTitle>
										<AlertDialogDescription>
											<Trans
												ns="governance"
												i18nKey="calendar.warningDescription"
												values={{ owner: t("customers.owner") }}
												components={{ 1: <span className="font-semibold" />, 3: <span className="font-semibold" /> }}
											/>
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel data-testid="customer-calendar-align-cancel-btn">{tCommon("actions.cancel")}</AlertDialogCancel>
										<AlertDialogAction
											data-testid="customer-calendar-align-enable-btn"
											onClick={() => {
												updateField("calendarAligned", true);
												setShowCalendarAlignWarning(false);
											}}
										>
											{t("calendar.warningConfirm")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
							<BudgetUsageResetDialog
								data-testid="customer-budget-reset-dialog"
								ownerLabel="customer"
								open={resetPrompt.isOpen}
								onOpenChange={resetPrompt.setOpen}
								onChoice={(resetUsage) => resetPrompt.resolve(() => saveCustomer(resetUsage))}
							/>
						</div>
					</div>

					<SheetFooter className="bg-card sticky bottom-0 flex-row justify-end gap-2 border-t px-6 py-4">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
							{tCommon("actions.cancel")}
						</Button>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button type="submit" disabled={isSubmitDisabled}>
											{loading ? tCommon("actions.saving") : isEditing ? t("customers.sheet.saveEdit") : t("customers.sheet.saveCreate")}
										</Button>
									</span>
								</TooltipTrigger>
								{isSubmitDisabled && (
									<TooltipContent>
										<p>{getTooltipMessage()}</p>
									</TooltipContent>
								)}
							</Tooltip>
						</TooltipProvider>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}