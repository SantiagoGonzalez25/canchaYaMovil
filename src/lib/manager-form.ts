import type { ManagerInput, Sex } from '@/types';
import { isValidPersonName, normalizePersonName } from './text';

/** Validación del alta de profesores; replica `managerRegisterSchema` de la API. */

export interface ManagerDraft {
  displayName: string;
  email: string;
  password: string;
  sex: Sex | '';
  phone: string;
}

export type ManagerDraftErrors = Record<string, string>;

export interface ManagerValidationResult {
  ok: boolean;
  errors: ManagerDraftErrors;
  input?: ManagerInput;
}

export function emptyManagerDraft(): ManagerDraft {
  return {
    displayName: '',
    email: '',
    password: '',
    sex: '',
    phone: '',
  };
}

export function validateManagerDraft(draft: ManagerDraft): ManagerValidationResult {
  const errors: ManagerDraftErrors = {};
  const displayName = normalizePersonName(draft.displayName);
  const email = draft.email.trim().toLowerCase();
  const password = draft.password;
  const phone = draft.phone.trim();

  if (displayName.length < 2) errors.displayName = 'El nombre debe tener al menos 2 caracteres.';
  else if (displayName.length > 80) errors.displayName = 'El nombre no puede superar 80 caracteres.';
  else if (!isValidPersonName(displayName)) {
    errors.displayName = 'Usa solo letras y espacios en el nombre.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Escribe un correo institucional válido.';
  }

  if (password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres.';
  else if (password.length > 72) errors.password = 'La contraseña no puede superar 72 caracteres.';

  if (!draft.sex) errors.sex = 'Selecciona el sexo de la persona.';

  if (phone.length > 30) errors.phone = 'El teléfono no puede superar 30 caracteres.';

  const ok = Object.keys(errors).length === 0;
  if (!ok) return { ok, errors };

  return {
    ok,
    errors,
    input: {
      displayName,
      email,
      password,
      sex: draft.sex as Sex,
      ...(phone ? { phone } : {}),
    },
  };
}
