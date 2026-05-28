import { useEffect, useRef, useState } from 'react';
import { Palette, Upload, X, RefreshCw, Save, ImagePlus, AlertTriangle } from 'lucide-react';
import { brandingApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { compressImage } from '../../utils/image';
import { relativeLuminance } from '../../utils/color';
import { useAuth } from '../../contexts/AuthContext';
import { Branding } from '../../types';

const DEFAULT_PRIMARY    = '#D4AF37';
const DEFAULT_ACCENT     = '#E4C86A';
const DEFAULT_BACKGROUND = '#000000';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-5';
const INPUT_CLASS =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';

// Seuil d'avertissement (~2.5 Mo en caractères base64)
const WARN_SIZE = 2_500_000;

function sizeWarning(dataUrl: string | null): boolean {
  return !!dataUrl && dataUrl.length > WARN_SIZE;
}

// Avertit si la luminance d'une couleur est trop faible (texte noir peu lisible dessus).
function isLowLuminance(hex: string): boolean {
  return relativeLuminance(hex) < 0.18;
}

interface UploadZoneProps {
  label: string;
  value: string | null;
  onSelect: (dataUrl: string) => void;
  onRemove: () => void;
  maxSize: number;
  quality: number;
  aspectHint?: string;
}

function UploadZone({ label, value, onSelect, onRemove, maxSize, quality, aspectHint }: UploadZoneProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setErr('');
    try {
      const dataUrl = await compressImage(file, maxSize, quality);
      onSelect(dataUrl);
    } catch {
      setErr('Image invalide ou trop grande.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-neutral-200 mb-2">
        {label}
        {aspectHint && <span className="ml-2 text-xs text-neutral-500">({aspectHint})</span>}
      </p>
      <div className="flex items-start gap-4">
        {/* Aperçu */}
        <div className="w-24 h-24 rounded-xl border border-dashed border-neutral-700 flex items-center justify-center overflow-hidden flex-shrink-0 bg-neutral-900">
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-8 h-8 text-neutral-600" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 px-3 py-1.5 rounded-lg cursor-pointer w-fit flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            {busy ? 'Compression…' : 'Choisir une image'}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await handleFile(file);
                e.target.value = '';
              }}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 w-fit"
            >
              <X className="w-3 h-3" /> Retirer
            </button>
          )}
          {err && <p className="text-xs text-rose-400">{err}</p>}
          {value && sizeWarning(value) && (
            <p className="text-xs text-amber-400">
              Image volumineuse ({Math.round(value.length / 1024)} ko). Risque de rejet serveur.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface ColorPickerRowProps {
  label: string;
  description?: string;
  value: string;
  hexInput: string;
  onColorChange: (hex: string) => void;
  onHexInput: (val: string) => void;
  onReset: () => void;
  resetLabel?: string;
  warnLowLuminance?: boolean;
}

function ColorPickerRow({
  label,
  description,
  value,
  hexInput,
  onColorChange,
  onHexInput,
  onReset,
  resetLabel = 'Réinitialiser',
  warnLowLuminance = false,
}: ColorPickerRowProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-neutral-200 mb-1">{label}</p>
      {description && <p className="text-xs text-neutral-500 mb-3">{description}</p>}
      <div className="flex items-center gap-4 flex-wrap">
        <input
          type="color"
          value={value}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-14 h-14 rounded-xl cursor-pointer border-2 border-neutral-700 bg-transparent p-0.5"
          title="Choisir une couleur"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-neutral-400">Code hexadécimal</label>
          <input
            type="text"
            maxLength={7}
            value={hexInput}
            onChange={(e) => onHexInput(e.target.value)}
            className={`${INPUT_CLASS} w-36 font-mono uppercase`}
            placeholder="#D4AF37"
          />
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 px-3 py-2 rounded-lg border border-neutral-700 hover:border-neutral-600 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {resetLabel}
        </button>
        {/* Aperçu couleur */}
        <div
          className="w-10 h-10 rounded-full border border-neutral-700"
          style={{ backgroundColor: value }}
          title="Aperçu couleur"
        />
      </div>
      {warnLowLuminance && isLowLuminance(value) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Cette couleur est très sombre — le texte noir des boutons pourrait être peu lisible.
        </div>
      )}
    </div>
  );
}

interface LocalBranding {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  logoUrl: string | null;
  coverUrl: string | null;
  backgroundUrl: string | null;
  whatsapp: string;
}

