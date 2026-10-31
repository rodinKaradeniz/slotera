export type CsvColumn<T> = { header: string; value: (row: T) => string | number };

// Spreadsheets run a cell that starts with one of these as a formula, and client names and
// emails come from the public booking form, so such cells are made plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a UTF-8 byte-order mark, so Excel reads names like "Jürgen" right. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => cell(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Saves text as a file through the browser, the way the workspace export does. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
