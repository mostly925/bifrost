import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import zhCommon from "./locales/zh/common.json";

export const SUPPORTED_LANGUAGES = ["en", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = "bifrost.language";

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
	return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function readCookie(name: string): string | undefined {
	if (typeof document === "undefined") return undefined;
	return document.cookie
		.split("; ")
		.find((row) => row.startsWith(`${name}=`))
		?.split("=")[1];
}

/** 读取用户显式选择的语言（cookie 优先，其次 localStorage），未选择时返回 null。 */
export function getStoredLanguage(): SupportedLanguage | null {
	const fromCookie = readCookie(LANGUAGE_STORAGE_KEY);
	if (isSupportedLanguage(fromCookie)) return fromCookie;
	try {
		const fromStorage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		if (isSupportedLanguage(fromStorage)) return fromStorage;
	} catch {
		// localStorage 不可用（隐私模式等）时仅依赖 cookie
	}
	return null;
}

/** 语言解析顺序：用户显式选择 → 浏览器语言 → 兜底 en。 */
export function resolveInitialLanguage(): SupportedLanguage {
	const stored = getStoredLanguage();
	if (stored) return stored;
	if (typeof navigator !== "undefined") {
		const browserBase = navigator.language?.toLowerCase().split("-")[0];
		if (isSupportedLanguage(browserBase)) return browserBase;
	}
	return "en";
}

/** 持久化语言偏好：localStorage 与 cookie 双写，便于将来服务端读取。 */
export function persistLanguage(language: SupportedLanguage): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
	} catch {
		// localStorage 不可用时偏好仅存于 cookie
	}
	if (typeof document !== "undefined") {
		document.cookie = `${LANGUAGE_STORAGE_KEY}=${language}; path=/; max-age=31536000; SameSite=Lax`;
	}
}

// 按页面拆分的语言包加载器：Vite 将每个 JSON 编译为独立 chunk，实现 namespace 懒加载。
// 键格式为 "./locales/<language>/<namespace>.json"。
const namespaceLoaders = import.meta.glob("./locales/*/*.json") as Record<string, () => Promise<{ default: Record<string, unknown> }>>;

/**
 * 懒加载后端：页面首次使用某个 namespace 时才拉取对应语言包。
 * 加载非 en 语言时顺带预载同 namespace 的 en 包，保证：
 * 1) fallbackLng("en") 的缺失 key 能命中；2) 之后切回英文不再触发等待。
 */
const lazyBackend = {
	type: "backend" as const,
	init() {},
	read(language: string, namespace: string, callback: (err: unknown, data: Record<string, unknown> | null) => void) {
		const requested = namespaceLoaders[`./locales/${language}/${namespace}.json`];
		const fallback = language !== "en" ? namespaceLoaders[`./locales/en/${namespace}.json`] : undefined;
		if (!requested && !fallback) {
			callback(null, {});
			return;
		}
		const requestedLoad = requested ? requested().then((mod) => mod.default).catch(() => ({})) : Promise.resolve({});
		const fallbackLoad = fallback
			? fallback()
					.then((mod) => mod.default)
					.catch(() => null)
			: Promise.resolve(null);
		Promise.all([requestedLoad, fallbackLoad]).then(([data, enData]) => {
			if (enData) {
				i18n.addResourceBundle("en", namespace, enData, true, true);
			}
			callback(null, data);
		});
	},
};

// HMR 下模块可能重载，避免对同一实例重复 init
if (!i18n.isInitialized) {
	i18n
		.use(lazyBackend)
		.use(initReactI18next)
		.init({
			resources: {
				en: { common: enCommon },
				zh: { common: zhCommon },
			},
			lng: resolveInitialLanguage(),
			fallbackLng: "en",
			defaultNS: "common",
			ns: ["common"],
			// common 已随 bundle 注入，语言包仅对按页面拆分的 namespace 走懒加载
			partialBundledLanguages: true,
			interpolation: {
				// React 已对插值内容做转义
				escapeValue: false,
			},
			react: {
				useSuspense: true,
			},
		});
}

export default i18n;
