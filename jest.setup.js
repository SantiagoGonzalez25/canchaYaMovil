/** Entorno de pruebas: no se usa la URL real de producción. */
process.env.EXPO_PUBLIC_API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.test';
