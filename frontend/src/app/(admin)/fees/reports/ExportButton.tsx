"use client";

import ExcelJS from "exceljs";

export function ExportButton({
  data,
  filename = "export.xlsx",
}: {
  data: any[];
  filename?: string;
}) {
  const handleExport = async () => {
    if (!data || data.length === 0) {
      alert("No data available to export");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data");

    const columns = Object.keys(data[0] || {}).map((key) => ({
      header: key,
      key: key,
      width: 20,
    }));
    worksheet.columns = columns;

    data.forEach((row) => {
      worksheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="bg-green-600 text-white font-medium py-2 px-4 rounded-md hover:bg-green-700 flex items-center space-x-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      <span>Export to Excel</span>
    </button>
  );
}
