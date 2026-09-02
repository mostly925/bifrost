import "i18next";

// i18next 类型推导：key 写错时编译期报错。
// 迁移新页面时，把该页面的 en 语言包加到 resources 映射中（只用 en 推导，
// zh 包结构必须与 en 对齐，缺失 key 运行时回退到 en）。
declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: "common";
		fallbackLng: "en";
		resources: {
			common: typeof import("./locales/en/common.json");
			components: typeof import("./locales/en/components.json");
			complexityRouter: typeof import("./locales/en/complexityRouter.json");
			config: typeof import("./locales/en/config.json");
			customPricing: typeof import("./locales/en/customPricing.json");
			dashboard: typeof import("./locales/en/dashboard.json");
			devProfiler: typeof import("./locales/en/devProfiler.json");
			docs: typeof import("./locales/en/docs.json");
			enterprise: typeof import("./locales/en/enterprise.json");
			filters: typeof import("./locales/en/filters.json");
			governance: typeof import("./locales/en/governance.json");
			logs: typeof import("./locales/en/logs.json");
			mcpLibrary: typeof import("./locales/en/mcpLibrary.json");
			mcpLogs: typeof import("./locales/en/mcpLogs.json");
			mcpSessions: typeof import("./locales/en/mcpSessions.json");
			mcpRegistry: typeof import("./locales/en/mcpRegistry.json");
			modelLimits: typeof import("./locales/en/modelLimits.json");
			modelCatalog: typeof import("./locales/en/modelCatalog.json");
			modelMarketplace: typeof import("./locales/en/modelMarketplace.json");
			oauth: typeof import("./locales/en/oauth.json");
			oauthGrants: typeof import("./locales/en/oauthGrants.json");
			observability: typeof import("./locales/en/observability.json");
			plugins: typeof import("./locales/en/plugins.json");
			pprof: typeof import("./locales/en/pprof.json");
			prompts: typeof import("./locales/en/prompts.json");
			providers: typeof import("./locales/en/providers.json");
			routingRules: typeof import("./locales/en/routingRules.json");
			shared: typeof import("./locales/en/shared.json");
			skillsRepo: typeof import("./locales/en/skillsRepo.json");
			virtualKeys: typeof import("./locales/en/virtualKeys.json");
			webhooks: typeof import("./locales/en/webhooks.json");
		};
	}
}