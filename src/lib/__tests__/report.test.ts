import { buildReportCsv, buildReportMatrix, reportFileName } from '@/lib/report';
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
        color: '#00652e',
        points: [
          { key: '2026-10-02', label: '2026-10-02', value: 3 },
          { key: '2026-10-01', label: '2026-10-01', value: 1 },
        ],
      },
      {
        name: 'Canceladas',
        color: '#e11d48',
        points: [{ key: '2026-10-01', label: '2026-10-01', value: 2 }],
      },
    ],
    rows: [
      {
        date: '2026-10-01',
        student: 'Ana "La Jefa" Pérez',
        email: 'ana@tdea.edu.co',
        sex: 'Femenino',
        acude: 'Fútbol',
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

describe('report helpers', () => {
  it('ordena las claves cronológicas y combina las series', () => {
    const matrix = buildReportMatrix(makeReport());
    expect(matrix.keys).toEqual(['2026-10-01', '2026-10-02']);
    expect(matrix.rows).toEqual([
      { key: '2026-10-01', label: '2026-10-01', values: [1, 2] },
      { key: '2026-10-02', label: '2026-10-02', values: [3, 0] },
    ]);
  });

  it('respeta el orden de las series para agrupaciones no temporales', () => {
    const matrix = buildReportMatrix(
      makeReport({
        groupBy: 'acude',
        series: [
          {
            name: 'Activas',
            points: [
              { key: 'b', label: 'Teatro', value: 2 },
              { key: 'a', label: 'Fútbol', value: 5 },
            ],
          },
          { name: 'Canceladas', points: [] },
        ],
      }),
    );
    expect(matrix.rows.map((row) => row.label)).toEqual(['Teatro', 'Fútbol']);
  });

  it('genera CSV con BOM, cabecera y comillas escapadas', () => {
    const csv = buildReportCsv(makeReport());
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Fecha","Estudiante","Correo"');
    expect(csv).toContain('"Ana ""La Jefa"" Pérez"');
    expect(csv).toContain('"2026-10-01"');
  });

  it('construye un nombre de archivo seguro', () => {
    expect(reportFileName(makeReport())).toBe(
      'canchaya-enrollments-2026-10-01-2026-10-31.csv',
    );
    expect(
      reportFileName(makeReport({ kind: 'attendance', from: '', to: '' })),
    ).toBe('canchaya-attendance-inicio-hoy.csv');
  });
});
