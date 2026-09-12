/**
 * Centralized Mobile PDF HTML Template Builders
 *
 * Provides standardized, reusable HTML templates and styles for expo-print
 * across mobile features (Operations Logs, Machine Directory, etc.).
 * Guarantees visual consistency with the Web PDF reports.
 */

export interface PdfMetaItem {
  label: string;
  value: string;
}

export interface PdfKpiItem {
  label: string;
  value: string;
  color?: string;
}

export interface PdfSignatureColumn {
  title: string;
  name: string;
  subtitle: string;
  dateLabel?: string;
  signLabel?: string;
}

export interface PdfHtmlTemplateOptions {
  orientation?: 'portrait' | 'landscape';
}

/**
 * Common print CSS styles for mobile HTML-to-PDF rendering
 */
export function buildPdfHtmlStyles(options: PdfHtmlTemplateOptions = {}): string {
  const { orientation = 'portrait' } = options;

  return `
    @page {
      size: A4 ${orientation};
      margin: 8mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #171717;
      background-color: #ffffff;
      margin: 0;
      padding: ${orientation === 'landscape' ? '8px' : '6px'};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #171717;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .title {
      font-size: ${orientation === 'landscape' ? '18px' : '16px'};
      font-weight: 900;
      text-align: center;
      margin: 0 0 4px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #171717;
    }
    .subtitle {
      font-size: 9.5px;
      font-weight: 700;
      text-align: center;
      color: #171717;
      margin-bottom: 6px;
      text-transform: uppercase;
      line-height: 1.35;
      word-break: break-word;
    }
    .meta-grid {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 9.5px;
      background: #f5f5f5;
      padding: 6px 10px;
      border-radius: 6px;
      margin-top: 6px;
      border: 1px solid #e5e5e5;
    }
    .kpi-strip {
      display: grid;
      gap: 6px;
      background: #f5f5f5;
      color: #171717;
      border: 1px solid #d4d4d4;
      padding: 8px;
      border-radius: 8px;
      margin: 10px 0;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kpi-label {
      font-size: 8px;
      text-transform: uppercase;
      font-weight: 800;
      color: #525252;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 13px;
      font-weight: 900;
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px auto;
      table-layout: fixed;
      border: 1px solid #171717;
      text-align: center;
    }
    th {
      background-color: #f3f4f6;
      border: 1px solid #171717;
      padding: 6px 3px;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 900;
      text-align: center;
      vertical-align: middle;
      color: #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    td {
      border: 1px solid #d4d4d4;
      vertical-align: middle;
      text-align: center;
      padding: 5px 4px;
    }
    tr {
      page-break-inside: avoid;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #d4d4d4;
      text-align: center;
      font-size: 9.5px;
      page-break-inside: avoid;
    }
    .sig-col {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .sig-title {
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 9px;
      color: #171717;
    }
    .sig-line {
      width: 130px;
      border-bottom: 1px solid #a3a3a3;
      margin: 4px 0 2px 0;
      height: 22px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      font-weight: 900;
      font-size: 9.5px;
      text-transform: uppercase;
      color: #171717;
    }
    .sig-sub {
      font-weight: 700;
      font-size: 8.5px;
      color: #525252;
    }
    .sig-dates {
      display: flex;
      justify-content: space-between;
      width: 130px;
      font-size: 8px;
      color: #525252;
      margin-top: 4px;
      font-family: monospace;
    }
  `;
}

/**
 * Builds the HTML report header with title, subtitle, and metadata grid
 */
export function buildPdfHtmlHeader(params: {
  title: string;
  subtitle?: string;
  metaItems: PdfMetaItem[];
}): string {
  const { title, subtitle, metaItems } = params;

  const metaItemsHtml = metaItems
    .map((item) => `<div><strong>${item.label}:</strong> ${item.value}</div>`)
    .join('\n');

  return `
    <div class="header">
      <h1 class="title">${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      <div class="meta-grid">
        ${metaItemsHtml}
      </div>
    </div>
  `;
}

/**
 * Builds the HTML KPI metrics strip
 */
export function buildPdfHtmlKpiStrip(items: PdfKpiItem[]): string {
  const columnsCount = items.length;
  const itemsHtml = items
    .map(
      (item) => `
        <div>
          <div class="kpi-label">${item.label}</div>
          <div class="kpi-value"${item.color ? ` style="color: ${item.color};"` : ''}>${item.value}</div>
        </div>
      `
    )
    .join('\n');

  return `
    <div class="kpi-strip" style="grid-template-columns: repeat(${columnsCount}, 1fr);">
      ${itemsHtml}
    </div>
  `;
}

/**
 * Builds the 3-column verification and signature block
 */
export function buildPdfHtmlSignatureBlock(columns: PdfSignatureColumn[]): string {
  const colsHtml = columns
    .map(
      (col) => `
        <div class="sig-col">
          <span class="sig-title">${col.title}</span>
          <div class="sig-line">
            ${col.name}
          </div>
          <span class="sig-sub">${col.subtitle}</span>
          <div class="sig-dates">
            <span>${col.signLabel || 'Sign: _______'}</span>
            <span>${col.dateLabel || 'Date: _______'}</span>
          </div>
        </div>
      `
    )
    .join('\n');

  return `
    <div class="signatures">
      ${colsHtml}
    </div>
  `;
}

/**
 * Wraps generated HTML inside a full <!DOCTYPE html> document with centralized styles
 */
export function buildPdfHtmlWrapper(params: {
  title: string;
  bodyContent: string;
  customStyles?: string;
  orientation?: 'portrait' | 'landscape';
}): string {
  const { title, bodyContent, customStyles = '', orientation = 'portrait' } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          ${buildPdfHtmlStyles({ orientation })}
          ${customStyles}
        </style>
      </head>
      <body>
        ${bodyContent}
      </body>
    </html>
  `;
}
