import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".next/static/chunks");
async function chunks(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const contents = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? chunks(path.join(directory, entry.name))
    : entry.name.endsWith(".js") ? await readFile(path.join(directory, entry.name), "utf8") : ""));
  return contents.join("\n");
}
const content = await chunks(root);
const api = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";
if (api && (content.includes("Unknown demo fixture") || !content.includes("mock fixture:"))) {
  throw new Error("API build must exclude demo fixtures and retain explicit mock-access rejection");
}
if (!api && !content.includes("Unknown demo fixture")) {
  throw new Error("Mock build must retain its fixture adapter");
}
process.stdout.write(`Verified ${api ? "API fixture exclusion" : "mock fixture retention"}.\n`);
