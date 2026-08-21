export type ParsedResidualImportRow = {
  agentCommissionStructure: string;
  agentProfit: string;
  equipmentCost: string;
  greenhubNetProfit: string;
  greenhubPobBuyRate: string;
  greenhubPobNetProfit: string;
  greenhubPobProfitPerTransaction: string;
  grossPobProfitPerTransaction: string;
  integrationFee: string;
  merchantName: string;
  merchantNotes: string;
  monthlySalesVolume: string;
  profitPerTransaction: string;
  rebate: string;
  sourceIndex: number;
  sourceStatus: string;
  surcharge: string;
  transactionsPerMonth: string;
};

export type ParsedResidualImport = {
  fileName: string;
  headers: string[];
  rows: ParsedResidualImportRow[];
  sheetName: string;
  warnings: string[];
};

type ImportField = keyof Omit<ParsedResidualImportRow, "sourceIndex">;

const fieldAliases: Record<ImportField, string[]> = {
  agentCommissionStructure: [
    "agent commission structure",
    "agent revenue share",
    "share %",
    "share percent",
  ],
  agentProfit: ["agent profit", "agent residual", "agent pob residual", "agent amount due", "amount due"],
  equipmentCost: ["equipment cost"],
  greenhubNetProfit: ["greenhub net profit", "greenhub cc net profit", "cc greenhub net profit"],
  greenhubPobBuyRate: ["greenhub pob buy rate", "pob buy rate", "iso buy rate", "buy rate"],
  greenhubPobNetProfit: ["greenhub pob net profit", "pob net profit"],
  greenhubPobProfitPerTransaction: [
    "greenhub pob profit per transaction",
    "greenhub pob profit / transaction",
    "greenhub profit per transaction",
    "greenhub profit / transaction",
    "pob profit per transaction",
  ],
  grossPobProfitPerTransaction: [
    "net surcharge",
    "gross pob profit per transaction",
    "gross profit per transaction",
    "pob margin per transaction",
  ],
  integrationFee: ["integration fee"],
  merchantName: ["merchant", "merchant name", "account", "account name", "location name"],
  merchantNotes: ["merchant notes", "notes", "billing model", "iso/referral"],
  monthlySalesVolume: ["merchant sales volume", "monthly sales volume", "sales volume"],
  profitPerTransaction: ["agent profit per transaction", "agent profit / transaction", "amount due per transaction"],
  rebate: ["rebate to merchant", "merchant rebate", "rebate"],
  sourceStatus: ["status"],
  surcharge: ["surcharge"],
  transactionsPerMonth: [
    "transactions per month",
    "number of transactions",
    "number of transactions ",
    "transactions",
    "transaction count",
  ],
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

function fieldForHeader(header: string): ImportField | null {
  const normalized = normalizeHeader(header);

  for (const [field, aliases] of Object.entries(fieldAliases) as Array<[ImportField, string[]]>) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) return field;
  }

  return null;
}

function valueAt(row: string[], index: number | undefined) {
  return index === undefined ? "" : String(row[index] ?? "").trim();
}

function numberValue(value: string) {
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value ? value.toFixed(2) : "";
}

function formatRate(value: number) {
  return value ? Number(value.toFixed(4)).toString() : "";
}

function formatSignedRate(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(4)).toString() : "";
}

