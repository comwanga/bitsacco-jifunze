// Validates content/ against the rules in the v1 spec. Exits 1 on any error.
// Usage: node scripts/validate-content.ts [content-root]
import path from "node:path";
import { validateContent } from "../lib/content/validate.ts";

const root = path.resolve(process.argv[2] ?? "content");
const issues = validateContent(root);
const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");

for (const i of [...errors, ...warnings]) {
  const tag = i.level === "error" ? "ERROR" : "warn ";
  console.log(`${tag} [rule ${i.rule}] ${i.file}: ${i.message}`);
}
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s) in ${path.relative(process.cwd(), root) || "."}`);
process.exit(errors.length > 0 ? 1 : 0);
