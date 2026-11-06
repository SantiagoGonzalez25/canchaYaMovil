# CanchaYa Móvil

Aplicación móvil de **CanchaYa** para consultar la cartelera digital de ACUDES, inscribirse a subgrupos, operar sin conexión y gestionar ocupación, asistencia y el catálogo de actividades.

Construida con **Expo SDK 58 + React Native 0.88 + TypeScript + Expo Router**, consume únicamente la API real de `canchaYa-API` (no habla directo con Firebase) y cumple el flujo de la Guía 2 como referencia de arquitectura offline-first.

---

## 1. Funcionalidades

### Estudiante
- Inicio de sesión y registro con selección de sexo.
- **Panel de inicio** con próximo ACUDE, inscripciones activas y recomendaciones.
- Cartelera en vivo con búsqueda y filtros por categoría/día conectados a la API; conserva la caché cuando no hay red.
- Detalle de ACUDE con franjas, escenarios, docente, requisitos, ocupación e inscripción por subgrupo.
- Inscripción y cancelación con guardado local y envío automático al recuperar la conexión.
- Validación local de reglas: máximo 2 ACUDES activos por semestre, sin duplicados y sin cruces de horario.
- “Mis ACUDES” con historial, estados pendientes y avisos de revisión.
- **Calendario con acceso rápido por día**: tira horizontal con puntos por categoría, vistas Agenda/Semana/Por escenario, filtros por texto/categoría/cupos/Mis ACUDES y detalle accionable en un toque.
- Perfil con datos de cuenta, estado de actualización y accesos rápidos.

### Gestor (`manager`) y Administrador (`admin`)
- Panel de **Ocupación** por fecha y escenario, con fase de sesión y ocupación real.
- **Asistencia** por ACUDE, franja y fecha: roster de inscritos activos, presente/ausente obligatorio, observaciones y guardado masivo idempotente.
- **Reportes** de inscripciones y asistencia: filtros por fechas, estudiante, ACUDE, categoría, disciplina, escenario, franja, día, sexo, estado y docente; agrupación configurable; gráfica nativa, desglose, detalle y exportación CSV.
- **Gestión de ACUDES** (solo admin): búsqueda, filtro por estado, creación, edición y archivado.
- **Escenarios** (solo admin): crear, editar y eliminar canchas, campos, salones, piscinas, auditorios y gimnasios.
- **Profesores** (solo admin): alta de perfiles con sexo, credenciales temporales, UID y listado completo de gestores con sus ACUDES asignados.
- **Portada global** (solo admin): subir, reemplazar o quitar la imagen del ACUDE desde el móvil (máximo 500 KB); se comparte con todos los dispositivos.
- Editor de franjas con selección de día, escenario, horas, cupo, docente registrado y validación de cruces en el cliente.

### Roles y pestañas
| Rol | Pestañas |
|---|---|
| Estudiante | Inicio · Cartelera · Calendario · Mis ACUDES · Perfil |
| Gestor | Panel · Calendario · Asistencia · Reportes · Mi ACUDE · Perfil |
| Administrador | Panel · Ocupación · Asistencia · Reportes · Gestión · Perfil |

La cartelera y el calendario también están disponibles para el administrador desde el Panel y los accesos rápidos.

La API valida permisos en el servidor; la app solo oculta rutas para mejorar la experiencia.

---

## 2. Stack

- **Expo SDK 58** / React Native 0.88 / React 19
- **Expo Router** con rutas tipadas y pestañas por rol
- **TypeScript** estricto
- **SQLite** (`expo-sqlite`, esquema v2) para cartelera, inscripciones, cola pendiente y metadatos
- **SecureStore** para tokens y perfil de sesión
- **NetInfo** para estado de red
- **Nunito Sans** y paleta institucional TdeA (verde, lima, teal y fondo claro)
- **expo-linear-gradient** para tarjetas y fondos
- **expo-image-picker + expo-image-manipulator** para portadas locales
- **expo-sharing + expo-file-system** para exportar reportes CSV
- **Jest + jest-expo + Testing Library React Native** para pruebas

---

## 3. Puesta en marcha

### Requisitos
- Node.js 20 o superior
- npm
- Expo Go actualizado (SDK 58) o emulador Android/iOS

### Instalación

```bash
npm install
copy .env.example .env   # PowerShell
# o: cp .env.example .env
npm start
```

Define en `.env` la URL del despliegue real. En los builds de EAS configúrala como variable de entorno del proyecto:

```env
EXPO_PUBLIC_API_URL=https://tu-api.vercel.app
```

Para probar contra la API local:

