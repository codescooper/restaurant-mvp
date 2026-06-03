import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderMarkdown } from '../utils/markdown';

// Auth mockée, réglable par test via authRef.current
const { authRef } = vi.hoisted(() => ({ authRef: { current: {} as any } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authRef.current }));

import HelpPage from './HelpPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/aide" element={<HelpPage />} />
        <Route path="/aide/:guideId" element={<HelpPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('HelpPage', () => {
  beforeEach(() => {
    authRef.current = { currentUser: { isSuperAdmin: false }, currentRole: 'cuisinier' };
  });

  it('filtre les guides selon le rôle (cuisinier)', () => {
    renderAt('/aide');
    expect(screen.getByText('Écran cuisine (KDS)')).toBeInTheDocument();
    expect(screen.getByText('Premiers pas')).toBeInTheDocument();
    expect(screen.queryByText('Encaisser à la caisse')).not.toBeInTheDocument();
    expect(screen.queryByText('Paie & CNPS')).not.toBeInTheDocument();
  });

  it('montre tous les guides au super-admin', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'cuisinier' };
    renderAt('/aide');
    expect(screen.getByText('Encaisser à la caisse')).toBeInTheDocument();
    expect(screen.getByText('Paie & CNPS')).toBeInTheDocument();
  });

  it('filtre par recherche et affiche un message si aucun résultat', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'propriétaire' };
    renderAt('/aide');
    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), { target: { value: 'cnps' } });
    expect(screen.getByText('Paie & CNPS')).toBeInTheDocument();
    expect(screen.queryByText('Premiers pas')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), { target: { value: 'zzzzz' } });
    expect(screen.getByText(/aucun guide/i)).toBeInTheDocument();
  });

  it('ouvre le guide via un lien profond', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'propriétaire' };
    renderAt('/aide/caisse');
    expect(screen.getByRole('heading', { name: 'Encaisser à la caisse' })).toBeInTheDocument();
  });

  it('replie sur le premier guide visible si l\'id est inconnu', () => {
    renderAt('/aide/inexistant');
    // rôle cuisinier → premier guide visible = Premiers pas
    expect(screen.getByRole('heading', { name: 'Premiers pas' })).toBeInTheDocument();
  });

  it('échappe le HTML du contenu (sécurité)', () => {
    const { container } = render(<div>{renderMarkdown('Bonjour <script>alert(1)</script>')}</div>);
    // Le rendu n'injecte jamais d'élément <script> : aucune exécution possible.
    expect(container.querySelector('script')).toBeNull();
    // renderMarkdown échappe les chevrons (< → &lt;) : le code reste du texte visible.
    expect(container.textContent).toContain('script');
    expect(container.textContent).not.toContain('<script>');
  });
});
