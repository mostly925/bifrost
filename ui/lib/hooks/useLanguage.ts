import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES, persistLanguage, type SupportedLanguage } from "@/lib/i18n";

/** 当前语言与切换函数；切换时持久化偏好（localStorage + cookie 双写）。 */
export function useLanguage(): { language: SupportedLanguage; changeLanguage: (language: SupportedLanguage) => void } {
	const { i18n } = useTranslation();
	const language: SupportedLanguage = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
		? (i18n.language as SupportedLanguage)
		: "en";
	const changeLanguage = (next: SupportedLanguage) => {
		persistLanguage(next);
		i18n.changeLanguage(next);
	};
	return { language, changeLanguage };
}