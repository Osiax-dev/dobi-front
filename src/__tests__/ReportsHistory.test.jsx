import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../api';
import Reports, { ComparePicker, HistoryPanel, ReportDocument, comparisonsOf } from '../pages/Reports';

const wrap = (ui) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);
const empty = { context: '', objectives: '', analysis: '', conclusions: '', recommendations: '' };
const rows = [{ label: 'Oui', count: 2, percent: 66.7 }, { label: 'Non', count: 1, percent: 33.3 }];
const g = (label) => ({ label, hidden: false, rows });

const content = (q) => ({
  meta: { generated_at: '2026-11-05T10:00:00Z', responses: 3, min_group_size: 2 },
  cover: { title: 'Enquête', organization: 'Asso', author: 'Ot' },
  general: { fields: [{ key: 'organization_type', label: 'Type d’organisation', value: 'Association' }, { key: 'organization_description', label: 'Présentation de l’organisation', value: null }] },
  methodology: { facts: [] },
  sample: { responses: 3, participants: 3, note: null, first_response_at: null, last_response_at: null, peak_day: null, by_version: [] },
  results: { questions: [q] },
  compare: { label: 'Niveau' }, compares: [{ label: 'Niveau' }, { label: 'Sexe' }],
  analysis: { highlights: [], warnings: [] }, annexes: { questions: [], versions: [] },
});
const question = { question_id: 5, label: 'Utilisez-vous la bibliothèque ?', type_label: 'Oui / Non', n: 3, response_rate: 100, insufficient: false, rows, other_answers: [], explanation: 'ex',
  breakdowns: [{ by_id: 1, by_label: 'Niveau', groups: [g('Licence')] }, { by_id: 2, by_label: 'Sexe', groups: [g('F')] }] };

describe('comparaisons multiples', () => {
  it('affiche toutes les comparaisons choisies', () => {
    const report = { id: 1, title: 'R', status: 'draft', content: content(question) };
    wrap(<ReportDocument report={report} notes={empty} readOnly />);
    expect(screen.getByText(/Résultats comparés selon/).textContent).toMatch(/Niveau.*Sexe/);
    expect(screen.getByText('Selon « Niveau »')).toBeInTheDocument();
    expect(screen.getByText('Selon « Sexe »')).toBeInTheDocument();
  });

  it('reste compatible avec un ancien rapport (une seule comparaison)', () => {
    const old = { ...question, breakdowns: undefined, breakdown: [g('Licence')] };
    expect(comparisonsOf(old, { compare: { label: 'Niveau' } })).toEqual([{ label: 'Niveau', groups: old.breakdown }]);
    expect(comparisonsOf({ ...old, breakdown: null }, {})).toEqual([]);
  });

  it('limite le choix à 3 questions', async () => {
    const onChange = vi.fn();
    const opts = [1, 2, 3, 4].map((id) => ({ id, label: `Question ${id}` }));
    const { rerender } = wrap(<ComparePicker options={opts} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Question 2'));
    expect(onChange).toHaveBeenCalledWith([2]);
    rerender(<QueryClientProvider client={new QueryClient()}><ComparePicker options={opts} value={[1, 2, 3]} onChange={onChange} /></QueryClientProvider>);
    expect(screen.getByLabelText('Question 4')).toBeDisabled();
    expect(screen.getByLabelText('Question 1')).toBeEnabled(); // on peut décocher
  });
});

describe('informations de l’organisation', () => {
  it('affiche le type et signale la présentation manquante', () => {
    wrap(<ReportDocument report={{ id: 1, title: 'R', status: 'draft', content: content(question) }} notes={empty} readOnly />);
    expect(screen.getByText('Association')).toBeInTheDocument();
    expect(screen.getByText('Présentation de l’organisation').closest('div')).toHaveTextContent('À compléter');
  });
});

describe('historique', () => {
  beforeEach(() => { api.mockReset(); });
  const list = { data: [{ id: 9, revision: 2, title: 'Version A', author: 'Ot', saved_at: '2026-11-05T10:00:00Z', filled: 2 }] };

  it('liste les versions, permet de les lire puis de les restaurer', async () => {
    api.mockImplementation(async (path, opts = {}) => {
      if (path === '/reports/1/revisions') return list;
      if (path === '/reports/1/revisions/9' && !opts.method) return { id: 9, notes: { ...empty, conclusions: 'Ancien texte' } };
      if (opts.method === 'POST') return { id: 1, revision: 4 };
      throw new Error(`chemin inattendu : ${path} ${JSON.stringify(opts)}`);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onRestored = vi.fn();
    wrap(<HistoryPanel report={{ id: 1, revision: 3 }} dirty={false} final={false} onRestored={onRestored} onError={vi.fn()} />);

    expect(await screen.findByText('Version A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voir' }));
    expect(await screen.findByText('Ancien texte')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Restaurer/ }));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/reports/1/revisions/9/restore', { method: 'POST', body: { revision: 3 } });
  });

  it('ne restaure rien si l’utilisateur annule, ni sur un rapport finalisé', async () => {
    api.mockResolvedValue(list);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { unmount } = wrap(<HistoryPanel report={{ id: 1, revision: 3 }} dirty final={false} onRestored={vi.fn()} onError={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /Restaurer/ }));
    expect(window.confirm.mock.calls[0][0]).toMatch(/seront perdues/);
    expect(api).not.toHaveBeenCalledWith(expect.stringContaining('/restore'), expect.anything());
    unmount();

    wrap(<HistoryPanel report={{ id: 1, revision: 3 }} dirty={false} final onRestored={vi.fn()} onError={vi.fn()} />);
    await screen.findByText('Version A');
    expect(screen.queryByRole('button', { name: /Restaurer/ })).toBeNull();
    expect(screen.getByText(/rouvrez-le pour restaurer/)).toBeInTheDocument();
  });
});

