import { describe, expect, it } from 'vitest';
import { errText } from '../api';

describe('errText', () => {
  it('traduit « email déjà pris »', () => {
    expect(errText({ errors: { email: ['The email has already been taken.'] } })).toBe('Cette adresse e-mail est déjà utilisée.');
  });
  it('traduit la taille minimale du mot de passe', () => {
    expect(errText({ errors: { password: ['The password field must be at least 8 characters.'] } })).toContain('au moins 8');
  });
  it('laisse passer les messages déjà en français', () => {
    expect(errText({ message: 'Mot de passe actuel incorrect.' })).toBe('Mot de passe actuel incorrect.');
  });
  it('a un texte par défaut', () => {
    expect(errText(null)).toBe('Une erreur est survenue.');
  });
});
