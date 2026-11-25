import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface LibraryXLSXRow {
  accessionNumber: string;
  title: string;
  author: string;
  category: string;
  totalCopies: number;
  issuedCopies: number;
  availableCopies: number;
}

const COLUMNS: XLSXColumnDef<LibraryXLSXRow>[] = [
  { key: "accessionNumber", header: "Accession No.", type: "string", minWidth: 16 },
  { key: "title", header: "Book Title", type: "string", minWidth: 28 },
  { key: "author", header: "Author", type: "string", minWidth: 20 },
  { key: "category", header: "Category", type: "string", minWidth: 16 },
  { key: "totalCopies", header: "Total Copies", type: "number", minWidth: 14 },
  { key: "issuedCopies", header: "Issued Copies", type: "number", minWidth: 14 },
  { key: "availableCopies", header: "Available Copies", type: "number", minWidth: 16 },
];

export async function generateLibraryXLSX(rows: LibraryXLSXRow[]): Promise<Buffer> {
  return buildStyledXLSX("Library Report", COLUMNS, rows);
}
