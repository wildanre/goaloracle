import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const skillsDir = path.join(root, "skills");
const skillDirs = readdirSync(skillsDir);

const mcpSource = readFileSync(path.join(root, "packages/mcp-server/src/index.ts"), "utf8");
const registeredTools = [...mcpSource.matchAll(/registerTool\(\s*\n?\s*"([a-z_]+)"/g)].map((m) => m[1]!);

describe("Agent Skills", () => {
  it("ships the three PRD skills", () => {
    expect(skillDirs.sort()).toEqual(["match-predictor", "world-cup-analyst", "x402-payer"]);
  });

  for (const dir of skillDirs) {
    describe(dir, () => {
      const raw = readFileSync(path.join(skillsDir, dir, "SKILL.md"), "utf8");

      it("has valid YAML frontmatter with name and description", () => {
        const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
        expect(fm, "frontmatter block missing").toBeTruthy();
        const fields = Object.fromEntries(
          fm![1]!
            .split("\n")
            .filter((l) => /^[a-z]+:/.test(l))
            .map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]),
        );
        expect(fields.name).toBe(dir);
        expect(fields.description!.length).toBeGreaterThan(20);
      });

      it("references only real MCP tool names", () => {
        const mentioned = [...new Set([...raw.matchAll(/\bget_[a-z_]+\b/g)].map((m) => m[0]))];
        expect(mentioned.length).toBeGreaterThan(0);
        for (const tool of mentioned) {
          expect(registeredTools, `${tool} mentioned in ${dir}/SKILL.md is not a registered MCP tool`).toContain(tool);
        }
      });
    });
  }

  it("the MCP server registers all eight PRD tools", () => {
    expect(registeredTools.sort()).toEqual([
      "get_head_to_head",
      "get_live_matches",
      "get_match_analysis",
      "get_match_detail",
      "get_match_prediction",
      "get_standings",
      "get_todays_fixtures",
      "get_wallet_status",
    ]);
  });
});