describe('aperçu avant enregistrement', () => {
  beforeEach(() => { api.mockReset(); });

  it('calcule l’aperçu sans rien créer, puis enregistre seulement sur demande', async () => {
    const setReportId = vi.fn();
    api.mockImplementation(async (path, opts = {}) => {
      if (path === '/studies/7/reports' && !opts.method) return { data: [] };
      if (path === '/studies/7/reports/preview') return { preview: true, title: 'Aperçu', status: 'draft', content: content(question), notes: empty, custom: { order: [], hidden: [], hidden_questions: [], explanations: {}, extras: [] } };
      if (path === '/studies/7/reports' && opts.method === 'POST') return { id: 55 };
      throw new Error(`chemin inattendu : ${path} ${JSON.stringify(opts)}`);
    });
    wrap(<Reports study={{ id: 7 }} questions={[{ id: 1, type: 'single_choice', label: 'Niveau' }]} reportId={null} setReportId={setReportId} />);

    await userEvent.click(await screen.findByLabelText('Niveau'));
    await userEvent.click(screen.getByRole('button', { name: /Aperçu/ }));
    expect(await screen.findByText(/ce rapport n’est pas encore enregistré/)).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/studies/7/reports/preview', { method: 'POST', body: { compare_by: [1] } });
    expect(api).not.toHaveBeenCalledWith('/studies/7/reports', expect.objectContaining({ method: 'POST' }));

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer ce rapport/ }));
    await waitFor(() => expect(setReportId).toHaveBeenCalledWith(55));
    expect(api).toHaveBeenCalledWith('/studies/7/reports', { method: 'POST', body: { compare_by: [1] } });
  });

  it('retour sans enregistrer : rien n’est créé', async () => {
    api.mockImplementation(async (path, opts = {}) => {
      if (path === '/studies/7/reports' && !opts.method) return { data: [] };
      return { preview: true, title: 'Aperçu', status: 'draft', content: content(question), notes: empty, custom: { order: [], hidden: [], hidden_questions: [], explanations: {}, extras: [] } };
    });
    wrap(<Reports study={{ id: 7 }} questions={[]} reportId={null} setReportId={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /Aperçu/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Retour sans enregistrer/ }));
    expect(await screen.findByRole('button', { name: /Générer un rapport/ })).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith('/studies/7/reports', expect.objectContaining({ method: 'POST' }));
  });
});
