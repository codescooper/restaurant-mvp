import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineNotice } from './OfflineNotice';

describe('OfflineNotice', () => {
  it('affiche le message hors-ligne par défaut', () => {
    render(<OfflineNotice />);
    expect(screen.getByText(/hors[- ]ligne/i)).toBeInTheDocument();
  });

  it('affiche un message personnalisé', () => {
    render(<OfflineNotice message="Les statistiques nécessitent une connexion." />);
    expect(screen.getByText('Les statistiques nécessitent une connexion.')).toBeInTheDocument();
  });
});
