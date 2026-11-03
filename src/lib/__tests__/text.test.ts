import {
  availableLabel,
  capitalize,
  compactEmail,
  enrolledLabel,
  foldForSearch,
  initials,
  isValidPersonName,
  normalizePersonName,
  normalizeText,
  sanitizePersonNameInput,
  pluralize,
  truncate,
} from '@/lib/text';

describe('text helpers', () => {
  it('normaliza mayúsculas y tildes', () => {
    expect(normalizeText('  Fútbol Femenino ')).toBe('futbol femenino');
    expect(foldForSearch('ACUDE', null, 'Programación')).toBe('acude programacion');
  });

  it('genera iniciales de nombres', () => {
    expect(initials('Santiago Pérez Gómez')).toBe('SG');
    expect(initials('Ana')).toBe('A');
    expect(initials('   ')).toBe('?');
  });

  it('formatea textos cortos', () => {
    expect(capitalize('cancha')).toBe('Cancha');
    expect(capitalize('')).toBe('');
    expect(truncate('Tecnológico de Antioquia', 12)).toBe('Tecnológico…');
    expect(truncate('Corto', 12)).toBe('Corto');
  });

  it('pluraliza etiquetas de cupos', () => {
    expect(pluralize(1, 'cupo', 'cupos')).toBe('cupo');
    expect(pluralize(0, 'cupo', 'cupos')).toBe('cupos');
    expect(availableLabel(1)).toBe('1 cupo disponible');
    expect(availableLabel(3)).toBe('3 cupos disponibles');
    expect(enrolledLabel(2)).toBe('2 inscritos');
  });

  it('compacta correos largos sin perder el dominio', () => {
    expect(compactEmail('ana@tdea.edu.co')).toBe('ana@tdea.edu.co');
    expect(compactEmail('estudiante.con.nombre.muy.largo@tdea.edu.co')).toContain('…@tdea.edu.co');
    expect(compactEmail('sin-arroba')).toBe('sin-arroba');
  });

  it('valida nombres de personas sin símbolos ni números', () => {
    expect(normalizePersonName('  Ana   María   Pérez  ')).toBe('Ana María Pérez');
    expect(isValidPersonName('Ana María Pérez')).toBe(true);
    expect(isValidPersonName('José Ñáñez')).toBe(true);
    expect(isValidPersonName('ana@tdea')).toBe(false);
    expect(isValidPersonName('Ana 123')).toBe(false);
    expect(isValidPersonName('Ana-María')).toBe(false);
    expect(isValidPersonName('A')).toBe(false);
  });

  it('limpia en tiempo real números y símbolos del nombre', () => {
    expect(sanitizePersonNameInput('Ana 1@2  Pérez!')).toBe('Ana Pérez');
    expect(sanitizePersonNameInput('José Ñáñez')).toBe('José Ñáñez');
  });
});
