export type ExportColumn<T> = {
  key: keyof T | string;
  label: string;
  value?: (row: T) => unknown;
};

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadBlob = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const exportRowsAsCsv = <T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
) => {
  const header = columns.map((column) => csvCell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => {
    const value = column.value ? column.value(row) : row[String(column.key)];
    return csvCell(value);
  }).join(','));
  downloadBlob(filename, `\uFEFF${[header, ...body].join('\n')}`, 'text/csv;charset=utf-8');
};

export const exportJsonReport = (filename: string, value: unknown) => {
  downloadBlob(filename, JSON.stringify(value, null, 2), 'application/json;charset=utf-8');
};

export const timestampedFilename = (prefix: string, extension: string) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}.${extension}`;
};
