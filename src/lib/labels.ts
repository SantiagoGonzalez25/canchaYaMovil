import type {
  AcudeCategory,
  AcudeStatus,
  AttendanceStatus,
  EnrollmentStatus,
  ReportGroupBy,
  ReportKind,
  Role,
  ScenarioStatus,
  ScenarioType,
  SessionPhase,
  Sex,
  SyncState,
  Weekday,
} from '@/types';

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Estudiante',
  manager: 'Profesor',
  admin: 'Administrador',
};

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Femenino',
  male: 'Masculino',
  non_binary: 'No binario',
  prefer_not_to_say: 'Prefiero no decirlo',
};

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

/** JS usa 0=domingo; los horarios de la API usan lunes primero. */
export const WEEKDAY_BY_JS_DAY: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const CATEGORY_LABELS: Record<AcudeCategory, string> = {
  sports: 'Deportiva',
  cultural: 'Cultural',
  training: 'Formativa',
  recreational: 'Recreativa',
};

export const CATEGORY_SHORT_LABELS: Record<AcudeCategory, string> = {
  sports: 'Deporte',
  cultural: 'Cultura',
  training: 'Formación',
  recreational: 'Recreación',
};

export const ACUDE_STATUS_LABELS: Record<AcudeStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
};

export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  court: 'Cancha',
  field: 'Campo',
  room: 'Salón',
  pool: 'Piscina',
  auditorium: 'Auditorio',
  gym: 'Gimnasio',
  other: 'Otro',
};

export const SCENARIO_STATUS_LABELS: Record<ScenarioStatus, string> = {
  available: 'Disponible',
  maintenance: 'En mantenimiento',
  inactive: 'Inactivo',
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Activa',
  canceled: 'Cancelada',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Asistió',
  absent: 'No asistió',
};

export const SESSION_PHASE_LABELS: Record<SessionPhase, string> = {
  in_session: 'En clase ahora',
  upcoming: 'Próxima',
  finished: 'Ya pasó hoy',
  scheduled: 'Programada',
};

export const SYNC_STATE_LABELS: Record<SyncState, string> = {
  synced: 'Sincronizada',
  pending: 'Pendiente de sincronizar',
  conflict: 'Conflicto con el servidor',
};

export const SYNC_STATE_SHORT: Record<SyncState, string> = {
  synced: 'Sincronizada',
  pending: 'Pendiente',
  conflict: 'Conflicto',
};

export const OUTBOX_KIND_LABELS = {
  create_enrollment: 'Inscripción',
  cancel_enrollment: 'Cancelación',
} as const;

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  enrollments: 'Eventos de inscripción',
  attendance: 'Asistencia por ACUDE',
};

export const REPORT_GROUP_LABELS: Record<ReportGroupBy, string> = {
  date: 'Fecha',
  week: 'Semana',
  month: 'Mes',
  student: 'Estudiante',
  acude: 'ACUDE',
  category: 'Categoría',
  discipline: 'Disciplina',
  scenario: 'Escenario',
  slot: 'Franja',
  day: 'Día',
  sex: 'Sexo',
  status: 'Estado',
  teacher: 'Docente',
};
