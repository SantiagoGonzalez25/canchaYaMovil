import { shouldPreferServerEnrollment } from '@/lib/enrollment-merge';
import type { Enrollment, LocalEnrollment } from '@/types';

type LocalPick = Pick<
  LocalEnrollment,
  'syncState' | 'status' | 'clientRequestId' | 'acudeId' | 'slotId'
>;
type ServerPick = Pick<Enrollment, 'clientRequestId' | 'acudeId' | 'slotId' | 'status'>;

function local(overrides: Partial<LocalPick> = {}): LocalPick {
  return {
    syncState: 'pending',
    status: 'active',
    clientRequestId: 'request-1',
    acudeId: 'acude-1',
    slotId: 'slot-1',
    ...overrides,
  };
}

function server(overrides: Partial<ServerPick> = {}): ServerPick {
  return {
    clientRequestId: 'request-1',
    acudeId: 'acude-1',
    slotId: 'slot-1',
    status: 'active',
    ...overrides,
  };
}

describe('enrollment reconciliation merge', () => {
  it('prefiere el servidor cuando la creación pendiente ya existe', () => {
    expect(shouldPreferServerEnrollment(local(), [server()])).toBe(true);
  });

  it('prefiere el servidor si coincide la misma franja activa', () => {
    expect(
      shouldPreferServerEnrollment(local({ clientRequestId: 'otro' }), [server()]),
    ).toBe(true);
  });

  it('conserva una cancelación pendiente aunque el servidor la vea activa', () => {
    expect(shouldPreferServerEnrollment(local({ status: 'canceled' }), [server()])).toBe(
      false,
    );
  });

  it('conserva los conflictos hasta que se descarten', () => {
    expect(
      shouldPreferServerEnrollment(local({ syncState: 'conflict' }), [server()]),
    ).toBe(false);
  });

  it('conserva una creación pendiente que aún no llegó al servidor', () => {
    expect(shouldPreferServerEnrollment(local(), [])).toBe(false);
    expect(
      shouldPreferServerEnrollment(local(), [
        server({ clientRequestId: 'otro', acudeId: 'acude-2' }),
      ]),
    ).toBe(false);
  });
});
