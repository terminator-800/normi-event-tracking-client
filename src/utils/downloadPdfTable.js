import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * @param {{ filename: string, title: string, subtitle?: string, head: string[], body: (string|number)[][] }} opts
 */
export function downloadPdfTable({ filename, title, subtitle, head, body }) {
  const landscape = head.length > 6;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(7, 113, 60);
  doc.text(title, margin, 40);

  let tableStartY = 54;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(subtitle, doc.internal.pageSize.getWidth() - margin * 2);
    doc.text(lines, margin, 56);
    tableStartY = 56 + lines.length * 12 + 8;
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [head],
    body,
    styles: {
      fontSize: landscape ? 7 : 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [7, 113, 60],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [241, 250, 244],
    },
    margin: { left: margin, right: margin },
  });

  doc.save(filename);
}
