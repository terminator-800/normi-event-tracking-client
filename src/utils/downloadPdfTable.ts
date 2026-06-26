import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import csgLogo from "../assets/CSG LOGO.jpg";

type Rgb = readonly [number, number, number];

export type DownloadPdfTableOptions = {
  filename: string;
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
};

const LOGO_SIZE = 38;
const HEADER_TOP = 22;
const BRAND_GREEN: Rgb = [7, 113, 60];
const MUTED_GRAY: Rgb = [80, 80, 80];
const ALT_ROW_FILL: Rgb = [241, 250, 244];

let cachedLogoDataUrl: string | null = null;

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

function setRgb(doc: jsPDF, color: Rgb): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

export async function downloadPdfTable({
  filename,
  title,
  subtitle,
  head,
  body,
}: DownloadPdfTableOptions): Promise<void> {
  const landscape = head.length > 6;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const textX = margin + LOGO_SIZE + 10;

  try {
    const logoDataUrl = await getCsgLogoDataUrl();
    doc.addImage(logoDataUrl, "JPEG", margin, HEADER_TOP, LOGO_SIZE, LOGO_SIZE);
  } catch {
    // Continue without logo if the asset fails to load.
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setRgb(doc, BRAND_GREEN);
  doc.text("Northern Mindanao Colleges, Inc.", textX, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setRgb(doc, MUTED_GRAY);
  doc.text("CSG — Central Student Government", textX, 50);

  let cursorY = HEADER_TOP + LOGO_SIZE + 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setRgb(doc, BRAND_GREEN);
  doc.text(title, margin, cursorY);
  cursorY += 18;

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setRgb(doc, MUTED_GRAY);
    const lines = doc.splitTextToSize(subtitle, pageWidth - margin * 2);
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * 12 + 8;
  } else {
    cursorY += 4;
  }

  autoTable(doc, {
    startY: cursorY,
    head: [head],
    body,
    styles: {
      fontSize: landscape ? 7 : 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [...BRAND_GREEN],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [...ALT_ROW_FILL],
    },
    margin: { left: margin, right: margin },
  });

  doc.save(filename);
}
