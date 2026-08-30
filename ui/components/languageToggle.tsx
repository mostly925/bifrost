import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useLanguage } from "@/lib/hooks/useLanguage";

// 字面量 key 映射，保持 i18next 类型推导（模板字符串会丢失字面量类型）
const LANGUAGE_LABEL_KEYS = {
	en: "language.en",
	zh: "language.zh",
} as const;

export function LanguageToggle() {
	const { t } = useTranslation();
	const { language, changeLanguage } = useLanguage();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					data-testid="language-toggle-btn"
					className="hover:text-primary text-muted-foreground h-5 w-5 border-0 ring-offset-0 outline-none select-none focus-visible:ring-0"
				>
					<Languages className="h-5.5 w-5.5 transition-all" strokeWidth={2} />
					<span className="sr-only">{t("sidebar.toggleLanguageAria")}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{SUPPORTED_LANGUAGES.map((lng) => (
					<DropdownMenuItem
						key={lng}
						data-testid={`language-option-${lng}`}
						className={language === lng ? "font-medium" : ""}
						onClick={() => changeLanguage(lng)}
					>
						{t(LANGUAGE_LABEL_KEYS[lng])}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}