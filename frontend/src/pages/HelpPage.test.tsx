import { render, screen, fireEvent, within } from '@testing-library/react';
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

// La liste des guides est dans le <nav> ; on y scope les assertions d'appartenance
// pour éviter la collision avec le titre du guide affiché dans le panneau de contenu.
function list() {
  return within(screen.getByRole('navigation'));
}

describe('HelpPage', () => {
  beforeEach(() => {
    authRef.current = { currentUser: { isSuperAdmin: false }, currentRole: 'cuisinier' };
  });

  it('filtre les guides selon le rôle (cuisinier)', () => {
    renderAt('/aide');
    expect(list().getByText('Écran cuisine (KDS)')).toBeInTheDocument();
    expect(list().getByText('Premiers pas')).toBeInTheDocument();
    expect(list().queryByText('Encaisser à la caisse')).not.toBeInTheDocument();
    expect(list().queryByText('Paie & CNPS')).not.toBeInTheDocument();
  });

  it('montre tous les guides au super-admin', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'cuisinier' };
    renderAt('/aide');
    expect(list().getByText('Encaisser à la caisse')).toBeInTheDocument();
    expect(list().getByText('Paie & CNPS')).toBeInTheDocument();
  });

  it('affiche le premier guide visible sur /aide (contenu)', () => {
    renderAt('/aide'); // cuisinier → premier visible = Premiers pas
    expect(screen.getByRole('heading', { name: 'Premiers pas' })).toBeInTheDocument();
  });

  it('filtre par recherche et affiche un message si aucun résultat', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'propriétaire' };
    renderAt('/aide');
    const input = screen.getByPlaceholderText(/rechercher/i);
    fireEvent.change(input, { target: { value: 'cnps' } });
    expect(list().getByText('Paie & CNPS')).toBeInTheDocument();
    expect(list().queryByText('Premiers pas')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'zzzzz' } });
    expect(screen.getByText(/aucun guide/i)).toBeInTheDocument();
  });

  it('ouvre le guide via un lien profond', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'propriétaire' };
    renderAt('/aide/caisse');
    expect(screen.getByRole('heading', { name: 'Encaisser à la caisse' })).toBeInTheDocument();
  });

  it('replie sur le premier guide visible si l\'id est inconnu', () => {
    renderAt('/aide/inexistant'); // cuisinier → premier visible = Premiers pas
    expect(screen.getByRole('heading', { name: 'Premiers pas' })).toBeInTheDocument();
  });

  it('échappe le HTML du contenu (sécurité)', () => {
    const { container } = render(<div>{renderMarkdown('Bonjour <script>alert(1)</script>')}</div>);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('script');
    expect(container.textContent).not.toContain('<script>');
  });
});
