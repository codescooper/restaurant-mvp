import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, ImagePlus, Link2 } from 'lucide-react';
import { employeeApi, userApi, EmployeeInput } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { Employee, User } from '../../types';
import { formatFCFA } from '../../utils/format';
import { compressImage } from '../../utils/image';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full p-6 max-h-[90vh] overflow-y-auto';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

const CONTRACT_TYPES = ['CDI', 'CDD', 'extra', 'stagiaire', 'autre'];
const SALARY_PERIODS = ['mensuel', 'horaire', 'journalier'];
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'espèces', label: 'Espèces' },
  { value: 'virement', label: 'Virement' },
  { value: 'mobile_money', label: 'Mobile Money' },
];
const PERIOD_SUFFIX: Record<string, string> = { mensuel: '/mois', horaire: '/h', journalier: '/jour' };

interface EmpForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  photoUrl: string;
  position: string;
  contractType: string;
  hireDate: string;
  endDate: string;
  salary: string;
  salaryPeriod: string;
  paymentMethod: string;
  emergencyContact: string;
  emergencyPhone: string;
  idNumber: string;
  notes: string;
  isActive: boolean;
  userId: string;
}

const EMPTY: EmpForm = {
  firstName: '', lastName: '', phone: '', email: '', address: '', photoUrl: '',
  position: '', contractType: '', hireDate: '', endDate: '',
  salary: '', salaryPeriod: 'mensuel', paymentMethod: '',
  emergencyContact: '', emergencyPhone: '', idNumber: '', notes: '',
  isActive: true, userId: '',
};

