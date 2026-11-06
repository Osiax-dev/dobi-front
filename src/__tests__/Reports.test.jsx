import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportDocument, ReportStatus, pct } from '../pages/Reports';
import { emptyCustom } from '../reportLayout';

const report = (over = {}) => ({
  id: 1, title: 'Rapport test', status: 'draft', revision: 1,
  content: {
    meta: { generated_at: '2026-11-05T10:00:00Z', responses: 3, min_group_size: 2 },
    cover: { title: 'Enquête lecture', organization: 'Association Test', author: 'Ot' },
    general: { fields: [
      { key: 'title', label: 'Titre', value: 'Enquête lecture' },
      { key: 'geographic_zone', label: 'Zone géographique', value: null },
    ] },
    methodology: { facts: ['La collecte est anonyme.'] },
    sample: { responses: 3, participants: 3, note: null, first_response_at: '2026-10-01T10:00:00Z', last_response_at: '2026-10-02T10:00:00Z', peak_day: null, by_version: [] },
    results: { questions: [
      { question_id: 1, label: 'Utilisez-vous la bibliothèque ?', type_label: 'Oui / Non', n: 3, response_rate: 100, insufficient: false,
        rows: [{ label: 'Oui', count: 2, percent: 66.7 }, { label: 'Non', count: 1, percent: 33.3 }], other_answers: [], explanation: 'La réponse « Oui » est la plus fréquente.' },
      { question_id: 2, label: 'Niveau', type_label: 'Choix unique', n: 1, response_rate: 33, insufficient: true, rows: [], other_answers: [], explanation: 'Détail masqué.' },
    ] },
    analysis: { highlights: ['Question la plus renseignée'], warnings: ['Échantillon réduit'] },
    annexes: { questions: [{ position: 1, label: 'Utilisez-vous la bibliothèque ?', type_label: 'Oui / Non', required: false }], versions: [] },
  },
  ...over,
});
const empty = { context: '', objectives: '', analysis: '', conclusions: '', recommendations: '' };

describe('Rapport', () => {
  it('affiche les 11 sections et les résultats calculés', () => {
    render(<ReportDocument report={report()} notes={empty} onNote={() => {}} readOnly={false} />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
    expect(screen.getByText(/Utilisez-vous la bibliothèque/, { selector: 'h3' })).toBeInTheDocument();
    const row = screen.getByRole('cell', { name: '66,7 %' }).closest('tr');
    expect(within(row).getByText('Oui')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Détail masqué.')).toBeInTheDocument();
    expect(screen.getByText('Échantillon réduit')).toBeInTheDocument();
  });

  it('signale ce qui manque sans rien inventer', () => {
    render(<ReportDocument report={report()} notes={empty} onNote={() => {}} readOnly />);
    // zone géographique + 5 sections de texte vides (contexte, objectifs, analyse, conclusions, recommandations)
    expect(screen.getAllByText('À compléter')).toHaveLength(6);
  });

  it('un rapport finalisé n’a plus de zones de saisie', () => {
    const notes = { ...empty, conclusions: 'Nos conclusions' };
    render(<ReportDocument report={report({ status: 'final' })} notes={notes} onNote={() => {}} readOnly />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByText('Nos conclusions')).toBeInTheDocument();
  });

  it('propose une zone de saisie par texte en rédaction', () => {
    render(<ReportDocument report={report()} notes={empty} onNote={() => {}} readOnly={false} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(7); // 5 textes + 2 explications de questions
  });

  it('déplace, masque et affiche une section', async () => {
    const onCustom = vi.fn();
    const { rerender } = render(<ReportDocument report={report()} notes={empty} custom={emptyCustom()} onNote={() => {}} onCustom={onCustom} readOnly={false} />);
    await userEvent.click(screen.getByRole('button', { name: /Descendre la section Informations générales/ }));
    expect(onCustom.mock.calls[0][0].order.slice(0, 2)).toEqual(['context', 'general']);
    expect(screen.getByRole('button', { name: /Monter la section Informations générales/ })).toBeDisabled(); // première section déplaçable

    await userEvent.click(screen.getByRole('button', { name: /Masquer la section Méthodologie/ }));
    expect(onCustom.mock.calls[1][0].hidden).toEqual(['methodology']);

    const hidden = { ...emptyCustom(), hidden: ['methodology'] };
    rerender(<ReportDocument report={report()} notes={empty} custom={hidden} onNote={() => {}} onCustom={onCustom} readOnly={false} />);
    expect(screen.getByText(/Section masquée/)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(10);

    rerender(<ReportDocument report={report()} notes={empty} custom={hidden} onNote={() => {}} onCustom={onCustom} readOnly />);
    expect(screen.queryByText(/Section masquée/)).not.toBeInTheDocument();
    expect(screen.queryByText('Méthodologie de collecte')).not.toBeInTheDocument();
  });

  it('ajoute une section libre et masque une question', async () => {
    const onCustom = vi.fn();
    render(<ReportDocument report={report()} notes={empty} custom={emptyCustom()} onNote={() => {}} onCustom={onCustom} readOnly={false} />);
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une section libre/ }));
    expect(onCustom.mock.calls[0][0].extras).toEqual([{ id: 'x1', title: '', body: '' }]);
    await userEvent.click(screen.getByRole('button', { name: /Masquer la question Niveau/ }));
    expect(onCustom.mock.calls[1][0].hidden_questions).toEqual([2]);
  });

  it('explication modifiée : affichée à la place du texte automatique, et rétablissable', async () => {
    const custom = { ...emptyCustom(), explanations: { 1: 'Mon explication' } };
    const onCustom = vi.fn();
    const { rerender } = render(<ReportDocument report={report()} notes={empty} custom={custom} onNote={() => {}} onCustom={onCustom} readOnly />);
    expect(screen.getByText('Mon explication')).toBeInTheDocument();
    expect(screen.queryByText('La réponse « Oui » est la plus fréquente.')).not.toBeInTheDocument();

    rerender(<ReportDocument report={report()} notes={empty} custom={custom} onNote={() => {}} onCustom={onCustom} readOnly={false} />);
    await userEvent.click(screen.getByRole('button', { name: /Rétablir le texte automatique/ }));
    expect(onCustom.mock.calls[0][0].explanations).toEqual({});
  });

  it('affiche la comparaison par groupe sans planter', () => {
    const r = report();
    r.content.results.questions[0].breakdown = [
      { label: 'Licence', hidden: false, rows: [{ label: 'Oui', count: 1, percent: 100 }, { label: 'Non', count: 0, percent: 0 }] },
      { label: 'Master', hidden: true, rows: [] },
    ];
    r.content.compare = { question_id: 9, label: 'Niveau' };
    r.content.sample.per_day = [{ date: '2026-10-01', responses: 2 }, { date: '2026-10-02', responses: 1 }];
    render(<ReportDocument report={r} notes={empty} custom={emptyCustom()} onNote={() => {}} readOnly />);
    expect(screen.getByText(/Résultats comparés selon/)).toBeInTheDocument();
    expect(screen.getByText('Évolution des réponses par jour')).toBeInTheDocument();
  });

  it('formate les pourcentages et les statuts', () => {
    expect(pct(66.7)).toBe('66,7 %');
    expect(pct(null)).toBe('—');
    render(<ReportStatus status="final" />);
    expect(screen.getByText('Finalisé')).toBeInTheDocument();
  });
});
