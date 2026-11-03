import { buildReportPdfHtml, reportPdfFileName } from '@/lib/report-pdf';
import type { ReportResult } from '@/types';

function makeReport(overrides: Partial<ReportResult> = {}): ReportResult {
  return {
    kind: 'enrollments',
    groupBy: 'date',
    from: '2026-10-01',
    to: '2026-10-31',
    series: [
      {
        name: 'Activas',
        points: [{ key: '2026-10-01', label: '2026-10-01', value: 1 }],
      },
    ],
    rows: [
      {
        date: '2026-10-01',
        student: 'Ana "La Jefa" Pérez',
        email: 'ana@tdea.edu.co',
        sex: 'Femenino',
        acude: 'Fútbol <formativo>',
        slot: 'Lunes 10:00-12:00',
        scenario: 'Cancha 1',
        teacher: 'Docente Uno',
        category: 'Deportiva',
        discipline: 'Fútbol',
        status: 'Activa',
      },
    ],
    summary: {
      total: 1,
      active: 1,
      canceled: 0,
      present: 0,
      absent: 0,
      attendanceRate: 0,
    },
    generatedAt: '2026-10-31T13:00:00.000Z',
    serverTime: '2026-10-31T13:00:00.000Z',
    ...overrides,
  };
}

describe('report PDF helpers', () => {
  it('escapa el contenido de las celdas', () => {
    const html = buildReportPdfHtml(makeReport());
    expect(html).toContain('Ana &quot;La Jefa&quot; Pérez');
    expect(html).toContain('Fútbol &lt;formativo&gt;');
    expect(html).toContain('Reporte de eventos de inscripción');
  });

  it('incluye un estado vacío cuando no hay registros', () => {
    const html = buildReportPdfHtml(makeReport({ rows: [], series: [] }));
    expect(html).toContain('Sin registros para los filtros seleccionados.');
  });

  it('genera un nombre de archivo PDF seguro', () => {
    expect(reportPdfFileName(makeReport())).toBe(
      'canchaya-enrollments-2026-10-01-2026-10-31.pdf',
    );
  });
});