```env
# Dispositivo físico en la misma red Wi-Fi
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000

# Emulador Android
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

> La API debe iniciarse con acceso LAN (`pnpm dev:lan`) si se prueba desde un teléfono físico. No se requieren credenciales de Firebase en la app.

### Comandos

| Comando | Descripción |
|---|---|
| `npm start` | Inicia Metro / Expo Go |
| `npm run android` | Abre en emulador Android |
| `npm run ios` | Abre en simulador iOS |
| `npm run typecheck` | Valida TypeScript sin emitir |
| `npm run lint` | ESLint con configuración de Expo |
| `npm test` | Ejecuta Jest |

---

## 4. Cuentas demo

| Rol | Correo | Contraseña |
|---|---|---|
| Estudiante | `estudiante1@canchaya.demo` | `Demo1234!` |
| Gestor | `gestor@canchaya.demo` | `Gestor1234!` |
| Administrador | `admin@canchaya.demo` | `Admin1234!` |

La cuenta demo de estudiante ya tiene 2 ACUDES activos, por lo que para probar una inscripción nueva hay que cancelar una primero.

---

## 5. Arquitectura

```text
src/
  app/                 Rutas de Expo Router
    (app)/             Pestañas autenticadas por rol (incluye Reportes)
    acude/[id].tsx     Detalle e inscripción
    gestion/           ACUDES, escenarios y profesores (admin)
  components/          UI nativa reutilizable
  config/              URL de API y constantes
  constants/           Tema claro/oscuro y tokens de diseño
  db/                  Esquema SQLite y repositorios
  lib/                 Fechas, textos, reglas y validaciones puras
  providers/           Auth, red y datos offline-first
  services/            Cliente HTTP, sesión, API y sincronización
  types/               Contrato de dominio de la API
```

### Flujo de datos
1. `NetworkProvider` informa si hay conexión.
2. `AuthProvider` restaura la sesión desde SecureStore y refresca el perfil.
3. `DataProvider` carga la caché SQLite y ejecuta `runSync()`:
   - descarga `GET /api/acudes/live` y reemplaza la cartelera local;
   - empuja la outbox con `clientRequestId` idempotente;
   - descarga `GET /api/enrollments/me` y reconcilia;
   - conserva operaciones pendientes y conflictos.
4. Las pantallas de estudiante leen siempre de SQLite, por lo que funcionan sin red.
5. Las pantallas de gestor/admin consultan la API en vivo porque la ocupación, asistencia y gestión son datos autoritativos del servidor.

### Sesión segura
- `idToken`, `refreshToken` y perfil se guardan en **SecureStore** (`canchaya.tokens.v1`, `canchaya.user.v1`).
- El token se renueva automáticamente 60 s antes de vencer; peticiones concurrentes comparten un solo refresh.
- Un `401` definitivo limpia la sesión y redirige al login.
- Al cerrar sesión se borra la caché local del usuario.

### Experiencia de uso
- La cartelera se organiza con **pestañas superiores por categoría** y búsqueda directa, sin filtros de día que obliguen a navegar de uno en uno.
- El calendario muestra **puntos de actividad por día** y permite cambiar la fecha con un solo toque.
- Todos los controles principales respetan un área táctil mínima de **44 dp**.
- La carga de filtros muestra indicadores locales; los estados vacíos explican qué hacer y ofrecen una acción.

### Robustez y mensajes
- `EXPO_PUBLIC_API_URL` es la única fuente para la URL de la API; no hay entornos quemados en el código.
- Un error HTTP se trata como error de negocio o permisos, nunca como “sin internet”.
- La cabecera muestra un indicador discreto (verde/ámbar/azul) en lugar de banners técnicos.
- El esquema SQLite v2 permite `semester` nulo y el repositorio aplica `'N/A'` como respaldo seguro.
- Los textos de la interfaz no exponen “API”, “SQLite”, “outbox”, “servidor” ni detalles internos.

### Reglas de inscripción (cliente y servidor)
- Solo ACUDES publicados y con cupo.
- Una sola inscripción activa por ACUDE.
- Sin cruces de horario (los extremos que se tocan no se consideran cruce).
- Máximo **2 ACUDES activos** por semestre.
- La API es la fuente de verdad: si rechaza una operación encolada, la fila local queda como **conflicto** y se muestra el motivo.

### Outbox y conflictos
- Crear: `POST /api/enrollments` con `clientRequestId` (UUID).
- Cancelar: `PATCH /api/enrollments/:id/cancel`.
- `dedupe_key` evita duplicados: `create:<clientRequestId>` y `cancel:<enrollmentId>`.
- La conciliación conserva cancelaciones pendientes aunque el servidor aún las devuelva activas; una inscripción pendiente que ya existe en el servidor se reemplaza por la versión remota.
- Un rechazo definitivo (`NO_CAPACITY`, `STUDENT_OVERLAP`, `MAX_ACUDES`, etc.) se marca como conflicto; un error de red o 5xx deja la operación en cola para reintentar.

---

## 6. Endpoints utilizados

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/auth/login` | Inicio de sesión |
| POST | `/api/auth/register` | Registro de estudiante |
| POST | `/api/auth/manager-register` | Alta de profesor (admin) |
| GET | `/api/auth/managers` | Listado completo de profesores (admin) |
| POST | `/api/auth/refresh` | Renovación de tokens |
| GET | `/api/auth/me` | Perfil y rol |
| GET | `/api/acudes/live` | Cartelera y cupos |
| GET | `/api/acudes` | Catálogo de gestión |
| GET | `/api/acudes/:id` | Detalle para editar |
| POST/PUT/DELETE | `/api/acudes` / `/api/acudes/:id` | Crear, editar, archivar |
| POST/DELETE | `/api/acudes/:id/image` | Subir o quitar la portada global (admin) |
| GET | `/api/scenarios` | Escenarios |
| POST/PUT/DELETE | `/api/scenarios` / `/api/scenarios/:id` | Crear, editar y eliminar escenarios |
| GET | `/api/scenarios/occupation` | Ocupación del gestor |
| GET | `/api/enrollments` | Inscritos de una franja |
| GET | `/api/enrollments/me` | Mis inscripciones |
| POST | `/api/enrollments` | Inscripción idempotente |
| PATCH | `/api/enrollments/:id/cancel` | Cancelación |
| GET | `/api/attendance` | Asistencia por ACUDE/franja/fecha |
| POST | `/api/attendance` | Guardado masivo de asistencia |
| GET | `/api/reports/enrollments` | Reporte de eventos de inscripción |
| GET | `/api/reports/attendance` | Reporte de asistencia |

