import { ApiError, NetworkError } from '@/services/errors';
import { fetchJson } from '@/services/fetch-json';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('fetchJson', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('devuelve el JSON y agrega cabeceras JSON al enviar cuerpo', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response({ data: 1 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await fetchJson<{ data: number }>('/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'ACUDE' }),
      headers: { Authorization: 'Bearer token' },
    });

    expect(result).toEqual({ data: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        }),
      }),
    );
  });

  it('envía FormData sin fijar Content-Type JSON', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response({ ok: true }));
    global.fetch = fetchMock as typeof fetch;
    const form = new FormData();
    form.append('file', 'contenido');

    await fetchJson('/api/acudes/a1/image', { method: 'POST', body: form });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(form);
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('traduce el contrato de error de la API a ApiError', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response(
          { error: { code: 'NO_CAPACITY', message: 'El subgrupo está lleno', details: { slotId: 's1' } } },
          409,
        ),
      ) as typeof fetch;

    await expect(fetchJson('/api/enrollments')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'NO_CAPACITY',
      message: 'El subgrupo está lleno',
      details: { slotId: 's1' },
    });
  });

  it('usa HTTP_xxx cuando el error no trae cuerpo JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue(response('gateway down', 502)) as typeof fetch;

    const error = await fetchJson('/api/test').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'HTTP_502' });
  });

  it('rechaza respuestas exitosas que no son JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue(response('<html>', 200)) as typeof fetch;

    await expect(fetchJson('/api/test')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });

  it('traduce fallos de red a NetworkError', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network request failed')) as typeof fetch;

    await expect(fetchJson('/api/test')).rejects.toBeInstanceOf(NetworkError);
  });
});
