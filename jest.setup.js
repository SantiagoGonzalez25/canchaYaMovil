/** Entorno de pruebas: la URL real también viene de configuración, no del código. */
process.env.EXPO_PUBLIC_API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://tu-api.vercel.app';