La API se amplió con `GET /api/auth/managers` y `POST/DELETE /api/acudes/:id/image` para completar la paridad con el panel web; el resto de endpoints no cambió.

---

## 7. Pruebas

```bash
npm test
```

Cobertura actual (83 pruebas):
- utilidades de fecha y zona horaria de Bogotá;
- textos, plurales, iniciales y búsqueda sin tildes;
- estados de lista y resumen de sincronización;
- reglas de inscripción (cupo, duplicado, cruces, máximo semestral, canceladas);
- validación del formulario de ACUDES (horas, cruces, escenario principal, URL de imagen, ids de franjas);
- cliente HTTP: JSON, errores de API, respuestas inválidas y errores de red;
- construcción de URLs con query params;
- sesión segura: persistencia, actualización de perfil, cierre, notificaciones y refresh de tokens;
- cola offline: inscripción optimista, validación local, dedupe, cancelación y respaldo de semestre;
- motor de sincronización: push, reconciliación (incluida la cancelación pendiente), conflictos definitivos y errores transitorios;
- reportes: matriz de series, orden cronológico, CSV con BOM y escape de comillas;
- formularios de escenarios y alta de profesores;
- servicios de reportes, gestores, CRUD de escenarios y portadas globales;
- envío multipart sin forzar `Content-Type` JSON;
- render y pulsación de componentes base.

También se validó el bundle de Android con `npx expo export --platform android`.

---

## 8. Pruebas manuales antes del APK

La guía completa de QA se mantiene como documento local y no se publica en este repositorio.

## 9. Limitaciones conocidas

1. **Las portadas globales admiten máximo 500 KB** (JPEG, PNG o WebP). La app comprime y reduce automáticamente antes de subir. Los estudiantes también pueden poner una portada solo local en su dispositivo.
2. **Asistencia, ocupación, reportes y gestión requieren conexión**, porque dependen de datos en vivo y de validaciones transaccionales del servidor.
3. **La sesión de estudiante demo ya está en el máximo de 2 ACUDES.** Cancela una inscripción para probar una nueva.
4. El registro público solo crea estudiantes; gestores y administradores se crean con el formulario de Profesores o con los scripts de la API.
5. La cartelera y el calendario del administrador se abren desde el Panel o los accesos rápidos, sin pestaña propia.
6. Las portadas locales se eliminan al cerrar sesión; las globales se comparten con todos los dispositivos.

---

## 10. Solución de problemas

- **“No hay conexión con el servidor”**: verifica `.env`, reinicia Metro con `npm start -- --clear` y confirma que la URL responde (`/api/health`).
- **Expo Go muestra una versión vieja**: cierra y vuelve a abrir el proyecto; el template usa SDK 58.
- **SQLite con datos viejos tras cambiar de usuario**: cierra sesión (borra la caché) o limpia los datos de Expo Go.
- **No aparece un ACUDE recién publicado**: la cartelera se sincroniza al abrir, al recuperar red, al volver a la app o al pulsar “Sincronizar ahora” en Perfil.

---

## 11. Créditos

Proyecto académico de ACUDES del Tecnológico de Antioquia. La Guía 2 se usó solo como referencia de arquitectura móvil; la implementación y el contrato de datos se adaptaron a la API real de CanchaYa.
