import type { ReportResult, ReportRow } from '@/types';

export interface ReportMatrixRow {
  key: string;
  label: string;
  values: number[];
}

export interface ReportMatrix {
  keys: string[];
  labels: Map<string, string>;
  rows: ReportMatrixRow[];
}

/**
 * Une las series del reporte en una matriz por etiqueta. Se usa tanto para la
 * gráfica nativa como para la tabla de desglose.
 */
export function buildReportMatrix(report: ReportResult): ReportMatrix {
  const labels = new Map<string, string>();
  for (const series of report.series) {
    for (const point of series.points) labels.set(point.key, point.label);
  }

  const keys = [...labels.keys()];
  if (report.groupBy === 'date' || report.groupBy === 'week' || report.groupBy === 'month') {
    keys.sort((a, b) => a.localeCompare(b));
  }

  const rows = keys.map((key) => ({
    key,
    label: labels.get(key) ?? key,
    values: report.series.map(
      (series) => series.points.find((point) => point.key === key)?.value ?? 0,
    ),
  }));

  return { keys, labels, rows };
}

const CSV_HEADER = [
  'Fecha',
  'Estudiante',
  'Correo',
  'Sexo',
  'ACUDE',
  'Franja',
  'Escenario',
  'Docente',
  'Categoría',
  'Disciplina',
  'Estado',
];

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function rowToCsv(row: ReportRow): string {
  return [
    row.date,
    row.student,
    row.email,
    row.sex,
    row.acude,
    row.slot,
    row.scenario,
    row.teacher,
    row.category,
    row.discipline,
    row.status,
  ]
    .map(csvCell)
    .join(',');
}

/** CSV con BOM para que Excel respete tildes y caracteres especiales. */
export function buildReportCsv(report: ReportResult): string {
  return [
    `\uFEFF${CSV_HEADER.map(csvCell).join(',')}`,
    ...report.rows.map(rowToCsv),
  ].join('\r\n');
}

export function reportFileName(report: ReportResult): string {
  return `canchaya-${report.kind}-${report.from || 'inicio'}-${report.to || 'hoy'}.csv`;
}
