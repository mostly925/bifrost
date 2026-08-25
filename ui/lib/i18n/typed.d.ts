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
			skillsRepo: typeof import("./locales/en/skillsRepo.json");
			prompts: typeof import("./locales/en/prompts.json");
		};
	}
}
