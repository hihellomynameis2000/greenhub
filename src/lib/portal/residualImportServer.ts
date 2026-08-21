import "server-only";

import { inflateRawSync } from "node:zlib";
import { csvRows, parseRows, type ParsedResidualImport } from "./residualImport";

function decodeXml(value: string) {
  return value.replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|amp|lt|gt|quot|apos);/gi, (entity, hex, decimal) => {
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));

    return (
      {
        "&amp;": "&",
        "&apos;": "'",
        "&gt;": ">",
        "&lt;": "<",
        "&quot;": "\"",
      }[entity.toLowerCase()] ?? entity
    );
  });
}

function attribute(source: string, name: string) {
  return source.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1] ?? "";
}

function tagText(source: string, tag: string) {
  return decodeXml(
    source.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"))?.[1] ??
      ""
  );
}

function allTags(source: string, tag: string) {
  return Array.from(
    source.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*)>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "gi"))
  ).map((match) => ({
    attributes: match[1] ?? "",
    content: match[2] ?? "",
  }));
}

function columnIndex(ref: string) {
  const letters = ref.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function worksheetRows(xml: string, sharedStrings: string[]) {
  return allTags(xml, "row")
    .map((rowNode) => {
      const row: string[] = [];

      for (const cellNode of allTags(rowNode.content, "c")) {
        const ref = attribute(cellNode.attributes, "r");
        const type = attribute(cellNode.attributes, "t");
        let value = tagText(cellNode.content, "v");

        if (type === "s") value = sharedStrings[Number(value)] ?? "";
        else if (type === "inlineStr") {
          value = allTags(cellNode.content, "t")
            .map((textNode) => decodeXml(textNode.content))
            .join("");
        }

        row[columnIndex(ref)] = value.trim();
      }

      return row.map((value) => value ?? "");
    })
    .filter((row) => row.some(Boolean));
}

function sharedStrings(xml: string | undefined) {
  if (!xml) return [];

  return allTags(xml, "si").map((item) =>
    allTags(item.content, "t")
      .map((textNode) => decodeXml(textNode.content))
      .join("")
  );
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function xlsxEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let eocdOffset = -1;

  for (let offset = buffer.byteLength - 22; offset >= Math.max(0, buffer.byteLength - 66000); offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error("The Excel workbook could not be read.");

  const totalEntries = readUint16(view, eocdOffset + 10);
  let centralOffset = readUint32(view, eocdOffset + 16);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (readUint32(view, centralOffset) !== 0x02014b50) break;

    const method = readUint16(view, centralOffset + 10);
    const compressedSize = readUint32(view, centralOffset + 20);
    const fileNameLength = readUint16(view, centralOffset + 28);
    const extraLength = readUint16(view, centralOffset + 30);
    const commentLength = readUint16(view, centralOffset + 32);
    const localOffset = readUint32(view, centralOffset + 42);
    const name = decoder.decode(new Uint8Array(buffer, centralOffset + 46, fileNameLength));

    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = new Uint8Array(buffer, dataStart, compressedSize);

    if (method === 0) files.set(name, decoder.decode(compressed));
    else if (method === 8) files.set(name, decoder.decode(inflateRawSync(compressed)));

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function xlsxRows(fileName: string, buffer: ArrayBuffer): ParsedResidualImport {
  const files = xlsxEntries(buffer);
  const strings = sharedStrings(files.get("xl/sharedStrings.xml"));
  const worksheets = Array.from(files.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const parsed = worksheets
    .map((name, index) =>
      parseRows(fileName, `Sheet ${index + 1}`, worksheetRows(files.get(name) ?? "", strings))
    )
    .sort((left, right) => right.rows.length - left.rows.length)[0];

  return (
    parsed ?? {
      fileName,
      headers: [],
      rows: [],
      sheetName: "Workbook",
      warnings: ["The workbook did not contain readable residual sheets."],
    }
  );
}

export function parseResidualImportBuffer(fileName: string, buffer: ArrayBuffer): ParsedResidualImport {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseRows(fileName, "CSV", csvRows(new TextDecoder().decode(buffer)));
  }

  if (extension === "xlsx") return xlsxRows(fileName, buffer);

  throw new Error("Upload a CSV or XLSX residual report.");
}
