import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const columns = [
  { header: "Name", value: (r: { name: string; n: number }) => r.name },
  { header: "Count", value: (r: { name: string; n: number }) => r.n },
];

describe("toCsv", () => {
  it("writes a header, CRLF rows and a byte-order mark", () => {
    expect(toCsv([{ name: "Ada", n: 2 }], columns)).toBe("﻿Name,Count\r\nAda,2\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    const csv = toCsv([{ name: 'Lovelace, "Ada"\nCo', n: 1 }], columns);
    expect(csv).toContain('"Lovelace, ""Ada""\nCo",1');
  });

  it("turns spreadsheet formulas into plain text but leaves numbers alone", () => {
    const csv = toCsv(
      [
        { name: "=HYPERLINK(1)", n: -5 },
        { name: "+44 20", n: 0 },
      ],
      columns,
    );
    expect(csv).toContain("'=HYPERLINK(1),-5");
    expect(csv).toContain("'+44 20,0");
  });
});
