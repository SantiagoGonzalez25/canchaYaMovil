/**
 * Contrato de datos de CanchaYa (ACUDES).
 *
 * Espeja los tipos de `canchaYa-API` (lib/types.ts). Si la API cambia, TypeScript
 * avisa en toda la app. La app NUNCA habla con Firebase: solo con esta API.
 */

export type Role = 'student' | 'manager' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'banned';

export type Sex = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: Role;
  sex: Sex | null;
}

/** Perfil completo devuelto al crear un gestor. */
export interface UserProfile extends User {
  createdAt: string;
  phone: string | null;
  documentId: string | null;
  status?: UserStatus;
  updatedAt: string;
}

export interface ManagerInput {
  email: string;
  password: string;
  displayName: string;
  sex: Sex;
  phone?: string;
}

export interface TokenSet {
  idToken: string;
  refreshToken: string;
  /** Segundos de vigencia del idToken. */
  expiresIn: number;
}

export interface AuthResult {
  tokens: TokenSet;
  user: User;
}

// ───────────────────────────── Escenarios ─────────────────────────────

export type ScenarioType = 'court' | 'field' | 'room' | 'pool' | 'auditorium' | 'gym' | 'other';

export type ScenarioStatus = 'available' | 'maintenance' | 'inactive';

export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  status: ScenarioStatus;
  location: string;
  capacity: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** Entrada de POST/PUT /api/scenarios. */
export interface ScenarioInput {
  name: string;
  type: ScenarioType;
  status: ScenarioStatus;
  location: string;
  capacity: number;
  description: string;
}

// ───────────────────────────── ACUDES ─────────────────────────────

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type AcudeCategory = 'sports' | 'cultural' | 'training' | 'recreational';

export type AcudeStatus = 'draft' | 'published' | 'archived';

/** Franja semanal de un ACUDE. Cada franja es un subgrupo con su propio cupo. */
export interface ScheduleSlot {
  id: string;
  day: Weekday;
  /** Hora local en formato HH:mm (24 h). */
  startTime: string;
  /** Hora local en formato HH:mm (24 h). */
  endTime: string;
  scenarioId: string;
  maxCapacity?: number;
}

/** Franja enriquecida con ocupación real y datos del escenario (GET /api/acudes/live). */
export interface LiveScheduleSlot extends ScheduleSlot {
  scenarioName: string;
  capacity: number;
  enrolled: number;
  available: number;
  occupancyPct: number;
}

