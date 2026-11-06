import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../api';
import { AiSuggest } from '../pages/Reports';

const setup = (props = {}) => {
  const onChange = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <AiSuggest field="analysis" value="Mon brouillon" onChange={onChange} reportId={42} {...props} />
  </QueryClientProvider>);
  return onChange;
};

describe('assistance IA', () => {
  beforeEach(() => api.mockReset());

  it('demande une suggestion avec la section, la consigne et le brouillon', async () => {
    api.mockResolvedValue({ section: 'analysis', text: 'Texte IA' });
    setup();
    await userEvent.type(screen.getByLabelText(/Consigne pour l’IA/), 'ton formel');
    await userEvent.click(screen.getByRole('button', { name: /Suggérer avec l’IA/ }));
    expect(api).toHaveBeenCalledWith('/reports/42/assist', { method: 'POST', body: { section: 'analysis', instructions: 'ton formel', current_text: 'Mon brouillon' } });
    expect(await screen.findByText('Texte IA')).toBeInTheDocument();
    expect(screen.getByText(/à relire et vérifier/)).toBeInTheDocument();
  });

  it('n’insère rien tant que l’enquêteur ne le décide pas', async () => {
    api.mockResolvedValue({ text: 'Texte IA' });
    const onChange = setup();
    await userEvent.click(screen.getByRole('button', { name: /Suggérer avec l’IA/ }));
    await screen.findByText('Texte IA');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('remplace le texte', async () => {
    api.mockResolvedValue({ text: 'Texte IA' });
    const onChange = setup();
    await userEvent.click(screen.getByRole('button', { name: /Suggérer avec l’IA/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remplacer mon texte' }));
    expect(onChange).toHaveBeenCalledWith('analysis', 'Texte IA');
    expect(screen.queryByText('Texte IA')).not.toBeInTheDocument();
  });

  it('ajoute à la suite du texte existant', async () => {
    api.mockResolvedValue({ text: 'Texte IA' });
    const onChange = setup();
    await userEvent.click(screen.getByRole('button', { name: /Suggérer avec l’IA/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter à la suite' }));
    expect(onChange).toHaveBeenCalledWith('analysis', 'Mon brouillon\n\nTexte IA');
  });

  it('ignorer ferme la suggestion ; pas de bouton « ajouter » sur un champ vide', async () => {
    api.mockResolvedValue({ text: 'Texte IA' });
    setup({ value: '' });
    await userEvent.click(screen.getByRole('button', { name: /Suggérer avec l’IA/ }));
    await screen.findByText('Texte IA');
    expect(screen.queryByRole('button', { name: 'Ajouter à la suite' })).not.toBeInTheDocument();
    expect(api.mock.calls[0][1].body.current_text).toBeUndefined();
    await userEvent.click(screen.getByRole('button', { name: 'Ignorer' }));
    expect(screen.queryByText('Texte IA')).not.toBeInTheDocument();
  });

  it('affiche l’erreur si l’IA est indisponible', async () => {
    api.mockImplementationOnce(() => { throw new Error('L’assistance IA est momentanément indisponible.'); });
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Suggérer avec l’IA/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('momentanément indisponible');
  });
});