// ISO -> 'YYYY-MM-DD' pour les <input type="date">.
const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export default function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmpForm>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = () => employeeApi.list().then(setEmployees).catch((e) => setError(getApiError(e)));

  useEffect(() => {
    load();
    userApi.list().then(setUsers).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setModal(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({
      firstName: e.firstName,
      lastName: e.lastName,
      phone: e.phone ?? '',
      email: e.email ?? '',
      address: e.address ?? '',
      photoUrl: e.photoUrl ?? '',
      position: e.position ?? '',
      contractType: e.contractType ?? '',
      hireDate: toDateInput(e.hireDate),
      endDate: toDateInput(e.endDate),
      salary: e.salary != null ? String(e.salary) : '',
      salaryPeriod: e.salaryPeriod ?? 'mensuel',
      paymentMethod: e.paymentMethod ?? '',
      emergencyContact: e.emergencyContact ?? '',
      emergencyPhone: e.emergencyPhone ?? '',
      idNumber: e.idNumber ?? '',
      notes: e.notes ?? '',
      isActive: e.isActive,
      userId: e.userId != null ? String(e.userId) : '',
    });
    setError('');
    setModal(true);
  };

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Prénom et nom requis');
      return;
    }
    const payload: EmployeeInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      photoUrl: form.photoUrl !== undefined ? form.photoUrl : undefined,
      position: form.position || undefined,
      contractType: form.contractType || undefined,
      hireDate: form.hireDate || undefined,
      endDate: form.endDate || undefined,
      salary: form.salary !== '' ? Number(form.salary) : undefined,
      salaryPeriod: form.salaryPeriod || undefined,
      paymentMethod: form.paymentMethod || undefined,
      emergencyContact: form.emergencyContact || undefined,
      emergencyPhone: form.emergencyPhone || undefined,
      idNumber: form.idNumber || undefined,
      notes: form.notes || undefined,
      isActive: form.isActive,
      userId: form.userId ? Number(form.userId) : null,
    };
    setBusy(true);
    setError('');
    try {
      if (editing) await employeeApi.update(editing.id, payload);
      else await employeeApi.create(payload);
      setModal(false);
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: Employee) => {
    if (!window.confirm(`Supprimer la fiche de ${e.firstName} ${e.lastName} ?`)) return;
    try {
      await employeeApi.remove(e.id);
      load();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const setF = (patch: Partial<EmpForm>) => setForm((f) => ({ ...f, ...patch }));

  // Comptes déjà rattachés à un autre employé : on les masque de la liste de sélection.
  const linkedElsewhere = new Set(
    employees.filter((e) => e.userId != null && e.id !== editing?.id).map((e) => e.userId as number)
  );
  const selectableUsers = users.filter((u) => !linkedElsewhere.has(u.id));

  return (
    <div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${BTN_GOLD}`}>
          <Plus className="w-5 h-5" /> Nouvel employé
        </button>
      </div>

      <div className={`${PANEL} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left p-3">Employé</th>
              <th className="text-left p-3">Poste</th>
              <th className="text-left p-3">Contrat</th>
              <th className="text-left p-3">Compte</th>
              <th className="text-right p-3">Salaire</th>
              <th className="text-center p-3">Statut</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-neutral-800 hover:bg-neutral-900">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {e.photoUrl ? (
                      <img src={e.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400">
                        {e.firstName[0]}{e.lastName[0]}
                      </span>
                    )}
                    <div>
                      <div className="font-medium text-neutral-100">{e.firstName} {e.lastName}</div>
                      {e.phone && <div className="text-xs text-neutral-500">{e.phone}</div>}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-neutral-400">{e.position || '—'}</td>
                <td className="p-3 text-neutral-400">{e.contractType || '—'}</td>
                <td className="p-3 text-neutral-400">
                  {e.user ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-neutral-800 px-2 py-0.5 rounded-full">
                      <Link2 className="w-3 h-3 text-gold-400" /> {e.user.username}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3 text-right font-semibold text-gold-400 whitespace-nowrap">
                  {e.salary != null ? (
                    <>
                      {formatFCFA(e.salary)}
                      <span className="text-xs font-normal text-neutral-500">{PERIOD_SUFFIX[e.salaryPeriod ?? ''] ?? ''}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
                    {e.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(e)} className="p-1.5 text-gold-400 hover:bg-neutral-800 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(e)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-neutral-500">Aucun employé</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-2xl`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-100">{editing ? 'Modifier la fiche employé' : 'Nouvel employé'}</h3>
              <button onClick={() => setModal(false)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}

            {/* Identité & contact */}
            <Section title="Identité & contact" />
            <div className="flex items-start gap-3 mb-3">
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="" className="w-16 h-16 rounded-full object-cover border border-neutral-700" />
              ) : (
                <span className="w-16 h-16 rounded-full border border-dashed border-neutral-700 flex items-center justify-center text-neutral-600">
                  <ImagePlus className="w-6 h-6" />
                </span>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 px-3 py-1.5 rounded-lg cursor-pointer w-fit">
                  {form.photoUrl ? 'Changer la photo' : 'Choisir une photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      try {
                        setF({ photoUrl: await compressImage(file) });
                      } catch {
                        setError('Image invalide');
                      }
                      ev.target.value = '';
                    }}
                  />
                </label>
                {form.photoUrl && (
                  <button type="button" onClick={() => setF({ photoUrl: '' })} className="text-xs text-rose-400 w-fit">
                    Retirer
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <L label="Prénom *"><input className={INPUT} value={form.firstName} onChange={(e) => setF({ firstName: e.target.value })} /></L>
              <L label="Nom *"><input className={INPUT} value={form.lastName} onChange={(e) => setF({ lastName: e.target.value })} /></L>
              <L label="Téléphone"><input className={INPUT} value={form.phone} onChange={(e) => setF({ phone: e.target.value })} /></L>
              <L label="Email"><input className={INPUT} value={form.email} onChange={(e) => setF({ email: e.target.value })} /></L>
            </div>
            <L label="Adresse"><textarea className={INPUT} rows={2} value={form.address} onChange={(e) => setF({ address: e.target.value })} /></L>

            {/* Contrat */}
            <Section title="Contrat" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <L label="Poste"><input className={INPUT} placeholder="ex. Serveur, Plongeur…" value={form.position} onChange={(e) => setF({ position: e.target.value })} /></L>
              <L label="Type de contrat">
                <select className={INPUT} value={form.contractType} onChange={(e) => setF({ contractType: e.target.value })}>
                  <option value="">—</option>
                  {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </L>
              <L label="Date d'embauche"><input type="date" className={INPUT} value={form.hireDate} onChange={(e) => setF({ hireDate: e.target.value })} /></L>
              <L label="Date de fin"><input type="date" className={INPUT} value={form.endDate} onChange={(e) => setF({ endDate: e.target.value })} /></L>
            </div>

            {/* Rémunération */}
            <Section title="Rémunération" />
            <div className="grid grid-cols-3 gap-3 mb-3">
              <L label="Salaire (FCFA)"><input type="number" min="0" className={INPUT} value={form.salary} onChange={(e) => setF({ salary: e.target.value })} /></L>
              <L label="Périodicité">
                <select className={INPUT} value={form.salaryPeriod} onChange={(e) => setF({ salaryPeriod: e.target.value })}>
                  {SALARY_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </L>
              <L label="Mode de paiement">
                <select className={INPUT} value={form.paymentMethod} onChange={(e) => setF({ paymentMethod: e.target.value })}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </L>
            </div>

            {/* RH & urgence */}
            <Section title="RH & urgence" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <L label="Contact d'urgence"><input className={INPUT} value={form.emergencyContact} onChange={(e) => setF({ emergencyContact: e.target.value })} /></L>
              <L label="Tél. d'urgence"><input className={INPUT} value={form.emergencyPhone} onChange={(e) => setF({ emergencyPhone: e.target.value })} /></L>
              <L label="N° pièce d'identité"><input className={INPUT} value={form.idNumber} onChange={(e) => setF({ idNumber: e.target.value })} /></L>
            </div>
            <L label="Notes internes"><textarea className={INPUT} rows={2} value={form.notes} onChange={(e) => setF({ notes: e.target.value })} /></L>

            {/* Compte & statut */}
            <Section title="Compte & statut" />
            <div className="grid grid-cols-2 gap-3 items-end mb-1">
              <L label="Compte de connexion lié (optionnel)">
                <select className={INPUT} value={form.userId} onChange={(e) => setF({ userId: e.target.value })}>
                  <option value="">Aucun (pas d'accès à l'app)</option>
                  {selectableUsers.map((u) => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                </select>
              </L>
              <label className="flex items-center gap-2 text-sm text-neutral-200 pb-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setF({ isActive: e.target.checked })} />
                Employé actif
              </label>
            </div>

            <button onClick={submit} disabled={busy} className={`w-full mt-4 py-2.5 rounded-xl ${BTN_GOLD}`}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <h4 className="text-sm font-semibold text-gold-400 border-b border-neutral-800 pb-1 mb-3 mt-1">{title}</h4>;
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
