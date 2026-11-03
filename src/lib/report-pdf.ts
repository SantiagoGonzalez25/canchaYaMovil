import { REPORT_GROUP_LABELS, REPORT_KIND_LABELS } from './labels';
import { buildReportMatrix } from './report';
import type { ReportResult } from '@/types';

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(date);
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 16);
  }
}

/**
 * Documento HTML autocontenido para `expo-print`. No usa recursos externos:
 * así el PDF se genera igual en Android, iOS y web.
 */
export function buildReportPdfHtml(report: ReportResult): string {
  const matrix = buildReportMatrix(report);
  const kindLabel = REPORT_KIND_LABELS[report.kind];
  const groupLabel = REPORT_GROUP_LABELS[report.groupBy];
  const summary =
    report.kind === 'attendance'
      ? [
          ['Registros', report.summary.total],
          ['Asistencias', report.summary.present],
          ['Ausencias', report.summary.absent],
          ['Tasa de asistencia', `${report.summary.attendanceRate}%`],
        ]
      : [
          ['Eventos', report.summary.total],
          ['Activas', report.summary.active],
          ['Canceladas', report.summary.canceled],
          [
            'Tasa de cancelación',
            `${
              report.summary.total > 0
                ? Math.round((report.summary.canceled / report.summary.total) * 100)
                : 0
            }%`,
          ],
        ];

  const summaryCards = summary
    .map(
      ([label, value]) => `
        <div class="card">
          <span class="card-label">${escapeHtml(label)}</span>
          <strong class="card-value">${escapeHtml(value)}</strong>
        </div>`,
    )
    .join('');

  const matrixHeader = report.series
    .map((series) => `<th>${escapeHtml(series.name)}</th>`)
    .join('');

  const matrixRows = matrix.rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          ${row.values.map((value) => `<td class="number">${escapeHtml(value)}</td>`).join('')}
        </tr>`,
    )
    .join('');

  const detailRows = report.rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.student)}</td>
          <td>${escapeHtml(row.acude)}</td>
          <td>${escapeHtml(row.slot)}</td>
          <td>${escapeHtml(row.scenario)}</td>
          <td>${escapeHtml(row.teacher)}</td>
          <td>${escapeHtml(row.status)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 16mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 10px;
      line-height: 1.4;
    }
    .brand { color: #00652e; font-weight: 800; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
    h1 { margin: 4px 0 6px; font-size: 22px; color: #004a22; }
    h2 { margin: 18px 0 8px; font-size: 13px; color: #004a22; border-bottom: 1px solid #d7e3c2; padding-bottom: 4px; }
    .meta { color: #475569; font-size: 10px; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .card { flex: 1 1 25%; min-width: 110px; border: 1px solid #dbe5cc; background: #f7f9f2; border-radius: 8px; padding: 9px 10px; }
    .card-label { display: block; color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; }
    .card-value { display: block; margin-top: 3px; font-size: 16px; color: #00652e; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #f5f9e9; color: #004a22; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .02em; padding: 7px 6px; border-bottom: 1px solid #cfdcc0; }
    td { padding: 6px; border-bottom: 1px solid #e8eee1; vertical-align: top; }
    tr:nth-child(even) td { background: #fbfcf8; }
    td.number { text-align: right; font-variant-numeric: tabular-nums; }
    .empty { color: #64748b; padding: 12px 0; }
    footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 8px; }
  </style>
</head>
<body>
  <div class="brand">CanchaYa · Bienestar Institucional TdeA</div>
  <h1>Reporte de ${escapeHtml(kindLabel.toLowerCase())}</h1>
  <div class="meta">
    Agrupación: ${escapeHtml(groupLabel)} · Rango: ${escapeHtml(report.from || 'sin límite')} → ${escapeHtml(report.to || 'hoy')} · Generado: ${escapeHtml(formatGeneratedAt(report.generatedAt))}
  </div>

  <div class="summary">${summaryCards}</div>

  <h2>Resumen por ${escapeHtml(groupLabel.toLowerCase())}</h2>
  ${
    matrix.rows.length === 0
      ? '<p class="empty">Sin datos para los filtros seleccionados.</p>'
      : `<table>
          <thead><tr><th>${escapeHtml(groupLabel)}</th>${matrixHeader}</tr></thead>
          <tbody>${matrixRows}</tbody>
        </table>`
  }

  <h2>Registros (${report.rows.length})</h2>
  ${
    report.rows.length === 0
      ? '<p class="empty">Sin registros para los filtros seleccionados.</p>'
      : `<table>
          <thead>
            <tr>
              <th>Fecha</th><th>Estudiante</th><th>ACUDE</th><th>Franja</th>
              <th>Escenario</th><th>Docente</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>`
  }

  <footer>Documento generado por CanchaYa. Las cifras corresponden a los filtros aplicados al momento de la exportación.</footer>
</body>
</html>`;
}

export function reportPdfFileName(report: ReportResult): string {
  return `canchaya-${report.kind}-${report.from || 'inicio'}-${report.to || 'hoy'}.pdf`;
}
