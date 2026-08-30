import { enUS, zhCN, type Locale } from "date-fns/locale";

import i18n from "@/lib/i18n";

/** 按当前界面语言返回 date-fns locale，供 format / formatDistanceToNow 等使用。 */
export function getDateFnsLocale(): Locale {
	return i18n.language === "zh" ? zhCN : enUS;
}