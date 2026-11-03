import type {
  AuthResult,
  ManagerInput,
  RegisterInput,
  Sex,
  User,
  UserProfile,
} from '@/types';
import { apiRequest } from './api-client';

export interface LoginInput {
  email: string;
  password: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** POST /api/auth/login — devuelve tokens y usuario con rol. */
export async function login(input: LoginInput): Promise<AuthResult> {
  return apiRequest<AuthResult>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: normalizeEmail(input.email), password: input.password },
  });
}

/** POST /api/auth/register — el registro público siempre crea estudiantes. */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const body: Record<string, unknown> = {
    email: normalizeEmail(input.email),
    password: input.password,
    displayName: input.displayName.trim(),
    sex: input.sex,
  };
  if (input.phone?.trim()) body.phone = input.phone.trim();
  return apiRequest<AuthResult>('/api/auth/register', {
    method: 'POST',
    auth: false,
    body,
  });
}

/** GET /api/auth/me — perfil y rol actualizados desde el servidor. */
export async function fetchMe(): Promise<User> {
  const result = await apiRequest<{ user: User }>('/api/auth/me');
  return result.user;
}

/** POST /api/auth/manager-register — alta de profesor; solo admin. */
export async function createManager(input: ManagerInput): Promise<UserProfile> {
  const result = await apiRequest<{ manager: UserProfile }>('/api/auth/manager-register', {
    method: 'POST',
    body: input,
  });
  return result.manager;
}

/** GET /api/auth/managers — listado completo de profesores; solo admin. */
export async function getManagers(signal?: AbortSignal): Promise<UserProfile[]> {
  const result = await apiRequest<{ managers: UserProfile[] }>('/api/auth/managers', {
    signal,
  });
  return result.managers;
}

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'non_binary', label: 'No binario' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decirlo' },
];