export default function BrandingTab() {
  const { refreshBranding, currentRestaurant } = useAuth();
  const [local, setLocal] = useState<LocalBranding>({
    primaryColor:    DEFAULT_PRIMARY,
    accentColor:     DEFAULT_ACCENT,
    backgroundColor: DEFAULT_BACKGROUND,
    logoUrl:     null,
    coverUrl:    null,
    backgroundUrl: null,
    whatsapp: '',
  });

  // Champs texte hex indépendants (pour saisie partielle sans casser le picker)
  const [hexPrimary,    setHexPrimary]    = useState(DEFAULT_PRIMARY);
  const [hexAccent,     setHexAccent]     = useState(DEFAULT_ACCENT);
  const [hexBackground, setHexBackground] = useState(DEFAULT_BACKGROUND);

  const [loading, setLoading] = useState(true);
  const [busy,  setBusy]  = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Toujours charger via l'API (source de vérité) pour éviter d'écraser avec des défauts
  // si ctxBranding est encore null au montage.
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const b: Branding = await brandingApi.get();
        const primary    = b.primaryColor    || DEFAULT_PRIMARY;
        const accent     = b.accentColor     || DEFAULT_ACCENT;
        const bgColor    = b.backgroundColor || DEFAULT_BACKGROUND;
        setLocal({
          primaryColor:    primary,
          accentColor:     accent,
          backgroundColor: bgColor,
          logoUrl:      b.logoUrl,
          coverUrl:     b.coverUrl,
          backgroundUrl: b.backgroundUrl,
          whatsapp: b.whatsapp ?? '',
        });
        setHexPrimary(primary);
        setHexAccent(accent);
        setHexBackground(bgColor);
      } catch (e) {
        setError(getApiError(e));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // --- Helpers pour chaque champ couleur ---
  const setColor = (field: 'primaryColor' | 'accentColor' | 'backgroundColor', hex: string) => {
    setLocal((l) => ({ ...l, [field]: hex }));
    if (field === 'primaryColor')    setHexPrimary(hex);
    if (field === 'accentColor')     setHexAccent(hex);
    if (field === 'backgroundColor') setHexBackground(hex);
  };

  const handleHexInput = (
    field: 'primaryColor' | 'accentColor' | 'backgroundColor',
    setHex: (v: string) => void,
    val: string
  ) => {
    setHex(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setLocal((l) => ({ ...l, [field]: val }));
    }
  };

  const save = async () => {
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      await brandingApi.update({
        primaryColor:    local.primaryColor,
        accentColor:     local.accentColor,
        backgroundColor: local.backgroundColor,
        logoUrl:      local.logoUrl     ?? '',
        coverUrl:     local.coverUrl    ?? '',
        backgroundUrl: local.backgroundUrl ?? '',
        whatsapp: local.whatsapp,
      });
      await refreshBranding();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400 text-sm">
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className={PANEL}>
        <div className="flex items-center gap-3 mb-1">
          <Palette className="w-5 h-5 text-gold-400" />
          <h2 className="text-lg font-bold text-neutral-100">Personnalisation</h2>
        </div>
        <p className="text-sm text-neutral-400">
          Personnalisez l'apparence de votre espace de travail : couleurs, logo, image de couverture et fond d'écran.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Couleurs */}
      <div className={PANEL}>
        <h3 className="font-semibold text-neutral-100 mb-5">Couleurs</h3>
        <div className="space-y-6">
          <ColorPickerRow
            label="Couleur principale"
            description="Thématise toute l'application (boutons, accents, anneaux de focus…)."
            value={local.primaryColor}
            hexInput={hexPrimary}
            onColorChange={(hex) => setColor('primaryColor', hex)}
            onHexInput={(val) => handleHexInput('primaryColor', setHexPrimary, val)}
            onReset={() => setColor('primaryColor', DEFAULT_PRIMARY)}
            warnLowLuminance
          />

          <hr className="border-neutral-800" />

          <ColorPickerRow
            label="Couleur d'accent"
            description="Nuance secondaire (survols, états actifs, détails de l'interface)."
            value={local.accentColor}
            hexInput={hexAccent}
            onColorChange={(hex) => setColor('accentColor', hex)}
            onHexInput={(val) => handleHexInput('accentColor', setHexAccent, val)}
            onReset={() => setColor('accentColor', DEFAULT_ACCENT)}
          />

          <hr className="border-neutral-800" />

          <ColorPickerRow
            label="Couleur de fond"
            description="Utilisée quand aucune image de fond n'est configurée."
            value={local.backgroundColor}
            hexInput={hexBackground}
            onColorChange={(hex) => setColor('backgroundColor', hex)}
            onHexInput={(val) => handleHexInput('backgroundColor', setHexBackground, val)}
            onReset={() => setColor('backgroundColor', DEFAULT_BACKGROUND)}
          />
        </div>
      </div>

      {/* Images */}
      <div className={PANEL}>
        <h3 className="font-semibold text-neutral-100 mb-5">Images</h3>
        <div className="space-y-6">
          <UploadZone
            label="Logo"
            value={local.logoUrl}
            onSelect={(url) => setLocal((l) => ({ ...l, logoUrl: url }))}
            onRemove={() => setLocal((l) => ({ ...l, logoUrl: null }))}
            maxSize={256}
            quality={0.85}
            aspectHint="carré, 256px max"
          />
          <UploadZone
            label="Image de couverture"
            value={local.coverUrl}
            onSelect={(url) => setLocal((l) => ({ ...l, coverUrl: url }))}
            onRemove={() => setLocal((l) => ({ ...l, coverUrl: null }))}
            maxSize={1280}
            quality={0.7}
            aspectHint="16:9 recommandé, 1280px max"
          />
          <UploadZone
            label="Fond de l'espace de travail"
            value={local.backgroundUrl}
            onSelect={(url) => setLocal((l) => ({ ...l, backgroundUrl: url }))}
            onRemove={() => setLocal((l) => ({ ...l, backgroundUrl: null }))}
            maxSize={1600}
            quality={0.6}
            aspectHint="paysage, 1600px max"
          />
        </div>
      </div>

      {/* WhatsApp */}
      <div className={PANEL}>
        <h3 className="font-semibold text-neutral-100 mb-2">Contact commandes</h3>
        <p className="text-sm text-neutral-400 mb-4">
          Numéro WhatsApp affiché sur votre page publique pour que les clients passent commande.
        </p>
        <div>
          <label className="block text-sm font-medium text-neutral-200 mb-1">
            Numéro WhatsApp (commandes clients)
          </label>
          <input
            type="text"
            value={local.whatsapp}
            onChange={(e) => setLocal((l) => ({ ...l, whatsapp: e.target.value }))}
            placeholder="+225 07 07 14 59 59"
            maxLength={30}
            className={`${INPUT_CLASS} max-w-xs`}
          />
          <p className="text-xs text-neutral-500 mt-1">Laissez vide pour ne pas afficher de bouton WhatsApp.</p>
        </div>
      </div>

      {/* Aperçu live */}
      <div className={PANEL}>
        <h3 className="font-semibold text-neutral-100 mb-4">Aperçu</h3>
        <div
          className="rounded-xl overflow-hidden border border-neutral-800"
          style={local.backgroundUrl ? {
            backgroundImage: `linear-gradient(rgba(0,0,0,0.82), rgba(0,0,0,0.88)), url(${local.backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : { backgroundColor: local.backgroundColor }}
        >
          {/* Barre de nav mockup */}
          <div className="bg-black/60 border-b border-neutral-800 px-4 py-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"
              style={{ border: `2px solid ${local.primaryColor}` }}
            >
              {local.logoUrl ? (
                <img src={local.logoUrl} alt="Logo" className="w-9 h-9 object-cover" />
              ) : (
                <span className="text-lg" style={{ color: local.primaryColor }}>✦</span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-100 leading-tight">{currentRestaurant?.name ?? 'Mon Restaurant'}</p>
              <p className="text-xs text-neutral-400">propriétaire</p>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {['Dashboard', 'Gestion', 'Caisse'].map((label, i) => (
                <span
                  key={label}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={i === 1
                    ? { backgroundColor: local.primaryColor, color: '#000' }
                    : { color: '#a3a3a3' }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          {/* Contenu mockup */}
          <div className="p-6">
            {local.coverUrl && (
              <img
                src={local.coverUrl}
                alt="Couverture"
                className="w-full h-28 object-cover rounded-xl mb-4"
              />
            )}
            <div className="bg-neutral-900/70 rounded-xl p-4 border border-neutral-800 space-y-3">
              <p className="text-neutral-300 text-sm">Exemple de contenu avec votre thème de couleurs</p>
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-bold text-black"
                  style={{ backgroundColor: local.primaryColor }}
                >
                  Bouton principal
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-bold text-black"
                  style={{ backgroundColor: local.accentColor }}
                >
                  Accent
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enregistrer */}
      <div className="flex items-center justify-end gap-4 pb-4">
        {saved && (
          <span className="text-emerald-400 text-sm font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Enregistré
          </span>
        )}
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-black font-bold px-5 py-2.5 rounded-xl transition"
        >
          <Save className="w-4 h-4" />
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
