import type { TFunction } from "i18next";

// ---------------------------------------------------------------------------
// Catalog taxonomy localization
//
// The category / connection-type / auth-type facet values shown in the MCP
// library (sidebar checkboxes, category badges, table details) are dynamic
// data from the backend (useGetMCPLibraryFilterDataQuery), so their display
// labels are resolved at render time through the mcpLibrary language pack
// (catalogTaxonomy.*). Pack keys are slugified forms of the English values
// ("AI Tools" -> aiTools); identifier-style values (http, per_user_oauth, ...)
// use the raw value as the key. Any value without a matching key is shown
// as-is, so new backend values never render as a broken key.
// ---------------------------------------------------------------------------

/** camelCase slug of a raw taxonomy value: "AI Tools" -> "aiTools", "E-Commerce" -> "eCommerce". */
function slugifyTaxonomyValue(value: string): string {
	return value
		.trim()
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
		.join("");
}

const CATEGORY_KEYS = {
	aiTools: true,
	analytics: true,
	communication: true,
	customerSupport: true,
	design: true,
	developerTools: true,
	eCommerce: true,
	finance: true,
	humanResources: true,
	legal: true,
	lifestyle: true,
	marketing: true,
	productivity: true,
	projectManagement: true,
	research: true,
	sales: true,
	search: true,
	security: true,
	travel: true,
} as const;

type CategorySlug = keyof typeof CATEGORY_KEYS;

/** Localized label for a backend category value; unknown values pass through unchanged. */
export function categoryLabel(t: TFunction<"mcpLibrary">, raw: string): string {
	const slug = slugifyTaxonomyValue(raw);
	if (!(slug in CATEGORY_KEYS)) return raw;
	return t(`catalogTaxonomy.categories.${slug as CategorySlug}`);
}

const CONNECTION_TYPE_KEYS = {
	http: true,
	sse: true,
	stdio: true,
	streamable_http: true,
} as const;

type ConnectionTypeSlug = keyof typeof CONNECTION_TYPE_KEYS;

/** Localized transport label for a connection_type value ("http" -> "HTTP"); unknown values pass through. */
export function transportLabel(t: TFunction<"mcpLibrary">, connectionType?: string): string {
	if (!connectionType) return t("catalogTaxonomy.connectionTypes.http");
	const key = connectionType.trim().toLowerCase();
	if (!(key in CONNECTION_TYPE_KEYS)) return connectionType;
	return t(`catalogTaxonomy.connectionTypes.${key as ConnectionTypeSlug}`);
}

const AUTH_TYPE_KEYS = {
	none: true,
	headers: true,
	oauth: true,
	per_user_oauth: true,
	per_user_headers: true,
	token_exchange: true,
} as const;

type AuthTypeSlug = keyof typeof AUTH_TYPE_KEYS;

/** Localized label for an auth_type value; unknown values pass through. */
export function authLabel(t: TFunction<"mcpLibrary">, authType?: string): string {
	if (!authType) return t("catalogTaxonomy.authTypes.none");
	const key = authType.trim().toLowerCase();
	if (!(key in AUTH_TYPE_KEYS)) return authType;
	return t(`catalogTaxonomy.authTypes.${key as AuthTypeSlug}`);
}