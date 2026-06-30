const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "html",
  "htm",
  "json",
  "csv",
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "sql",
  "yaml",
  "yml",
  "env",
  "css",
  "scss",
  "sass",
  "xml",
  "log",
]);

const BINARY_FILE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "zip",
  "gz",
  "7z",
  "rar",
  "mp3",
  "mp4",
  "mov",
  "avi",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "exe",
  "dll",
  "bin",
]);

const MAX_EXTRACTED_CHARS = 50000;
const MAX_ZIP_FILES = 40;

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function limitText(text: string, maxLength = MAX_EXTRACTED_CHARS): string {
  const normalized = text.replace(/\u0000/g, "").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}\n\n[conteúdo truncado]`;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo como texto"));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo binário"));
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo binário"));
    reader.readAsArrayBuffer(file);
  });
}

function isZipTextCandidate(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  if (normalizedPath.includes("node_modules/") || normalizedPath.includes("__macosx/")) {
    return false;
  }

  const ext = getExtension(normalizedPath);
  return !BINARY_FILE_EXTENSIONS.has(ext);
}

async function extractTextFromZip(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await readFileAsArrayBuffer(file));
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && isZipTextCandidate(entry.name))
    .slice(0, MAX_ZIP_FILES);

  const extractedEntries = await Promise.all(
    entries.map(async (entry) => {
      const content = await entry.async("text");
      const limited = limitText(content, 12000);
      if (!limited) return null;
      return `===== ${entry.name} =====\n${limited}`;
    })
  );

  const joined = extractedEntries.filter(Boolean).join("\n\n");
  if (!joined) {
    throw new Error("Nenhum conteúdo textual foi encontrado dentro do ZIP");
  }

  return limitText(joined);
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(await readFileAsArrayBuffer(file)),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]);
  const pdf = await task.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(`[Página ${pageNumber}]\n${pageText}`);
    }
  }

  return limitText(pages.join("\n\n"));
}

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await readFileAsArrayBuffer(file) });
  return limitText(result.value);
}

async function extractTextFromXlsx(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await readFileAsArrayBuffer(file), { type: "array" });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const trimmed = csv.trim();
    return trimmed ? `===== ${sheetName} =====\n${trimmed}` : null;
  }).filter(Boolean);

  return limitText(sheets.join("\n\n"));
}

export async function extractAttachmentText(file: File): Promise<string> {
  const ext = getExtension(file.name);
  const mime = file.type.toLowerCase();

  if (TEXT_FILE_EXTENSIONS.has(ext) || mime.startsWith("text/")) {
    return limitText(await readFileAsText(file));
  }

  if (ext === "zip" || mime === "application/zip" || mime === "application/x-zip-compressed") {
    return extractTextFromZip(file);
  }

  if (ext === "pdf" || mime === "application/pdf") {
    return extractTextFromPdf(file);
  }

  if (ext === "docx" || mime.includes("wordprocessingml")) {
    return extractTextFromDocx(file);
  }

  if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheet") || ext === "csv") {
    return extractTextFromXlsx(file);
  }

  return limitText(await readFileAsText(file));
}

export async function readAttachmentPreview(file: File): Promise<string> {
  return readFileAsDataUrl(file);
}
