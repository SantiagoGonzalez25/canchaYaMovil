import { API_URL } from '@/config/env';
import { buildApiUrl } from '@/services/api-client';

describe('buildApiUrl', () => {
  it('construye la ruta absoluta con la base pública', () => {
    expect(buildApiUrl('/api/acudes/live')).toBe(`${API_URL}/api/acudes/live`);
    expect(buildApiUrl('api/acudes/live')).toBe(`${API_URL}/api/acudes/live`);
  });

  it('serializa query params y omite vacíos', () => {
    const url = new URL(
      buildApiUrl('/api/acudes/live', {
        q: 'fútbol',
        category: undefined,
        day: 'monday',
        empty: '',
        zero: 0,
        active: false,
        none: null,
      }),
    );

    expect(url.searchParams.get('q')).toBe('fútbol');
    expect(url.searchParams.get('day')).toBe('monday');
    expect(url.searchParams.get('zero')).toBe('0');
    expect(url.searchParams.get('active')).toBe('false');
    expect(url.searchParams.has('category')).toBe(false);
    expect(url.searchParams.has('empty')).toBe(false);
    expect(url.searchParams.has('none')).toBe(false);
  });

  it('codifica caracteres especiales', () => {
    const url = new URL(buildApiUrl('/api/enrollments', { q: 'a&b c' }));
    expect(url.searchParams.get('q')).toBe('a&b c');
  });
});
