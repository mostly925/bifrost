import { ProviderIcons } from "@/lib/constants/icons";

/** Narrows a catalog provider string to the icon registry's key union. */
export function isKnownProvider(provider: string): provider is keyof typeof ProviderIcons {
	return provider in ProviderIcons;
}