import { cn } from "@/lib/utils";
import { ShieldX } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NoPermissionViewProps {
	entity: string;
	className?: string;
	align?: "middle" | "top";
}

// 调用方传入的 entity 为英文展示文案；翻译时映射到语言包中的实体名，未收录时原样回退。
const ENTITY_LABEL_KEYS: Record<string, string> = {
	"MCP gateway settings": "mcpGatewaySettings",
	"MCP tool groups": "mcpToolGroups",
	"access-profiles": "accessProfiles",
	"adaptive routing": "adaptiveRouting",
	alerting: "alerting",
	"audit logs": "auditLogs",
	"circuit breaker": "circuitBreaker",
	"cluster configuration": "clusterConfiguration",
	configuration: "configuration",
	dashboard: "dashboard",
	"edge devices": "edgeDevices",
	"edge inventory": "edgeInventory",
	"edge settings": "edgeSettings",
	governance: "governance",
	"guardrails configuration": "guardrailsConfiguration",
	logs: "logs",
	"model providers": "modelProviders",
	"roles and permissions": "rolesPermissions",
	"skills repository": "skillsRepository",
	"user provisioning": "userProvisioning",
};

export function NoPermissionView({ entity, className, align = "middle" }: NoPermissionViewProps) {
	const { t } = useTranslation("common");
	const entityLabel = t(`noPermission.entities.${ENTITY_LABEL_KEYS[entity] ?? ""}`, { defaultValue: entity });
	return (
		<div
			className={cn(
				"flex min-h-[calc(100vh-200px)] flex-col items-center  gap-4 text-center",
				align === "middle" ? "justify-center" : "justify-start",
				className,
			)}
		>
			<div className="text-muted-foreground">
				<ShieldX className="h-16 w-16" strokeWidth={1} />
			</div>
			<div className="flex flex-col items-center gap-1">
				<h1 className="text-muted-foreground text-xl font-medium">{t("noPermission.title", { entity: entityLabel })}</h1>
				<p className="text-muted-foreground mt-2 max-w-[400px] text-sm font-normal">{t("noPermission.description")}</p>
			</div>
		</div>
	);
}