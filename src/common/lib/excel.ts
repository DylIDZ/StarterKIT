import ExcelJS from "exceljs";
import { pino } from "pino";

// ─── Types ──────────────────────────────────────────────────────────

export interface ExcelColumn {
    header: string;
    key: string;
    width?: number;
}

export interface ExportOptions {
    sheetName?: string;
    columns: ExcelColumn[];
    headerStyle?: Partial<ExcelJS.Style>;
}

export interface ImportResult<T> {
    data: T[];
    errors: Array<{ row: number; message: string }>;
    totalRows: number;
}

// ─── Excel Manager ──────────────────────────────────────────────────

const logger = pino({ name: "excel" });

export class ExcelManager {
    /**
     * Export data to an Excel (.xlsx) Buffer.
     */
    static async exportToExcel<T extends Record<string, unknown>>(
        data: T[],
        options: ExportOptions,
    ): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "StarterKit";
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet(options.sheetName || "Sheet1");
        worksheet.columns = options.columns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width || 20,
        }));

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF667EEA" },
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };
        headerRow.height = 25;

        if (options.headerStyle) {
            Object.assign(headerRow, options.headerStyle);
        }

        // Add data rows
        for (const row of data) {
            worksheet.addRow(row);
        }

        // Auto-filter
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: data.length + 1, column: options.columns.length },
        };

        const buffer = await workbook.xlsx.writeBuffer();
        logger.info({ rows: data.length, sheet: options.sheetName }, "Excel file generated");
        return Buffer.from(buffer);
    }

    /**
     * Export data to a CSV Buffer.
     */
    static async exportToCsv<T extends Record<string, unknown>>(
        data: T[],
        options: ExportOptions,
    ): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(options.sheetName || "Sheet1");

        worksheet.columns = options.columns.map((col) => ({
            header: col.header,
            key: col.key,
        }));

        for (const row of data) {
            worksheet.addRow(row);
        }

        const buffer = await workbook.csv.writeBuffer();
        logger.info({ rows: data.length }, "CSV file generated");
        return Buffer.from(buffer);
    }

    /**
     * Import data from an Excel (.xlsx) Buffer.
     */
    static async importFromExcel<T extends Record<string, unknown>>(
        buffer: Buffer,
        columnMapping: Record<string, string>, // header text -> object key
        sheetIndex = 0,
    ): Promise<ImportResult<T>> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

        const worksheet = workbook.worksheets[sheetIndex];
        if (!worksheet) {
            throw new Error(`Sheet at index ${sheetIndex} not found`);
        }

        const results: T[] = [];
        const errors: Array<{ row: number; message: string }> = [];

        // Map header row to column indices
        const headerRow = worksheet.getRow(1);
        const headerMap: Map<number, string> = new Map();

        headerRow.eachCell((cell, colNumber) => {
            const headerText = String(cell.value || "").trim();
            const mappedKey = columnMapping[headerText];
            if (mappedKey) {
                headerMap.set(colNumber, mappedKey);
            }
        });

        // Parse data rows
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            try {
                const obj: Record<string, unknown> = {};
                row.eachCell((cell, colNumber) => {
                    const key = headerMap.get(colNumber);
                    if (key) {
                        obj[key] = cell.value;
                    }
                });

                if (Object.keys(obj).length > 0) {
                    results.push(obj as T);
                }
            } catch (error) {
                errors.push({
                    row: rowNumber,
                    message: (error as Error).message,
                });
            }
        });

        logger.info({ totalRows: results.length, errors: errors.length }, "Excel import completed");
        return { data: results, errors, totalRows: results.length };
    }

    /**
     * Import data from a CSV Buffer.
     */
    static async importFromCsv<T extends Record<string, unknown>>(
        buffer: Buffer,
        columnMapping: Record<string, string>,
    ): Promise<ImportResult<T>> {
        const workbook = new ExcelJS.Workbook();
        await workbook.csv.read(buffer as any);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            throw new Error("No worksheet found in CSV");
        }

        const results: T[] = [];
        const errors: Array<{ row: number; message: string }> = [];

        const headerRow = worksheet.getRow(1);
        const headerMap: Map<number, string> = new Map();

        headerRow.eachCell((cell, colNumber) => {
            const headerText = String(cell.value || "").trim();
            const mappedKey = columnMapping[headerText];
            if (mappedKey) {
                headerMap.set(colNumber, mappedKey);
            }
        });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            try {
                const obj: Record<string, unknown> = {};
                row.eachCell((cell, colNumber) => {
                    const key = headerMap.get(colNumber);
                    if (key) {
                        obj[key] = cell.value;
                    }
                });

                if (Object.keys(obj).length > 0) {
                    results.push(obj as T);
                }
            } catch (error) {
                errors.push({ row: rowNumber, message: (error as Error).message });
            }
        });

        logger.info({ totalRows: results.length, errors: errors.length }, "CSV import completed");
        return { data: results, errors, totalRows: results.length };
    }
}
