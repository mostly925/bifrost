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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/codeEditor";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { DottedSeparator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Status, StatusColors, Statuses } from "@/lib/constants/logs";
import { useGetMCPLogByIdQuery } from "@/lib/store";
import type { MCPToolLogEntry } from "@/lib/types/logs";
import { downloadAsJson } from "@/lib/utils/browser-download";
import { applyRedactionMappingToValue, hasRedactionMappingEntries, mergeRedactionMappings } from "@/lib/utils/redaction";
import PluginLogsView from "@/app/workspace/logs/views/pluginLogsView";
import { Link } from "@tanstack/react-router";
import { addMilliseconds, format, isValid } from "date-fns";
import { SheetNavigationButtons } from "@/components/sheetNavigationButtons";
import { useSheetNavigation } from "@/hooks/useSheetNavigation";
import { Download, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface MCPLogDetailSheetProps {
	log: MCPToolLogEntry | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	handleDelete?: (log: MCPToolLogEntry) => Promise<void>;
	canReveal?: boolean;
	onNavigate?: (direction: "prev" | "next") => void;
	hasPrev?: boolean;
	hasNext?: boolean;
}

const LogEntryDetailsView = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
	<div className={className}>
		<div className="text-muted-foreground text-xs">{label}</div>
		<div className="text-sm font-medium">{value}</div>
	</div>
);

const BlockHeader = ({ title, icon }: { title: string; icon?: ReactNode }) => {
	return (
		<div className="flex items-center gap-2">
			{icon}
			<div className="text-sm font-medium">{title}</div>
		</div>
	);
};

// Helper function to validate status and return a safe Status value
const getValidatedStatus = (status: string): Status => {
	// Check if status is a valid Status by checking against Statuses array
	if (Statuses.includes(status as Status)) {
		return status as Status;
	}
	// Fallback to "processing" for unknown statuses
	return "processing";
};

function getPluginLogCount(pluginLogs?: string): number {
	if (!pluginLogs) return 0;
	try {
		const parsed: unknown = JSON.parse(pluginLogs);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return 0;
		return Object.values(parsed).reduce<number>((count, entries) => count + (Array.isArray(entries) ? entries.length : 0), 0);
	} catch {
		return 0;
	}
}

