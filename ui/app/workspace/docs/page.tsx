import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GradientHeader from "@/components/ui/gradientHeader";
import { BookOpen, Code, ExternalLink, FileText, GitBranch, Play, Shield, Users, Zap, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DocSection {
	// Stable id used to build data-testid values; must not be translated.
	id: string;
	title: string;
	description: string;
	icon: LucideIcon;
	url: string;
	badge?: string;
	items: string[];
}

interface FeaturedDoc {
	// Stable id used to build data-testid values; must not be translated.
	id: string;
	title: string;
	description: string;
	content: string;
	href: string;
	icon: LucideIcon;
	buttonText: string;
	borderColor: string;
	backgroundColor: string;
	iconColor: string;
}

export default function DocsPage() {
	const { t } = useTranslation("docs");

	const docSections: DocSection[] = [
		{
			id: "quick-start",
			title: t("sections.quickStart.title"),
			description: t("sections.quickStart.description"),
			icon: Play,
			url: "https://github.com/maximhq/bifrost/tree/main/docs/quickstart",
			badge: t("sections.quickStart.badge"),
			items: [
				t("sections.quickStart.items.httpTransport"),
				t("sections.quickStart.items.goPackage"),
				t("sections.quickStart.items.docker"),
			],
		},
		{
			id: "architecture",
			title: t("sections.architecture.title"),
			description: t("sections.architecture.description"),
			icon: GitBranch,
			url: "https://github.com/maximhq/bifrost/tree/main/docs/architecture",
			items: [
				t("sections.architecture.items.systemOverview"),
				t("sections.architecture.items.requestFlow"),
				t("sections.architecture.items.concurrencyModel"),
				t("sections.architecture.items.designDecisions"),
			],
		},
		{
			id: "usage-guides",
			title: t("sections.usageGuides.title"),
			description: t("sections.usageGuides.description"),
			icon: BookOpen,
			url: "https://github.com/maximhq/bifrost/tree/main/docs/usage",
			badge: t("sections.usageGuides.badge"),
			items: [
				t("sections.usageGuides.items.providersSetup"),
				t("sections.usageGuides.items.keyManagement"),
				t("sections.usageGuides.items.errorHandling"),
				t("sections.usageGuides.items.memoryNetworking"),
			],
		},
		{
			id: "contributing",
			title: t("sections.contributing.title"),
			description: t("sections.contributing.description"),
			icon: Users,
			url: "https://github.com/maximhq/bifrost/tree/main/docs/contributing",
			items: [
				t("sections.contributing.items.guide"),
				t("sections.contributing.items.addingProviders"),
				t("sections.contributing.items.pluginDevelopment"),
				t("sections.contributing.items.codeConventions"),
			],
		},
		{
			id: "integration-examples",
			title: t("sections.integrationExamples.title"),
			description: t("sections.integrationExamples.description"),
			icon: Code,
			url: "https://github.com/maximhq/bifrost/tree/main/docs/usage/http-transport/integrations",
			items: [
				t("sections.integrationExamples.items.openai"),
				t("sections.integrationExamples.items.anthropic"),
				t("sections.integrationExamples.items.genai"),
				t("sections.integrationExamples.items.migrationGuides"),
			],
		},
		{
			id: "benchmarks",
			title: t("sections.benchmarks.title"),
			description: t("sections.benchmarks.description"),
			icon: Zap,
			url: "https://github.com/maximhq/bifrost/blob/main/docs/benchmarks.md",
			items: [
				t("sections.benchmarks.items.rpsResults"),
				t("sections.benchmarks.items.performanceMetrics"),
				t("sections.benchmarks.items.configurationTuning"),
				t("sections.benchmarks.items.hardwareComparisons"),
			],
		},
	];

	const featuredDocs: FeaturedDoc[] = [
		{
			id: "mcp-documentation",
			title: t("featured.mcp.title"),
			description: t("featured.mcp.description"),
			content: t("featured.mcp.content"),
			href: "https://github.com/maximhq/bifrost/blob/main/docs/mcp.md",
			icon: FileText,
			buttonText: t("featured.mcp.buttonText"),
			borderColor: "border-primary/20",
			backgroundColor: "bg-primary/5",
			iconColor: "text-primary",
		},
		{
			id: "governance-plugin",
			title: t("featured.governance.title"),
			description: t("featured.governance.description"),
			content: t("featured.governance.content"),
			href: "https://github.com/maximhq/bifrost/blob/main/docs/governance.md",
			icon: Shield,
			buttonText: t("featured.governance.buttonText"),
			borderColor: "border-green-200 dark:border-green-800",
			backgroundColor: "bg-green-50 dark:bg-green-950/20",
			iconColor: "text-green-600",
		},
	];

	return (
		<div className="dark:bg-card bg-white">
			<div className="mx-auto max-w-7xl">
				<div className="space-y-8">
					{/* Header */}
					<div className="space-y-4 text-center">
						<div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
							<BookOpen className="h-4 w-4" />
							<span className="font-semibold">{t("header.badge")}</span>
						</div>
						<GradientHeader title={t("header.title")} />
						<p className="text-muted-foreground mx-auto max-w-2xl text-lg">{t("header.subtitle")}</p>
						<div className="flex justify-center gap-4">
							<Button asChild>
								<a
									href="https://github.com/maximhq/bifrost/tree/main/docs"
									target="_blank"
									rel="noopener noreferrer"
									data-testid="docs-view-full-documentation-link"
								>
									<ExternalLink className="mr-2 h-4 w-4" />
									{t("header.viewFull")}
								</a>
							</Button>
							<Button variant="outline" asChild>
								<a
									href="https://github.com/maximhq/bifrost/tree/main/docs/quickstart"
									target="_blank"
									rel="noopener noreferrer"
									data-testid="docs-quick-start-guide-link"
								>
									<Play className="mr-2 h-4 w-4" />
									{t("header.quickStartGuide")}
								</a>
							</Button>
						</div>
					</div>

					{/* Documentation Sections */}
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{docSections.map((section) => {
							const Icon = section.icon;
							return (
								<Card key={section.id} className="group transition-all duration-200 hover:shadow-lg">
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="bg-primary/10 group-hover:bg-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors">
												<Icon className="text-primary h-6 w-6" />
											</div>
											{section.badge && (
												<Badge variant="secondary" className="text-xs">
													{section.badge}
												</Badge>
											)}
										</div>
										<CardTitle className="text-xl">{section.title}</CardTitle>
										<CardDescription className="leading-relaxed">{section.description}</CardDescription>
									</CardHeader>
									<CardContent className="flex h-full flex-col justify-between gap-8">
										<div className="space-y-4">
											<ul className="space-y-2">
												{section.items.map((item, index) => (
													<li key={index} className="text-muted-foreground flex items-center gap-2 text-sm">
														<div className="bg-primary h-1.5 w-1.5 rounded-full" />
														{item}
													</li>
												))}
											</ul>
										</div>
										<Button asChild variant="outline" className="w-full">
											<a
												href={section.url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center justify-center gap-2"
												data-testid={`docs-read-more-${section.id}`}
											>
												{t("readMore")}
												<ExternalLink className="h-4 w-4" />
											</a>
										</Button>
									</CardContent>
								</Card>
							);
						})}
					</div>

					{/* Featured Documentation */}
					<div className="grid gap-6 pt-8 md:grid-cols-2">
						{featuredDocs.map((doc) => (
							<Card className={`${doc.borderColor} ${doc.backgroundColor}`} key={doc.id}>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<doc.icon className={`h-5 w-5 ${doc.iconColor}`} />
										{doc.title}
									</CardTitle>
									<CardDescription>{doc.description}</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground mb-4 text-sm">{doc.content}</p>
									<Button asChild className="w-full">
										<a href={doc.href} target="_blank" rel="noopener noreferrer" data-testid={`docs-featured-${doc.id}`}>
											<doc.icon className="mr-2 h-4 w-4" />
											{doc.buttonText}
										</a>
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}