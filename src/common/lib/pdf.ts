import PDFDocument from "pdfkit";
import { pino } from "pino";

// ─── Types ──────────────────────────────────────────────────────────

export interface InvoiceData {
    invoiceNumber: string;
    date: string;
    dueDate?: string;
    company: {
        name: string;
        address: string;
        phone?: string;
        email?: string;
    };
    customer: {
        name: string;
        email: string;
        address?: string;
        phone?: string;
    };
    items: Array<{
        name: string;
        description?: string;
        quantity: number;
        price: number;
    }>;
    taxRate?: number; // Percentage (e.g., 11 for 11%)
    notes?: string;
}

export interface CertificateData {
    recipientName: string;
    title: string;
    description: string;
    date: string;
    certificateId: string;
    issuerName: string;
    issuerTitle?: string;
}

export interface ReportData {
    title: string;
    subtitle?: string;
    generatedAt: string;
    headers: string[];
    rows: string[][];
    summary?: Record<string, string | number>;
}

// ─── PDF Generator ──────────────────────────────────────────────────

const logger = pino({ name: "pdf-generator" });

function formatCurrency(amount: number): string {
    return `Rp ${amount.toLocaleString("id-ID")}`;
}

export class PdfGenerator {
    /**
     * Generate an invoice PDF as a Buffer.
     */
    static async generateInvoice(data: InvoiceData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: "A4", margin: 50 });
                const chunks: Buffer[] = [];

                doc.on("data", (chunk: Buffer) => chunks.push(chunk));
                doc.on("end", () => resolve(Buffer.concat(chunks)));
                doc.on("error", reject);

                // ─── Header ─────────────────────────────
                doc.fontSize(28).font("Helvetica-Bold").text("INVOICE", { align: "right" });
                doc.fontSize(10).font("Helvetica").fillColor("#666666");
                doc.text(`#${data.invoiceNumber}`, { align: "right" });
                doc.text(`Date: ${data.date}`, { align: "right" });
                if (data.dueDate) {
                    doc.text(`Due: ${data.dueDate}`, { align: "right" });
                }

                doc.moveDown(2);

                // ─── Company & Customer Info ────────────
                const startY = doc.y;

                doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
                doc.text("FROM:", 50, startY);
                doc.font("Helvetica").fillColor("#555555");
                doc.text(data.company.name);
                doc.text(data.company.address);
                if (data.company.phone) doc.text(data.company.phone);
                if (data.company.email) doc.text(data.company.email);

                doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
                doc.text("TO:", 300, startY);
                doc.font("Helvetica").fillColor("#555555");
                doc.text(data.customer.name, 300);
                doc.text(data.customer.email, 300);
                if (data.customer.address) doc.text(data.customer.address, 300);
                if (data.customer.phone) doc.text(data.customer.phone, 300);

                doc.moveDown(3);

                // ─── Items Table ────────────────────────
                const tableTop = doc.y;
                const colWidths = { item: 200, qty: 60, price: 110, total: 110 };
                const colX = {
                    item: 50,
                    qty: 260,
                    price: 330,
                    total: 440,
                };

                // Table header
                doc.rect(50, tableTop, 500, 25).fill("#f0f0f0");
                doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
                doc.text("Item", colX.item + 5, tableTop + 7, { width: colWidths.item });
                doc.text("Qty", colX.qty, tableTop + 7, { width: colWidths.qty, align: "center" });
                doc.text("Price", colX.price, tableTop + 7, { width: colWidths.price, align: "right" });
                doc.text("Total", colX.total, tableTop + 7, { width: colWidths.total, align: "right" });

                // Table rows
                let y = tableTop + 30;
                let subtotal = 0;

                doc.font("Helvetica").fontSize(9).fillColor("#555555");
                for (const item of data.items) {
                    const itemTotal = item.quantity * item.price;
                    subtotal += itemTotal;

                    doc.text(item.name, colX.item + 5, y, { width: colWidths.item });
                    doc.text(String(item.quantity), colX.qty, y, { width: colWidths.qty, align: "center" });
                    doc.text(formatCurrency(item.price), colX.price, y, { width: colWidths.price, align: "right" });
                    doc.text(formatCurrency(itemTotal), colX.total, y, { width: colWidths.total, align: "right" });

                    y += 22;
                    doc.moveTo(50, y - 5).lineTo(550, y - 5).strokeColor("#eeeeee").stroke();
                }

                // ─── Totals ─────────────────────────────
                y += 10;
                doc.font("Helvetica").fontSize(10).fillColor("#555555");
                doc.text("Subtotal:", colX.price, y, { width: colWidths.price, align: "right" });
                doc.text(formatCurrency(subtotal), colX.total, y, { width: colWidths.total, align: "right" });

                if (data.taxRate) {
                    y += 20;
                    const tax = Math.round(subtotal * (data.taxRate / 100));
                    doc.text(`Tax (${data.taxRate}%):`, colX.price, y, { width: colWidths.price, align: "right" });
                    doc.text(formatCurrency(tax), colX.total, y, { width: colWidths.total, align: "right" });

                    y += 25;
                    doc.font("Helvetica-Bold").fontSize(12).fillColor("#333333");
                    doc.text("TOTAL:", colX.price, y, { width: colWidths.price, align: "right" });
                    doc.text(formatCurrency(subtotal + tax), colX.total, y, { width: colWidths.total, align: "right" });
                } else {
                    y += 25;
                    doc.font("Helvetica-Bold").fontSize(12).fillColor("#333333");
                    doc.text("TOTAL:", colX.price, y, { width: colWidths.price, align: "right" });
                    doc.text(formatCurrency(subtotal), colX.total, y, { width: colWidths.total, align: "right" });
                }

                // ─── Notes ──────────────────────────────
                if (data.notes) {
                    y += 40;
                    doc.font("Helvetica-Bold").fontSize(10).fillColor("#333333");
                    doc.text("Notes:", 50, y);
                    doc.font("Helvetica").fontSize(9).fillColor("#777777");
                    doc.text(data.notes, 50, y + 15, { width: 500 });
                }

                doc.end();
                logger.info({ invoiceNumber: data.invoiceNumber }, "Invoice PDF generated");
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate a certificate PDF as a Buffer.
     */
    static async generateCertificate(data: CertificateData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 50 });
                const chunks: Buffer[] = [];

                doc.on("data", (chunk: Buffer) => chunks.push(chunk));
                doc.on("end", () => resolve(Buffer.concat(chunks)));
                doc.on("error", reject);

                const pageWidth = doc.page.width;
                const centerX = pageWidth / 2;

                // Border
                doc.rect(30, 30, pageWidth - 60, doc.page.height - 60)
                    .lineWidth(3)
                    .strokeColor("#667eea")
                    .stroke();
                doc.rect(35, 35, pageWidth - 70, doc.page.height - 70)
                    .lineWidth(1)
                    .strokeColor("#764ba2")
                    .stroke();

                // Title
                doc.moveDown(3);
                doc.fontSize(14).font("Helvetica").fillColor("#667eea")
                    .text("CERTIFICATE OF COMPLETION", { align: "center" });

                doc.moveDown(1);
                doc.fontSize(36).font("Helvetica-Bold").fillColor("#333333")
                    .text(data.title, { align: "center" });

                doc.moveDown(1);
                doc.fontSize(14).font("Helvetica").fillColor("#666666")
                    .text("This is to certify that", { align: "center" });

                doc.moveDown(0.5);
                doc.fontSize(28).font("Helvetica-Bold").fillColor("#667eea")
                    .text(data.recipientName, { align: "center" });

                doc.moveDown(0.5);
                doc.fontSize(12).font("Helvetica").fillColor("#666666")
                    .text(data.description, { align: "center", width: 500, indent: (pageWidth - 500) / 2 - 50 });

                doc.moveDown(2);
                doc.fontSize(10).fillColor("#999999")
                    .text(`Date: ${data.date}`, { align: "center" });
                doc.text(`Certificate ID: ${data.certificateId}`, { align: "center" });

                doc.moveDown(2);
                doc.moveTo(centerX - 80, doc.y).lineTo(centerX + 80, doc.y).strokeColor("#333333").stroke();
                doc.moveDown(0.5);
                doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333")
                    .text(data.issuerName, { align: "center" });
                if (data.issuerTitle) {
                    doc.fontSize(10).font("Helvetica").fillColor("#666666")
                        .text(data.issuerTitle, { align: "center" });
                }

                doc.end();
                logger.info({ certificateId: data.certificateId }, "Certificate PDF generated");
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate a tabular report PDF as a Buffer.
     */
    static async generateReport(data: ReportData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: "A4", margin: 40 });
                const chunks: Buffer[] = [];

                doc.on("data", (chunk: Buffer) => chunks.push(chunk));
                doc.on("end", () => resolve(Buffer.concat(chunks)));
                doc.on("error", reject);

                // Title
                doc.fontSize(20).font("Helvetica-Bold").fillColor("#333333")
                    .text(data.title, { align: "center" });
                if (data.subtitle) {
                    doc.fontSize(12).font("Helvetica").fillColor("#666666")
                        .text(data.subtitle, { align: "center" });
                }
                doc.fontSize(8).fillColor("#999999")
                    .text(`Generated: ${data.generatedAt}`, { align: "center" });

                doc.moveDown(2);

                // Table
                const colCount = data.headers.length;
                const availableWidth = doc.page.width - 80;
                const colWidth = availableWidth / colCount;
                const startX = 40;
                let y = doc.y;

                // Header row
                doc.rect(startX, y, availableWidth, 22).fill("#f0f0f0");
                doc.font("Helvetica-Bold").fontSize(8).fillColor("#333333");
                for (let i = 0; i < colCount; i++) {
                    doc.text(data.headers[i], startX + i * colWidth + 4, y + 6, { width: colWidth - 8 });
                }
                y += 25;

                // Data rows
                doc.font("Helvetica").fontSize(8).fillColor("#555555");
                for (const row of data.rows) {
                    if (y > doc.page.height - 80) {
                        doc.addPage();
                        y = 40;
                    }
                    for (let i = 0; i < colCount; i++) {
                        doc.text(row[i] || "", startX + i * colWidth + 4, y, { width: colWidth - 8 });
                    }
                    y += 18;
                    doc.moveTo(startX, y - 3).lineTo(startX + availableWidth, y - 3).strokeColor("#eeeeee").stroke();
                }

                // Summary
                if (data.summary) {
                    y += 20;
                    doc.font("Helvetica-Bold").fontSize(10).fillColor("#333333");
                    doc.text("Summary", startX, y);
                    y += 18;
                    doc.font("Helvetica").fontSize(9).fillColor("#555555");
                    for (const [key, value] of Object.entries(data.summary)) {
                        doc.text(`${key}: ${value}`, startX, y);
                        y += 15;
                    }
                }

                doc.end();
                logger.info({ title: data.title }, "Report PDF generated");
            } catch (error) {
                reject(error);
            }
        });
    }
}
