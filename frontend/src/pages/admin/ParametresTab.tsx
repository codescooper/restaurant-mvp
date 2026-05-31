import { useEffect, useState } from 'react';
import { Save, Printer, Percent, Lock, ImagePlus, Store } from 'lucide-react';
import { settingsApi, brandingApi } from '../../services/endpoints';
import { applyReceiptWidth, ReceiptWidth } from '../../utils/receiptWidth';
import { useAuth } from '../../contexts/AuthContext';
import { compressImage } from '../../utils/image';
import { formatFCFA, formatDateTime } from '../../utils/format';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-5';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const BTN_SAVE =
  'flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap';

// Jeu de données fictif pour l'aperçu du ticket (n'est jamais enregistré).
const SAMPLE = {
  orderNumber: 'CMD-0042',
  time: new Date('2026-01-01T12:34:00'),
  items: [
    { q: 1, name: 'Attiéké poisson', price: 3000 },
    { q: 2, name: 'Bissap', price: 500 },
    { q: 1, name: 'Alloco', price: 1000 },
  ],
};

export default function ParametresTab() {
  const { branding, refreshBranding } = useAuth();

  const [restaurantName, setRestaurantName] = useState('');
  const [receiptWidth, setReceiptWidth] = useState<ReceiptWidth>('80');
  const [maxDiscount, setMaxDiscount] = useState(100);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      settingsApi.getRestaurantName().catch(() => 'Mon Restaurant'),
      settingsApi.getReceiptWidth().catch(() => '80' as ReceiptWidth),
      settingsApi.getMaxDiscount().catch(() => 100),
      settingsApi.getManagerPinStatus().catch(() => false),
    ])
      .then(([name, width, disc, pinSet]) => {
        setRestaurantName(name);
        setReceiptWidth(width);
        applyReceiptWidth(width);
        setMaxDiscount(disc);
        setPinConfigured(pinSet);
      })
      .finally(() => setLoading(false));
  }, []);

  const flash = (m: string) => { setErr(''); setMsg(m); setTimeout(() => setMsg(''), 2500); };
  const fail = (m: string) => { setMsg(''); setErr(m); };

  const saveName = async () => {
    try {
      const v = await settingsApi.setRestaurantName(restaurantName);
      setRestaurantName(v);
      flash('Nom du restaurant enregistré.');
    } catch {
      fail("Impossible d'enregistrer le nom (réservé au propriétaire / administrateur).");
    }
  };

  const saveWidth = async (w: ReceiptWidth) => {
    setReceiptWidth(w);
    applyReceiptWidth(w); // l'aperçu et l'impression suivent immédiatement
    try {
      await settingsApi.setReceiptWidth(w);
      flash(`Format du ticket réglé sur ${w} mm.`);
    } catch {
      fail("Impossible d'enregistrer le format du ticket.");
    }
  };

  const saveDiscount = async () => {
    try {
      await settingsApi.setMaxDiscount(maxDiscount);
      flash('Plafond de remise enregistré.');
    } catch {
      fail("Impossible d'enregistrer le plafond de remise.");
    }
  };

  const savePin = async () => {
    try {
      const ok = await settingsApi.setManagerPin(pin);
      setPinConfigured(ok);
      setPin('');
      flash(ok ? 'PIN manager enregistré.' : 'PIN manager désactivé.');
    } catch {
      fail("Impossible d'enregistrer le PIN manager.");
    }
  };

  const onLogoFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 300, 0.85);
      await brandingApi.update({ logoUrl: dataUrl });
      await refreshBranding();
      flash('Logo mis à jour.');
    } catch {
      fail('Image invalide ou trop lourde.');
    }
  };

  const removeLogo = async () => {
    try {
      await brandingApi.update({ logoUrl: '' });
      await refreshBranding();
      flash('Logo retiré.');
    } catch {
      fail('Impossible de retirer le logo.');
    }
  };

  if (loading) return <p className="text-neutral-500 py-8 text-center">Chargement des paramètres…</p>;

  const subtotal = SAMPLE.items.reduce((s, i) => s + i.price * i.q, 0);
  const previewPx = receiptWidth === '58' ? 220 : 300;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ───────── Colonne réglages ───────── */}
      <div className="space-y-4">
        {(msg || err) && (
          <div
            className={`no-print rounded-lg p-3 text-sm ${
              err
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}
          >
            {err || msg}
          </div>
        )}

        {/* Identité (logo + nom) */}
        <section className={PANEL}>
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-semibold text-neutral-100">Identité du restaurant</h2>
          </div>

          <label className="block text-sm text-neutral-400 mb-1">Logo (en-tête du ticket)</label>
          <div className="flex items-center gap-3 mb-4">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="logo"
                className="w-16 h-16 object-contain rounded-lg border border-neutral-700 bg-white p-1"
              />
            ) : (
              <span className="w-16 h-16 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-neutral-600">
                <ImagePlus className="w-6 h-6" />
              </span>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 px-3 py-1.5 rounded-lg cursor-pointer w-fit">
                {branding?.logoUrl ? 'Changer le logo' : 'Choisir un logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onLogoFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {branding?.logoUrl && (
                <button type="button" onClick={removeLogo} className="text-xs text-rose-400 w-fit">
                  Retirer le logo
                </button>
              )}
              <span className="text-xs text-neutral-500">Idéal : logo simple, fort contraste (imprimé en N&amp;B).</span>
            </div>
          </div>

          <label className="block text-sm text-neutral-400 mb-1">Nom du restaurant</label>
          <div className="flex gap-2">
            <input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Ex. La Table d'Or"
              className={INPUT}
            />
            <button onClick={saveName} className={BTN_SAVE}>
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </section>

        {/* Format du ticket */}
        <section className={PANEL}>
          <div className="flex items-center gap-2 mb-1">
            <Printer className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-semibold text-neutral-100">Format du ticket</h2>
          </div>
          <p className="text-sm text-neutral-400 mb-3">
            Largeur du rouleau de l'imprimante thermique. Le reçu est conçu à cette taille : pas de
            réduction à l'impression, texte net en 1:1.
          </p>
          <div className="flex gap-2">
            {(['58', '80'] as ReceiptWidth[]).map((w) => (
              <button
                key={w}
                onClick={() => saveWidth(w)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  receiptWidth === w
                    ? 'border-gold-400 bg-gold-400/10 text-gold-300'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {w} mm
                <span className="block text-xs font-normal text-neutral-500">
                  {w === '58' ? 'Petit rouleau' : 'Standard (recommandé)'}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Plafond de remise */}
        <section className={PANEL}>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-semibold text-neutral-100">Plafond de remise</h2>
          </div>
          <p className="text-sm text-neutral-400 mb-3">
            Remise manuelle maximale autorisée en caisse (100 % = aucune limite).
          </p>
          <div className="flex gap-2 max-w-xs">
            <input
              type="number"
              min={0}
              max={100}
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className={INPUT}
            />
            <button onClick={saveDiscount} className={BTN_SAVE}>
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </section>

        {/* PIN manager */}
        <section className={PANEL}>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-semibold text-neutral-100">PIN manager</h2>
          </div>
          <p className="text-sm text-neutral-400 mb-3">
            Code demandé au caissier pour les annulations / remboursements.{' '}
            <span className={pinConfigured ? 'text-emerald-400' : 'text-neutral-500'}>
              {pinConfigured ? 'Actuellement actif.' : 'Aucun PIN configuré.'}
            </span>{' '}
            Laisser vide et enregistrer pour désactiver.
          </p>
          <div className="flex gap-2 max-w-xs">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Nouveau PIN"
              className={INPUT}
            />
            <button onClick={savePin} className={BTN_SAVE}>
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </section>
      </div>

      {/* ───────── Colonne aperçu ───────── */}
      <div>
        <section className={`${PANEL} lg:sticky lg:top-32`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-neutral-100">Aperçu du ticket</h2>
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-1.5 bg-gold-400 hover:bg-gold-300 text-black font-semibold px-3 py-2 rounded-lg text-sm"
            >
              <Printer className="w-4 h-4" /> Imprimer un test
            </button>
          </div>
          <p className="no-print text-xs text-neutral-500 mb-3">
            Aperçu indicatif. À l'impression réelle, le ticket sort en noir &amp; blanc plein contraste
            (imprimante thermique). Pense à mettre « Marges = Aucune » et « Échelle = 100 % » dans la
            fenêtre d'impression du navigateur.
          </p>

          <div className="flex justify-center bg-neutral-900 rounded-xl p-4 overflow-auto">
            {/* .print-area : c'est CE bloc qui sera imprimé (le reste de la page est masqué). */}
            <div
              className="print-area bg-white text-gray-900 p-3"
              style={{ width: previewPx, fontFamily: '"Courier New", ui-monospace, monospace', fontSize: 12, lineHeight: 1.4 }}
            >
              <div className="text-center mb-2">
                {branding?.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="receipt-logo mx-auto mb-1" style={{ maxHeight: 56, width: 'auto' }} />
                )}
                <div className="font-bold" style={{ fontSize: 15 }}>{restaurantName || 'Mon Restaurant'}</div>
                <div className="text-gray-500">Reçu de commande</div>
              </div>
              <div className="text-center font-bold" style={{ fontSize: 14 }}>{SAMPLE.orderNumber}</div>
              <div className="text-center text-gray-500 mb-2">{formatDateTime(SAMPLE.time)}</div>
              <div className="border-t border-b border-gray-400 py-1 space-y-0.5">
                {SAMPLE.items.map((i) => (
                  <div key={i.name} className="flex justify-between">
                    <span>{i.q} x {i.name}</span>
                    <span>{formatFCFA(i.price * i.q)}</span>
                  </div>
                ))}
              </div>
              <div className="py-1 space-y-0.5">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span>{formatFCFA(subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold" style={{ fontSize: 14 }}>
                  <span>Total</span>
                  <span>{formatFCFA(subtotal)}</span>
                </div>
              </div>
              <div className="border-t border-gray-400 pt-1 text-gray-700">
                <div className="flex justify-between">
                  <span>Paiement</span>
                  <span>Espèces</span>
                </div>
              </div>
              <p className="text-center text-gray-500 mt-2">Merci de votre visite !</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
