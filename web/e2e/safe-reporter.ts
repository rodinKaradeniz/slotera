import type { Reporter, TestCase, TestResult, TestStep } from "@playwright/test/reporter";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

// Raw Playwright errors/traces may include headers, inputs or token-bearing URLs.
// CI receives only allow-listed result metadata and synthetic UI screenshots.
export default class SafeReporter implements Reporter {
  results: {test: string; project: string; status: string; durationMs: number; phase: string}[] = [];
  lastLines = new Map<string, number>();
  onStepBegin(test: TestCase, _result: TestResult, step: TestStep) {
    if (step.location && /\/(workflows|communication|security)\.spec\.ts$/.test(step.location?.file ?? "")) this.lastLines.set(test.id, step.location.line);
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const row = {test: test.title, project: test.parent.project()?.name ?? "", status: result.status, durationMs: result.duration, phase: test.annotations.filter((item) => item.type === "phase").at(-1)?.description ?? "setup"};
    this.results.push(row);
    if (result.status !== "passed") console.log(`Last action line: ${this.lastLines.get(test.id) ?? 0}; failure source lines: ${result.errors.map((error) => error.stack?.match(/(?:workflows|communication|security)\.spec\.ts:(\d+)/)?.[1] ?? "unknown").join(", ")}`);
    console.log(`${row.project}: ${row.test}: ${row.status} (${row.phase})`);
  }
  onEnd() {rmSync("test-results", {recursive: true, force: true}); mkdirSync("browser-artifacts", {recursive: true}); writeFileSync("browser-artifacts/results.json", JSON.stringify(this.results, null, 2));}
  printsToStdio() { return true; }
}
