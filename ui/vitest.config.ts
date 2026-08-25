import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	// tsconfig 中 jsx 为 preserve，且本配置没有引入 @vitejs/plugin-react；
	// vitest 使用 oxc 转换时会按 tsconfig 保留 JSX，导致 .tsx 文件解析失败，
	// 因此显式指定 automatic runtime 让 oxc 转换 JSX。
	oxc: {
		jsx: { runtime: "automatic" },
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	test: {
		globals: true,
	},
});