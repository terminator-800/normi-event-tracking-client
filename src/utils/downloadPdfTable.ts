import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import csgLogo from "../assets/csg1.png";

type Rgb = readonly [number, number, number];

export type DownloadPdfTableOptions = {
  filename: string;
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
  /** When provided, the PDF is encrypted with this password (jsPDF encryption). */
  exportPassword?: string | null;
  /** Defaults to landscape when there are more than 6 columns. */
  orientation?: "portrait" | "landscape";
  /** Optional body cell text colors by 0-based column index. */
  columnTextColors?: Record<number, Rgb>;
  /** Optional per-cell style override (wins over columnTextColors when set). */
  getBodyCellStyle?: (ctx: {
    columnIndex: number;
    cellText: string;
  }) => { textColor?: Rgb; fontStyle?: "normal" | "bold" } | undefined;
};

const LOGO_SIZE = 38;
const HEADER_TOP = 22;
const BRAND_GREEN: Rgb = [7, 113, 60];
const MUTED_GRAY: Rgb = [80, 80, 80];
const ALT_ROW_FILL: Rgb = [241, 250, 244];
const UNICODE_FONT = "NotoSans";

let cachedLogoDataUrl: string | null = null;
let cachedRegularFontB64: string | null = null;
let cachedBoldFontB64: string | null = null;

async function getCsgLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const response = await fetch(csgLogo);
  const blob = await response.blob();
  cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return cachedLogoDataUrl;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Helvetica cannot draw ₱ (shows as ±). Noto Sans includes the peso glyph. */
async function loadUnicodeFonts(): Promise<boolean> {
  if (cachedRegularFontB64 && cachedBoldFontB64) return true;
  try {
    const base = import.meta.env.BASE_URL || "/";
    const [regularRes, boldRes] = await Promise.all([
      fetch(`${base}fonts/NotoSans-Regular.ttf`),
      fetch(`${base}fonts/NotoSans-Bold.ttf`),
    ]);
    if (!regularRes.ok || !boldRes.ok) return false;
    cachedRegularFontB64 = arrayBufferToBase64(await regularRes.arrayBuffer());
    cachedBoldFontB64 = arrayBufferToBase64(await boldRes.arrayBuffer());
    return true;
  } catch {
    return false;
  }
}

function registerUnicodeFonts(doc: jsPDF): boolean {
  if (!cachedRegularFontB64 || !cachedBoldFontB64) return false;
  doc.addFileToVFS("NotoSans-Regular.ttf", cachedRegularFontB64);
  doc.addFont("NotoSans-Regular.ttf", UNICODE_FONT, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", cachedBoldFontB64);
  doc.addFont("NotoSans-Bold.ttf", UNICODE_FONT, "bold");
  return true;
}

function setRgb(doc: jsPDF, color: Rgb): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

export async function downloadPdfTable({
  filename,
  title,
  subtitle,
  head,
  body,
  exportPassword,
  orientation,
  columnTextColors,
  getBodyCellStyle,
}: DownloadPdfTableOptions): Promise<void> {
  const landscape =
    orientation === "landscape" || (orientation == null && head.length > 6);
  const encryptionOptions = exportPassword
    ? { userPassword: exportPassword, ownerPassword: exportPassword, userPermissions: ["print"] as ("print" | "modify" | "copy" | "annot-forms")[] }
    : undefined;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
    encryption: encryptionOptions,
  });
  const margin = landscape ? 40 : 28;
  const pageWidth = doc.internal.pageSize.getWidth();
  const textX = margin + LOGO_SIZE + 10;
  const hasUnicodeFont = (await loadUnicodeFonts()) && registerUnicodeFonts(doc);
  const fontFamily = hasUnicodeFont ? UNICODE_FONT : "helvetica";

  /** Helvetica maps ₱ → ±; fall back to PHP when Unicode font is unavailable. */
  const toPdfText = (value: string | number): string => {
    const text = String(value ?? "");
    if (hasUnicodeFont) return text;
    return text.replace(/\u20B1/g, "PHP ").replace(/₱/g, "PHP ");
  };
  const pdfTitle = toPdfText(title);
  const pdfSubtitle = subtitle != null ? toPdfText(subtitle) : undefined;
  const pdfHead = head.map((h) => toPdfText(h));
  const pdfBody = body.map((row) => row.map((cell) => toPdfText(cell)));

  try {
    const logoDataUrl = await getCsgLogoDataUrl();
    doc.addImage(logoDataUrl, "JPEG", margin, HEADER_TOP, LOGO_SIZE, LOGO_SIZE);
  } catch {
    // Continue without logo if the asset fails to load.
  }

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(10);
  setRgb(doc, BRAND_GREEN);
  doc.text("Northern Mindanao Colleges, Inc.", textX, 36);

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(9);
  setRgb(doc, MUTED_GRAY);
  doc.text(toPdfText("CSG — Central Student Government"), textX, 50);

  let cursorY = HEADER_TOP + LOGO_SIZE + 16;

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(14);
  setRgb(doc, BRAND_GREEN);
  doc.text(pdfTitle, margin, cursorY);
  cursorY += 18;

  if (pdfSubtitle) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    setRgb(doc, MUTED_GRAY);
    const lines = doc.splitTextToSize(pdfSubtitle, pageWidth - margin * 2);
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * 12 + 8;
  } else {
    cursorY += 4;
  }

  const tableFontSize = landscape ? 7 : head.length > 6 ? 6.5 : 8;

  autoTable(doc, {
    startY: cursorY,
    head: [pdfHead],
    body: pdfBody,
    styles: {
      font: fontFamily,
      fontSize: tableFontSize,
      cellPadding: landscape ? 3 : 2.5,
      overflow: "linebreak",
    },
    headStyles: {
      font: fontFamily,
      fontStyle: "bold",
      fillColor: [...BRAND_GREEN],
      textColor: 255,
    },
    alternateRowStyles: {
      fillColor: [...ALT_ROW_FILL],
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rawText = data.cell?.text;
      const cellText = Array.isArray(rawText)
        ? rawText.join(" ")
        : String(rawText ?? data.cell?.raw ?? "");
      const fromFn = getBodyCellStyle?.({
        columnIndex: data.column.index,
        cellText,
      });
      if (fromFn?.textColor) {
        data.cell.styles.textColor = [...fromFn.textColor];
      } else if (columnTextColors) {
        const color = columnTextColors[data.column.index];
        if (color) data.cell.styles.textColor = [...color];
      }
      if (fromFn?.fontStyle) {
        data.cell.styles.fontStyle = fromFn.fontStyle;
      }
    },
  });

  doc.save(filename);
}