export interface Acude {
  id: string;
  name: string;
  description: string;
  category: AcudeCategory;
  discipline: string;
  scenarioId: string;
  teacherId: string;
  teacherName: string;
  schedule: ScheduleSlot[];
  maxCapacity: number;
  currentEnrolled: number;
  slotEnrolled: Record<string, number>;
  status: AcudeStatus;
  semester: string;
  imageUrl: string | null;
  imageStoragePath: string | null;
  requirements: string;
  attendanceMin: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Acude tal como lo consume la cartelera digital y el calendario. */
export interface LiveAcude extends Omit<Acude, 'schedule'> {
  schedule: LiveScheduleSlot[];
  totalCapacity: number;
  totalAvailable: number;
}

// ───────────────────────────── Inscripciones ─────────────────────────────

export type EnrollmentStatus = 'active' | 'canceled';

/** Inscripción a una franja (subgrupo) de un ACUDE. */
export interface Enrollment {
  id: string;
  acudeId: string;
  acudeName: string;
  userId: string;
  userEmail: string;
  userName: string;
  userSex: Sex;
  slotId: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  scenarioId: string;
  scenarioName: string;
  category: AcudeCategory;
  discipline: string;
  teacherId: string;
  teacherName: string;
  status: EnrollmentStatus;
  clientRequestId: string;
  semester: string;
  enrolledAt: string;
  /** Fecha local (America/Bogota) de la inscripción, YYYY-MM-DD. */
  enrolledOn: string;
  canceledAt: string | null;
  updatedAt: string;
}

/**
 * Estado de sincronización local:
 * - synced: coincide con el servidor
 * - pending: cambio hecho sin conexión, esperando en la cola (outbox)
 * - conflict: el servidor lo rechazó al sincronizar (gana el servidor)
 */
export type SyncState = 'synced' | 'pending' | 'conflict';

export interface LocalEnrollment extends Enrollment {
  syncState: SyncState;
  syncError: string | null;
}

// ───────────────────────────── Asistencia ─────────────────────────────

export type AttendanceStatus = 'present' | 'absent';

/** Sesión real calculada desde el horario de un ACUDE (GET /api/attendance/sessions). */
export interface AttendanceSession {
  sessionKey: string;
  acudeId: string;
  acudeName: string;
  acudeStatus: 'draft' | 'published';
  slotId: string;
  date: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  scenarioId: string;
  scenarioName: string;
  teacherId: string;
  teacherName: string;
  enrolled: number;
  status: 'scheduled' | 'pending' | 'saved';
}

export interface AttendanceRecord {
  id: string;
  acudeId: string;
  acudeName: string;
  slotId: string;
  enrollmentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userSex: Sex;
  category: AcudeCategory;
  discipline: string;
  teacherId: string;
  teacherName: string;
  scenarioId: string;
  scenarioName: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  /** Fecha de la sesión en formato YYYY-MM-DD. */
  date: string;
  status: AttendanceStatus;
  notes: string;
  recordedBy: string;
  recordedAt: string;
  updatedAt: string;
}

// ───────────────────────────── Ocupación ─────────────────────────────

export type SessionPhase = 'in_session' | 'upcoming' | 'finished' | 'scheduled';

export interface OccupationSession {
  slotId: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  acudeId: string;
  acudeName: string;
  teacherName: string;
  category: AcudeCategory;
  enrolled: number;
  capacity: number;
  occupancyPct: number;
  phase: SessionPhase;
}

export interface ScenarioOccupation {
  scenario: Scenario;
  sessions: OccupationSession[];
  current: OccupationSession | null;
  next: OccupationSession | null;
  enrolledToday: number;
}

export interface OccupationResult {
  date: string;
  day: Weekday;
  scenarios: ScenarioOccupation[];
  generatedAt: string;
  serverTime: string;
}

// ───────────────────────────── Entradas de administración ─────────────────────────────

/** Franja que se envía a POST/PUT /api/acudes. */
export interface ScheduleSlotInput {
  id?: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  scenarioId: string;
  maxCapacity?: number;
}

/** Formulario de creación/edición de ACUDE (admin). */
export interface AcudeInput {
  name: string;
  description: string;
  category: AcudeCategory;
  discipline: string;
  teacherId: string;
  teacherName: string;
  scenarioId: string;
  schedule: ScheduleSlotInput[];
  maxCapacity: number;
  status: AcudeStatus;
  semester: string;
  imageUrl?: string;
  requirements: string;
  attendanceMin: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  sex: Sex;
  phone?: string;
}

// ───────────────────────────── Reportes ─────────────────────────────

export type ReportKind = 'enrollments' | 'attendance';

export type ReportGroupBy =
  | 'date'
  | 'week'
  | 'month'
  | 'student'
  | 'acude'
  | 'category'
  | 'discipline'
  | 'scenario'
  | 'slot'
  | 'day'
  | 'sex'
  | 'status'
  | 'teacher';

export interface ReportQuery {
  from?: string;
  to?: string;
  acudeId?: string;
  slotId?: string;
  category?: AcudeCategory;
  discipline?: string;
  scenarioId?: string;
  day?: Weekday;
  sex?: Sex;
  status?: EnrollmentStatus | AttendanceStatus;
  teacherId?: string;
  userId?: string;
  student?: string;
  groupBy?: ReportGroupBy;
}

export interface ReportPoint {
  key: string;
  label: string;
  value: number;
}

export interface ReportSeries {
  name: string;
  color?: string;
  points: ReportPoint[];
}

export interface ReportRow {
  date: string;
  student: string;
  email: string;
  sex: string;
  acude: string;
  slot: string;
  scenario: string;
  teacher: string;
  category: string;
  discipline: string;
  status: string;
}

export interface ReportSummary {
  total: number;
  active: number;
  canceled: number;
  present: number;
  absent: number;
  attendanceRate: number;
}

export interface ReportResult {
  kind: ReportKind;
  groupBy: ReportGroupBy;
  from: string;
  to: string;
  series: ReportSeries[];
  rows: ReportRow[];
  summary: ReportSummary;
  generatedAt: string;
  serverTime: string;
}

