"use client";

export interface ExportColumnDef {
  key: string;
  label: string;
}

export async function downloadExportRows(options: {
  rows: Record<string, unknown>[];
  columns: ExportColumnDef[];
  format: "CSV" | "XLSX" | "PDF";
  fileName: string;
  sheetName?: string;
  title?: string;
}): Promise<void> {
  const { rows, columns, format, fileName, sheetName = "Export", title = "Export" } = options;

  if (format === "PDF") {
    const headersHtml = columns
      .map((c) => `<th style="text-align:left;padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9;font-size:11px;">${escapeHtml(c.label)}</th>`)
      .join("");
    const bodyHtml = rows
      .map(
        (row) =>
          `<tr>${columns
            .map(
              (c) =>
                `<td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;">${escapeHtml(
                  row[c.key] == null ? "" : String(row[c.key])
                )}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#0f172a;">
  <h2 style="margin:0 0 8px 0;">${escapeHtml(title)}</h2>
  <p style="margin:0 0 16px 0;font-size:12px;color:#475569;">Generated ${new Date().toLocaleString("en-IN")} · ${rows.length} records</p>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
</body>
</html>`;

    const printWin = window.open("", "_blank", "noopener,noreferrer");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 250);
    } else {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      triggerBlobDownload(blob, `${fileName}.html`);
    }
    return;
  }

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(16, c.label.length + 6),
  }));

  for (const row of rows) {
    const record: Record<string, unknown> = {};
    for (const col of columns) {
      record[col.key] = row[col.key] ?? "";
    }
    worksheet.addRow(record);
  }

  if (format === "CSV") {
    const buffer = await workbook.csv.writeBuffer();
    const blob = new Blob([buffer], { type: "text/csv;charset=utf-8;" });
    triggerBlobDownload(blob, `${fileName}.csv`);
  } else {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerBlobDownload(blob, `${fileName}.xlsx`);
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