export function MCPLogDetailSheet({
	log,
	open,
	onOpenChange,
	handleDelete,
	canReveal = false,
	onNavigate,
	hasPrev = false,
	hasNext = false,
}: MCPLogDetailSheetProps) {
	const { t } = useTranslation(["mcpLogs", "common"]);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [showRevealedValues, setShowRevealedValues] = useState(false);
	const {
		data: fullLog,
		isLoading,
		isError,
	} = useGetMCPLogByIdQuery(log?.id ?? "", {
		skip: !open || !log?.id,
	});

	// Keyboard navigation: arrow up/down to navigate between logs
	const { prev: prevKeys, next: nextKeys } = useSheetNavigation({
		enabled: open,
		hasPrev,
		hasNext,
		onNavigate: (direction) => onNavigate?.(direction),
	});

	const isFullDataReady = Boolean(log) && (isError || (fullLog?.id === log?.id && !isLoading));
	const displayLog = log ? (isFullDataReady && fullLog ? fullLog : log) : null;
	const revealMapping = displayLog?.redaction_mapping;
	const revealAvailable = canReveal && hasRedactionMappingEntries(revealMapping);
	const revealEnabled = revealAvailable && showRevealedValues;
	const inputRevealMapping = revealEnabled ? revealMapping?.input : undefined;
	const outputRevealMapping = revealEnabled ? revealMapping?.output : undefined;
	const mixedRevealMapping = revealEnabled ? mergeRedactionMappings(revealMapping) : undefined;

	useEffect(() => {
		setShowRevealedValues(false);
	}, [displayLog?.id, revealAvailable]);

	if (!log || !displayLog) return null;

	if (!isFullDataReady) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent className="flex w-full flex-col gap-4 overflow-x-hidden p-8 sm:max-w-[60%]">
					<div className="flex h-full items-center justify-center">
						<SheetTitle className="sr-only">{t("details.loadingTitle")}</SheetTitle>
						<Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
					</div>
				</SheetContent>
			</Sheet>
		);
	}

	const displayedArguments = applyRedactionMappingToValue(displayLog.arguments, inputRevealMapping);
	const displayedResult = applyRedactionMappingToValue(displayLog.result, outputRevealMapping);
	const displayedErrorDetails = applyRedactionMappingToValue(displayLog.error_details, mixedRevealMapping);
	const pluginLogCount = getPluginLogCount(displayLog.plugin_logs);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full flex-col gap-4 overflow-x-hidden p-8 sm:max-w-[60%]">
				<SheetHeader className="flex flex-row items-center px-0">
					<div className="flex w-full items-center justify-between">
						<SheetTitle className="flex w-fit items-center gap-2 font-medium">
							{displayLog.id && <p className="text-md max-w-full truncate">{t("details.requestId", { id: displayLog.id })}</p>}
							<Badge variant="outline" className={`${StatusColors[getValidatedStatus(displayLog.status)]} uppercase`}>
								{displayLog.status}
							</Badge>
						</SheetTitle>
					</div>
					<SheetNavigationButtons
						hasPrev={hasPrev}
						hasNext={hasNext}
						onNavigate={(dir) => onNavigate?.(dir)}
						prevKeys={prevKeys}
						nextKeys={nextKeys}
						entityLabel="log"
					/>
					{revealAvailable && (
						<div className="flex items-center gap-2 whitespace-nowrap">
							<label htmlFor="mcplogdetails-reveal-toggle" className="text-muted-foreground text-[11px] font-medium">
								{t("details.showOriginalValues")}
							</label>
							<Switch
								id="mcplogdetails-reveal-toggle"
								checked={revealEnabled}
								onCheckedChange={(checked) => setShowRevealedValues(checked && revealAvailable)}
								data-testid="mcplogdetails-reveal-toggle"
							/>
						</div>
					)}
					<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
						<DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="size-8" type="button">
									<MoreVertical className="h-3 w-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									data-testid="export-log-json"
									onSelect={(e) => {
										e.preventDefault();
										downloadAsJson(displayLog, `mcp-log-${displayLog.id ?? "export"}.json`);
										setDropdownOpen(false);
									}}
								>
									<Download className="h-4 w-4" />
									{t("details.exportAsJson")}
								</DropdownMenuItem>
								{handleDelete ? (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onSelect={(e) => {
												e.preventDefault();
												setDeleteDialogOpen(true);
												setDropdownOpen(false);
											}}
										>
											<Trash2 className="h-4 w-4" />
											{t("details.deleteLog")}
										</DropdownMenuItem>
									</>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>{t("details.deleteConfirmTitle")}</AlertDialogTitle>
								<AlertDialogDescription>{t("details.deleteConfirmDescription")}</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
								<AlertDialogAction
									onClick={async (e) => {
										e.preventDefault();
										if (!handleDelete) return;
										try {
											await handleDelete(displayLog);
											setDeleteDialogOpen(false);
											onOpenChange(false);
										} catch (err) {
											const errorMessage = err instanceof Error ? err.message : t("details.deleteFailed");
											toast.error(errorMessage);
											// Keep dialog open on error so user can see the error and retry
										}
									}}
								>
									{t("common:actions.delete")}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</SheetHeader>
				<div className="space-y-4 rounded-sm border px-6 py-4">
					<div className="space-y-4">
						<BlockHeader title={t("details.timings")} />
						<div className="grid w-full grid-cols-3 items-center justify-between gap-4">
							<LogEntryDetailsView
								className="w-full"
								label={t("details.startTimestamp")}
								value={
									isValid(new Date(displayLog.timestamp))
										? format(new Date(displayLog.timestamp), "yyyy-MM-dd hh:mm:ss aa")
										: t("details.invalidDate")
								}
							/>
							<LogEntryDetailsView
								className="w-full"
								label={t("details.endTimestamp")}
								value={
									isValid(new Date(displayLog.timestamp))
										? format(addMilliseconds(new Date(displayLog.timestamp), displayLog.latency || 0), "yyyy-MM-dd hh:mm:ss aa")
										: t("details.invalidDate")
								}
							/>
							<LogEntryDetailsView
								className="w-full"
								label={t("details.latency")}
								value={displayLog.latency ? `${displayLog.latency.toFixed(2)}ms` : t("details.na")}
							/>
						</div>
					</div>
					<DottedSeparator />
					<div className="space-y-4">
						<BlockHeader title={t("details.requestDetails")} />
						<div className="grid w-full grid-cols-3 items-start justify-between gap-4">
							<LogEntryDetailsView
								className="col-span-2 w-full"
								label={t("details.toolName")}
								value={
									<Link
										to="/workspace/mcp-logs"
										search={{ tool_names: [displayLog.tool_name] }}
										className="font-mono text-sm text-blue-600 hover:underline dark:text-blue-400"
										data-testid="mcplogdetails-tool-name-link"
									>
										{displayLog.tool_name}
									</Link>
								}
							/>
							<LogEntryDetailsView
								className="w-full"
								label={t("details.server")}
								value={
									displayLog.server_label ? (
										<Link
											to="/workspace/mcp-logs"
											search={{ server_labels: [displayLog.server_label] }}
											data-testid="mcplogdetails-server-link"
										>
											<Badge variant="secondary" className="font-mono hover:underline">
												{displayLog.server_label}
											</Badge>
										</Link>
									) : (
										"-"
									)
								}
							/>
							{displayLog.virtual_key && (
								<LogEntryDetailsView
									className="w-full"
									label={t("details.virtualKey")}
									value={
										<Link
											to="/workspace/governance/virtual-keys"
											search={{ selected_vk: displayLog.virtual_key.id }}
											className="text-blue-600 hover:underline dark:text-blue-400"
											data-testid="mcplogdetails-virtual-key-link"
										>
											{displayLog.virtual_key.name}
										</Link>
									}
								/>
							)}
							{displayLog.llm_request_id && (
								<LogEntryDetailsView
									className="col-span-3 w-full"
									label={t("details.llmRequestId")}
									value={
										<Link
											to="/workspace/logs"
											search={{ selected_log: displayLog.llm_request_id }}
											className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
											data-testid="mcplogdetails-llm-request-id-link"
										>
											{displayLog.llm_request_id}
										</Link>
									}
								/>
							)}
						</div>
					</div>
				</div>

				<Tabs key={displayLog.id} defaultValue="execution" className="gap-2">
					<TabsList className="bg-muted/60 h-10 w-fit">
						<TabsTrigger value="execution" className="px-3">
							{t("details.tabExecution")}
						</TabsTrigger>
						<TabsTrigger value="plugins" className="px-3">
							{t("details.tabPluginLogs")}
							{pluginLogCount > 0 ? (
								<span className="bg-background text-muted-foreground ml-1.5 rounded-sm border px-2 py-0.5 text-[10px] tabular-nums">
									{pluginLogCount}
								</span>
							) : null}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="execution" className="space-y-4">
						{/* Arguments */}
						{displayedArguments && (
							<div className="w-full rounded-sm border">
								<div className="border-b px-6 py-2 text-sm font-medium">{t("details.arguments")}</div>
								<CodeEditor
									className="z-0 w-full"
									shouldAdjustInitialHeight={true}
									maxHeight={250}
									wrap={true}
									code={typeof displayedArguments === "string" ? displayedArguments : JSON.stringify(displayedArguments, null, 2)}
									lang="json"
									readonly={true}
									options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
								/>
							</div>
						)}

						{/* Result */}
						{displayedResult && displayLog.status !== "processing" && (
							<div className="w-full rounded-sm border">
								<div className="border-b px-6 py-2 text-sm font-medium">{t("details.result")}</div>
								<CodeEditor
									className="z-0 w-full"
									shouldAdjustInitialHeight={true}
									maxHeight={350}
									wrap={true}
									code={typeof displayedResult === "string" ? displayedResult : JSON.stringify(displayedResult, null, 2)}
									lang="json"
									readonly={true}
									options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
								/>
							</div>
						)}

						{/* Metadata */}
						{displayLog.metadata && Object.keys(displayLog.metadata).length > 0 && (
							<div className="space-y-4 rounded-sm border px-6 py-4">
								<BlockHeader title={t("details.metadata")} />
								<div className="grid w-full grid-cols-3 items-start justify-between gap-4">
									{Object.entries(displayLog.metadata).map(([key, value]) => (
										<LogEntryDetailsView key={key} className="w-full" label={key} value={String(value)} />
									))}
								</div>
							</div>
						)}

						{/* Error Details */}
						{displayedErrorDetails && (
							<div className="border-destructive/50 w-full rounded-sm border">
								<div className="border-destructive/50 text-destructive border-b px-6 py-2 text-sm font-medium">
									{t("details.errorDetails")}
								</div>
								<CodeEditor
									className="z-0 w-full"
									shouldAdjustInitialHeight={true}
									maxHeight={250}
									wrap={true}
									code={JSON.stringify(displayedErrorDetails, null, 2)}
									lang="json"
									readonly={true}
									options={{ scrollBeyondLastLine: false, collapsibleBlocks: true, lineNumbers: "off", alwaysConsumeMouseWheel: false }}
								/>
							</div>
						)}
					</TabsContent>

					<TabsContent value="plugins" className="space-y-3">
						{displayLog.plugin_logs ? (
							<PluginLogsView pluginLogs={displayLog.plugin_logs} />
						) : (
							<div className="text-muted-foreground rounded-sm border border-dashed p-5 text-center text-sm">
								{t("details.noPluginLogs")}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}