// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { KpiTile } from "./KpiTile";
afterEach(cleanup);
it("puts the number first, then the label, then the change in words", () => {
  const { container } = render(<I18nProvider><KpiTile kpi={{id: "revenue", label: "Revenue", value: "£100", delta: "−2.1%", trend: "down", spark: []}} /></I18nProvider>);
  expect(screen.getByText("2.1% decrease from last month")).toBeDefined();
  expect(container.textContent?.indexOf("£100")).toBeLessThan(container.textContent?.indexOf("Revenue") ?? -1);
  expect(screen.queryByText("vs last month")).toBeNull();
});
it("omits comparisons without a defined prior baseline", () => {
  render(<I18nProvider><KpiTile kpi={{id: "revenue", label: "Revenue", value: "£100", delta: "New this month", trend: "up", spark: []}} /></I18nProvider>);
  expect(screen.getByText("£100")).toBeDefined();
  expect(screen.queryByText("New this month")).toBeNull();
});
