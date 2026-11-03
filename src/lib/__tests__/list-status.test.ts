import { listStatusHeadline, resolveListStatus, syncHeadline } from '@/lib/list-status';

describe('list status', () => {
  it('prioriza datos visibles sobre la recarga', () => {
    expect(
      resolveListStatus({
        loading: true,
        refreshing: true,
        error: null,
        hasData: true,
        online: true,
      }),
    ).toBe('refreshing');
    expect(
      resolveListStatus({
        loading: false,
        refreshing: false,
        error: 'falló',
        hasData: true,
        online: true,
      }),
    ).toBe('ready');
  });

  it('distingue carga, error, offline y vacío', () => {
    expect(
      resolveListStatus({ loading: true, refreshing: false, error: null, hasData: false, online: true }),
    ).toBe('loading');
    expect(
      resolveListStatus({ loading: false, refreshing: false, error: 'x', hasData: false, online: true }),
    ).toBe('error');
    expect(
      resolveListStatus({ loading: false, refreshing: false, error: null, hasData: false, online: false }),
    ).toBe('offline');
    expect(
      resolveListStatus({ loading: false, refreshing: false, error: null, hasData: false, online: true }),
    ).toBe('empty');
  });

  it('expone titulares legibles', () => {
    expect(listStatusHeadline('loading')).toContain('Cargando');
    expect(listStatusHeadline('offline')).toContain('Sin conexión');
    expect(listStatusHeadline('ready')).toBe('Todo al día');
  });

  it('resume la sincronización según red y cola', () => {
    expect(
      syncHeadline({ online: false, syncing: false, pending: 2, lastSyncedAt: null, error: null }),
    ).toContain('2 cambio(s) guardado(s)');
    expect(
      syncHeadline({ online: true, syncing: true, pending: 0, lastSyncedAt: null, error: null }),
    ).toBe('Actualizando…');
    expect(
      syncHeadline({ online: true, syncing: false, pending: 1, lastSyncedAt: null, error: null }),
    ).toBe('1 cambio(s) guardado(s)');
    expect(
      syncHeadline({ online: true, syncing: false, pending: 0, lastSyncedAt: null, error: null }),
    ).toBe('En línea');
  });
});