function shareValue(value: string) {
  const numeric = numberValue(value);
  if (!numeric) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

export function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function columnIndex(ref: string) {
  const letters = ref.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function xmlText(element: Element) {
  return Array.from(element.getElementsByTagName("*"))
    .filter((node) => node.localName === "t")
    .map((node) => node.textContent ?? "")
    .join("");
}

function worksheetRows(xml: string, sharedStrings: string[]) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const rows: string[][] = [];

  for (const rowNode of Array.from(document.getElementsByTagName("*")).filter((node) => node.localName === "row")) {
    const row: string[] = [];

    for (const cellNode of Array.from(rowNode.children).filter((node) => node.localName === "c")) {
      const ref = cellNode.getAttribute("r") ?? "";
      const type = cellNode.getAttribute("t");
      const valueNode = Array.from(cellNode.children).find((node) => node.localName === "v");
      const inlineString = Array.from(cellNode.children).find((node) => node.localName === "is");
      let value = valueNode?.textContent ?? "";

      if (type === "s") value = sharedStrings[Number(value)] ?? "";
      else if (type === "inlineStr" && inlineString) value = xmlText(inlineString);

      row[columnIndex(ref)] = value.trim();
    }

    if (row.some(Boolean)) rows.push(row.map((value) => value ?? ""));
  }

  return rows;
}

function sharedStrings(xml: string | undefined) {
  if (!xml) return [];

  const document = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(document.getElementsByTagName("*"))
    .filter((node) => node.localName === "si")
    .map((node) => xmlText(node));
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

async function inflate(data: Uint8Array) {
  const Decompression = (
    globalThis as unknown as {
      DecompressionStream?: new (format: string) => {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
      };
    }
  ).DecompressionStream;

  if (!Decompression) {
    throw new Error("XLSX import is not supported in this browser. Export the report as CSV and upload that file.");
  }

  const stream = new Decompression("deflate-raw");
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

async function xlsxEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let eocdOffset = -1;

  for (let offset = buffer.byteLength - 22; offset >= Math.max(0, buffer.byteLength - 66000); offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error("The XLSX file could not be read.");

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
    const nameBytes = new Uint8Array(buffer, centralOffset + 46, fileNameLength);
    const name = decoder.decode(nameBytes);

    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = new Uint8Array(buffer, dataStart, compressedSize);
    const bytes = method === 0 ? compressed : method === 8 ? await inflate(compressed) : null;
    if (bytes) files.set(name, decoder.decode(bytes));

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

async function xlsxRows(file: File) {
  const files = await xlsxEntries(await file.arrayBuffer());
  const strings = sharedStrings(files.get("xl/sharedStrings.xml"));
  const worksheets = Array.from(files.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  return worksheets.map((name, index) => ({
    name: `Sheet ${index + 1}`,
    rows: worksheetRows(files.get(name) ?? "", strings),
  }));
}

function mappedHeader(headers: string[]) {
  const map = new Map<ImportField, number>();

  headers.forEach((header, index) => {
    const field = fieldForHeader(header);
    if (field && !map.has(field)) map.set(field, index);
  });

  return map;
}

export function parseRows(fileName: string, sheetName: string, rows: string[][]): ParsedResidualImport {
  let best = { index: -1, map: new Map<ImportField, number>(), score: 0 };

  rows.forEach((row, index) => {
    const map = mappedHeader(row);
    const score = map.size + (map.has("merchantName") ? 4 : 0);
    if (score > best.score) best = { index, map, score };
  });

  if (best.index < 0 || !best.map.has("merchantName")) {
    return {
      fileName,
      headers: [],
      rows: [],
      sheetName,
      warnings: ["No recognizable residual header row was found."],
    };
  }

  const headers = rows[best.index] ?? [];
  const importedRows: ParsedResidualImportRow[] = [];
  const warnings: string[] = [];

  for (let index = best.index + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const merchantName = valueAt(row, best.map.get("merchantName"));
    if (!merchantName || /total\s+due|grand\s+total|^total$/i.test(merchantName)) continue;

    const sourceStatus = valueAt(row, best.map.get("sourceStatus"));
    const surcharge = valueAt(row, best.map.get("surcharge"));
    const rebate = valueAt(row, best.map.get("rebate"));
    const greenhubPobBuyRate = valueAt(row, best.map.get("greenhubPobBuyRate"));
    const integrationFee = valueAt(row, best.map.get("integrationFee"));
    const transactionsPerMonth = valueAt(row, best.map.get("transactionsPerMonth"));
    const monthlySalesVolume = valueAt(row, best.map.get("monthlySalesVolume"));
    const greenhubNetProfit = valueAt(row, best.map.get("greenhubNetProfit"));
    const agentCommissionStructure = valueAt(row, best.map.get("agentCommissionStructure"));
    const equipmentCost = valueAt(row, best.map.get("equipmentCost"));
    let agentProfit = valueAt(row, best.map.get("agentProfit"));
    let profitPerTransaction = valueAt(row, best.map.get("profitPerTransaction"));
    let grossPobProfitPerTransaction = valueAt(row, best.map.get("grossPobProfitPerTransaction"));
    let greenhubPobProfitPerTransaction = valueAt(row, best.map.get("greenhubPobProfitPerTransaction"));
    let greenhubPobNetProfit = valueAt(row, best.map.get("greenhubPobNetProfit"));

    const transactions = numberValue(transactionsPerMonth);
    if (!profitPerTransaction && agentProfit && transactions) {
      profitPerTransaction = formatRate(numberValue(agentProfit) / transactions);
    }
    if (!grossPobProfitPerTransaction) {
      const gross =
        numberValue(surcharge) -
        numberValue(greenhubPobBuyRate) -
        numberValue(rebate) -
        numberValue(integrationFee);
      if (gross) grossPobProfitPerTransaction = formatSignedRate(gross);
    }
    if (!profitPerTransaction && grossPobProfitPerTransaction && shareValue(agentCommissionStructure)) {
      profitPerTransaction = formatRate(
        numberValue(grossPobProfitPerTransaction) * shareValue(agentCommissionStructure)
      );
    }
    if (!agentProfit && profitPerTransaction && transactions) {
      agentProfit = formatMoney(numberValue(profitPerTransaction) * transactions);
    }
    if (!greenhubPobProfitPerTransaction && grossPobProfitPerTransaction && profitPerTransaction) {
      greenhubPobProfitPerTransaction = formatSignedRate(
        numberValue(grossPobProfitPerTransaction) - numberValue(profitPerTransaction)
      );
    }
    if (!greenhubPobProfitPerTransaction && greenhubPobNetProfit && transactions) {
      greenhubPobProfitPerTransaction = formatSignedRate(numberValue(greenhubPobNetProfit) / transactions);
    }
    if (!greenhubPobNetProfit && greenhubPobProfitPerTransaction && transactions) {
      greenhubPobNetProfit = formatMoney(numberValue(greenhubPobProfitPerTransaction) * transactions);
    }

    importedRows.push({
      agentCommissionStructure,
      agentProfit,
      equipmentCost,
      greenhubNetProfit,
      greenhubPobBuyRate,
      greenhubPobNetProfit,
      greenhubPobProfitPerTransaction,
      grossPobProfitPerTransaction,
      integrationFee,
      merchantName,
      merchantNotes: [sourceStatus ? `Source status: ${sourceStatus}` : "", valueAt(row, best.map.get("merchantNotes"))]
        .filter(Boolean)
        .join(" | "),
      monthlySalesVolume,
      profitPerTransaction,
      rebate,
      sourceIndex: index + 1,
      sourceStatus,
      surcharge,
      transactionsPerMonth: transactions ? String(Math.round(transactions)) : transactionsPerMonth,
    });
  }

  if (!importedRows.length) warnings.push("The file was readable, but no merchant residual rows were found.");

  return { fileName, headers, rows: importedRows, sheetName, warnings };
}

export async function parseResidualImportFile(file: File): Promise<ParsedResidualImport> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseRows(file.name, "CSV", csvRows(await file.text()));
  }

  if (extension === "xlsx") {
    const sheets = await xlsxRows(file);
    const parsed = sheets
      .map((sheet) => parseRows(file.name, sheet.name, sheet.rows))
      .sort((left, right) => right.rows.length - left.rows.length)[0];

    return parsed ?? {
      fileName: file.name,
      headers: [],
      rows: [],
      sheetName: "Workbook",
      warnings: ["The workbook did not contain readable sheets."],
    };
  }

  throw new Error("Upload a CSV or XLSX residual report.");
}
