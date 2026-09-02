import { createFileRoute } from "@tanstack/react-router";
import ModelMarketplacePage from "./page";

export const Route = createFileRoute("/workspace/model-marketplace")({
	component: ModelMarketplacePage,
});