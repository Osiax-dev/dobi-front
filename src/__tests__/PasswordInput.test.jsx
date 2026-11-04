import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '../ui';

describe('PasswordInput', () => {
  it('masque par défaut puis affiche au clic', async () => {
    render(<PasswordInput aria-label="mdp" defaultValue="secret123" />);
    const input = screen.getByLabelText('mdp');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(input).toHaveAttribute('type', 'password');
  });
  it('ne soumet pas le formulaire en cliquant sur l’œil', async () => {
    let submitted = false;
    render(<form onSubmit={(e) => { e.preventDefault(); submitted = true; }}><PasswordInput aria-label="mdp" /></form>);
    await userEvent.click(screen.getByRole('button'));
    expect(submitted).toBe(false);
  });
});
