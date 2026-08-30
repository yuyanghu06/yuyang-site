import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const temporaryDirectory = "/tmp/yuyang-pinecone-memory";
const sourcePath = valueAfter("--source") || path.join(temporaryDirectory, "memory-source.json");
const outputPath = valueAfter("--output") || path.join(temporaryDirectory, "memory-corpus.json");
const maxWords = 190;
const overlapWords = 28;

const source = JSON.parse(await readFile(sourcePath, "utf8"));

function cleanHeading(value) {
  return value.replace(/^\d+\.\s*/, "").trim();
}

function slug(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function words(value) {
  return value.trim().split(/\s+/).filter(Boolean);
}

const stopWords = new Set(["about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "between", "but", "does", "from", "have", "into", "just", "more", "most", "other", "that", "the", "their", "them", "then", "there", "these", "they", "this", "through", "what", "when", "where", "which", "who", "with", "would", "yuyang"]);

function searchTerms(value) {
  return [...new Set(value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((token) => token.length > 1 && !stopWords.has(token)))].slice(0, 150);
}

function splitLongText(value) {
  const tokens = words(value);
  if (tokens.length <= maxWords) return [value.trim()];
  const chunks = [];
  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(start + maxWords, tokens.length);
    chunks.push(tokens.slice(start, end).join(" "));
    if (end === tokens.length) break;
    start = Math.max(end - overlapWords, start + 1);
  }
  return chunks;
}

function packParagraphs(paragraphs) {
  const expanded = paragraphs.flatMap(splitLongText);
  const packed = [];
  let current = [];
  let count = 0;
  for (const paragraph of expanded) {
    const paragraphWords = words(paragraph).length;
    if (current.length && count + paragraphWords > maxWords) {
      packed.push(current.join("\n"));
      current = [];
      count = 0;
    }
    current.push(paragraph);
    count += paragraphWords;
  }
  if (current.length) packed.push(current.join("\n"));
  return packed;
}

const records = [];
let domain = "";
let record = null;
let subsection = "Overview";

function flushRecord() {
  if (record) records.push(record);
  record = null;
  subsection = "Overview";
}

for (const paragraph of source.paragraphs) {
  if (paragraph.style === "HEADING_2") {
    flushRecord();
    domain = cleanHeading(paragraph.text);
    continue;
  }
  if (!domain) continue;
  if (paragraph.style === "HEADING_3") {
    flushRecord();
    record = { domain, title: paragraph.text, sections: new Map([["Overview", []]]) };
    continue;
  }
  if (!record) record = { domain, title: domain, sections: new Map([["Overview", []]]) };
  if (paragraph.style === "HEADING_4") {
    subsection = paragraph.text;
    if (!record.sections.has(subsection)) record.sections.set(subsection, []);
    continue;
  }
  record.sections.get(subsection).push(paragraph.text);
}
flushRecord();

const chunks = [];
for (const item of records) {
  const allText = [...item.sections.values()].flat();
  const metadataValue = (label) => allText.find((line) => line.startsWith(`${label}:`))?.slice(label.length + 1).trim() ?? "";
  const entityId = metadataValue("Entity ID") || `${slug(item.domain)}:${slug(item.title)}`;
  const entityType = metadataValue("Entity type") || item.domain.replace(/s$/, "");
  const aliases = [item.title, ...metadataValue("Aliases").split(",").map((value) => value.trim()).filter(Boolean)];
  const status = metadataValue("Record status");
  const contentSections = [...item.sections.entries()].map(([section, lines]) => [section, lines.filter((line) => !/^(Entity type|Entity ID|Aliases|Record status):/.test(line))]);
  const pending = [];
  for (const [section, lines] of contentSections) {
    for (const packed of packParagraphs(lines)) if (packed) pending.push({ section, body: packed });
  }
  const count = pending.length;
  pending.forEach(({ section, body }, index) => {
    const context = [`Domain: ${item.domain}`, `Record: ${item.title}`, `Entity ID: ${entityId}`];
    if (section !== "Overview") context.push(`Section: ${section}`);
    const text = `${context.join("\n")}\n${body}`;
    const stableKey = `${source.documentId}:${entityId}:${slug(section)}:${index}`;
    const id = `memory-${createHash("sha256").update(stableKey).digest("hex").slice(0, 24)}`;
    chunks.push({
      id,
      text,
      source: `Pinecone Memory > ${item.domain} > ${item.title}${section === "Overview" ? "" : ` > ${section}`}`,
      domain: item.domain,
      record: item.title,
      entityId,
      entityType,
      aliases: [...new Set(aliases)],
      searchTerms: searchTerms(`${item.title} ${aliases.join(" ")} ${body}`),
      status,
      section,
      chunkIndex: index,
      chunkCount: count,
      sourceRevisionId: source.revisionId,
      wordCount: words(text).length,
    });
  });
}

const corpus = {
  documentId: source.documentId,
  documentUrl: source.documentUrl,
  sourceRevisionId: source.revisionId,
  generatedAt: new Date().toISOString(),
  embeddingModel: "text-embedding-3-small",
  chunking: { boundary: "H3 record and H4 subsection", maxWords, overlapWords, contextualPrefix: true },
  chunks,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(corpus, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, records: records.length, chunks: chunks.length, maxWords: Math.max(...chunks.map((chunk) => chunk.wordCount)) }, null, 2));
