#!/usr/bin/env node
/**
 * 扫描 UI 源码中疑似硬编码英文文案，输出按目录聚合的数量统计。
 * 用途：1) 评估 i18n 迁移工作量；2) 作为防回潮基线，新代码不应让计数上涨。
 *
 * 启发式规则（只统计，不保证零误报）：
 *   - JSX 标签之间的文本节点（含英文字母且不是纯符号/变量）
 *   - 常见文案属性：placeholder / title / aria-label / alt / description
 *   - toast(...) 调用中的字符串字面量
 *
 * 用法：
 *   node scripts/scan-hardcoded-strings.mjs            # 扫描 ui/ 全部目录并输出表格
 *   node scripts/scan-hardcoded-strings.mjs --json     # 输出 JSON
 *   node scripts/scan-hardcoded-strings.mjs app/workspace/providers  # 只扫某个子目录
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const uiRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const checkIndex = args.indexOf("--check");
const baselinePath = checkIndex === -1 ? undefined : args[checkIndex + 1];
if (checkIndex !== -1 && !baselinePath) {
	throw new Error("--check requires a baseline JSON path");
}
const targetArg = args.find((arg, index) => !arg.startsWith("--") && (checkIndex === -1 || index !== checkIndex + 1));
const jsonOutput = args.includes("--json");
const scanRoot = targetArg ? resolve(uiRoot, targetArg) : uiRoot;

const SCAN_DIRS = ["app", "components", "lib", "hooks"];
const scanRoots = targetArg ? [scanRoot] : SCAN_DIRS.map((dir) => join(uiRoot, dir));

// 标签之间的文本节点：含至少一个英文单词，排除纯表达式/纯符号/注释
const jsxTextRe = />([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g;
// 常见承载用户可见文案的属性
const attrRe = /\b(?:placeholder|title|aria-label|alt|description|label)=("[^"\n]*[A-Za-z][^"\n]*"|\{?"[^"\n]*[A-Za-z][^"\n]*"?\})/g;
// toast("...") / toast.error("...") / toast.success("...") 等
const toastRe = /\btoast(?:\.\w+)?\(\s*("[^"\n]+")/g;

function* walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) {
			if (entry === "node_modules" || entry === "enterprise" || entry.startsWith(".")) continue;
			yield* walk(full);
		} else if (/\.(tsx|ts)$/.test(entry) && !entry.endsWith(".d.ts") && !entry.endsWith(".gen.ts")) {
			yield full;
		}
	}
}

function hasEnglishWord(text) {
	// 至少一个 2+ 字母单词，排除全大写枚举样式常量（如 HTTP、SSE）与路径/标识符
	const words = text.match(/[A-Za-z][a-z]+/g);
	return !!words && words.length > 0;
}

const perDir = new Map();
const perFile = [];
let totalFiles = 0;
let totalHits = 0;

for (const root of scanRoots) {
	let st;
	try {
		st = statSync(root);
	} catch {
		continue;
	}
	if (!st.isDirectory()) continue;
	for (const file of walk(root)) {
		const content = readFileSync(file, "utf8");
		let hits = 0;
		for (const m of content.matchAll(jsxTextRe)) {
			const text = m[1].trim();
			if (text && hasEnglishWord(text)) hits++;
		}
		for (const m of content.matchAll(attrRe)) {
			if (hasEnglishWord(m[1])) hits++;
		}
		for (const m of content.matchAll(toastRe)) {
			if (hasEnglishWord(m[1])) hits++;
		}
		if (hits > 0) {
			totalFiles++;
			totalHits += hits;
			const rel = relative(uiRoot, file).split(sep).join("/");
			// 聚合粒度：app 下按 workspace/<page> 或一级路由，其余按二级目录
			const parts = rel.split("/");
			let bucket;
			if (parts[0] === "app" && parts[1] === "workspace") bucket = `app/workspace/${parts[2] ?? ""}`;
			else if (parts[0] === "app") bucket = `app/${parts[1] ?? ""}`;
			else bucket = `${parts[0]}/${parts[1] ?? ""}`;
			perDir.set(bucket, (perDir.get(bucket) ?? 0) + hits);
			perFile.push({ file: rel, hits });
		}
	}
}

const report = { totalHits, totalFiles, perDir: Object.fromEntries(perDir), perFile };

if (jsonOutput) {
	console.log(JSON.stringify(report, null, 2));
} else {
	const rows = [...perDir.entries()].sort((a, b) => b[1] - a[1]);
	console.log(`硬编码文案扫描结果（启发式）：共 ${totalHits} 处，分布在 ${totalFiles} 个文件`);
	console.log("");
	for (const [dir, count] of rows) {
		console.log(`${String(count).padStart(6)}  ${dir}`);
	}
}

if (baselinePath) {
	const baseline = JSON.parse(readFileSync(resolve(uiRoot, baselinePath), "utf8"));
	const regressions = Object.entries(report.perDir).filter(([dir, count]) => count > (baseline.perDir[dir] ?? 0));
	if (regressions.length > 0) {
		console.error("发现新增的疑似硬编码文案：");
		for (const [dir, count] of regressions) {
			console.error(`  ${dir}: ${baseline.perDir[dir] ?? 0} → ${count}`);
		}
		process.exitCode = 1;
	}
}