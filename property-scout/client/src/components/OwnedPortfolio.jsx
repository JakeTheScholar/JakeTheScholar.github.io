import { useState, useMemo } from 'react';
import { monthlyPayment, formatCurrency, formatPct } from '../utils/mortgage';

const STORAGE_KEY = 'property-scout-owned';

function getOwned() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveOwned(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

const emptyProperty = {
  address: '', purchasePrice: '', currentValue: '',
  loanBalance: '', rate: '', units: 2,
  actualRentPerUnit: '', vacancy: 0,
  monthlyTax: '', monthlyInsurance: '',
  monthlyMaintenance: '', monthlyPM: '', otherMonthlyExpenses: '',
  downPayment: '', purchaseDate: '',
};

export default function OwnedPortfolio() {
  const [owned, setOwned] = useState(getOwned);
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyProperty);
  const [expanded, setExpanded] = useState(true);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  function handleSave(e) {
    e.preventDefault();
    const entry = {
      ...form,
      id: editIdx !== null ? owned[editIdx].id : `owned-${Date.now()}`,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      currentValue: parseFloat(form.currentValue) || 0,
      loanBalance: parseFloat(form.loanBalance) || 0,
      rate: parseFloat(form.rate) || 0,
      units: parseInt(form.units) || 2,
      actualRentPerUnit: parseFloat(form.actualRentPerUnit) || 0,
      vacancy: parseFloat(form.vacancy) || 0,
      monthlyTax: parseFloat(form.monthlyTax) || 0,
      monthlyInsurance: parseFloat(form.monthlyInsurance) || 0,
      monthlyMaintenance: parseFloat(form.monthlyMaintenance) || 0,
      monthlyPM: parseFloat(form.monthlyPM) || 0,
      otherMonthlyExpenses: parseFloat(form.otherMonthlyExpenses) || 0,
      downPayment: parseFloat(form.downPayment) || 0,
    };
    const updated = [...owned];
    if (editIdx !== null) {
      updated[editIdx] = entry;
    } else {
      updated.push(entry);
    }
    saveOwned(updated);
    setOwned(updated);
    setForm(emptyProperty);
    setShowForm(false);
    setEditIdx(null);
  }

  function handleEdit(i) {
    setForm(owned[i]);
    setEditIdx(i);
    setShowForm(true);
  }

  function handleDelete(i) {
    const updated = owned.filter((_, idx) => idx !== i);
    saveOwned(updated);
    setOwned(updated);
  }

  const analyses = useMemo(() => owned.map(p => analyze(p)), [owned]);

  const portfolio = useMemo(() => {
    if (analyses.length === 0) return null;
    const totalMonthly = analyses.reduce((s, a) => s + a.monthlyCF, 0);
    const totalEquity = analyses.reduce((s, a) => s + a.equity, 0);
    const totalValue = analyses.reduce((s, a) => s + a.currentValue, 0);
    const totalDebt = analyses.reduce((s, a) => s + a.loanBalance, 0);
    const totalInvested = analyses.reduce((s, a) => s + a.downPayment, 0);
    const annualCF = totalMonthly * 12;
    const portfolioCoc = totalInvested > 0 ? (annualCF / totalInvested) * 100 : 0;
    return { totalMonthly, totalEquity, totalValue, totalDebt, totalInvested, annualCF, portfolioCoc, count: analyses.length };
  }, [analyses]);

  return (
    <div className="card overflow-hidden animate-fade-in-up">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🏘️</span>
          <div className="text-left">
            <h2 className="text-lg font-bold text-white">My Portfolio</h2>
            <p className="text-xs text-gray-500">Track your currently owned/rented properties</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {portfolio && (
            <div className="hidden sm:flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Monthly CF</p>
                <p className={`text-sm font-bold ${portfolio.totalMonthly >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(portfolio.totalMonthly)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Total Equity</p>
                <p className="text-sm font-bold text-blue-400">{formatCurrency(portfolio.totalEquity)}</p>
              </div>
            </div>
          )}
          <svg className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 p-4 md:p-5 space-y-4 animate-slide-down">
          {/* Portfolio Summary */}
          {portfolio && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Properties" value={portfolio.count} />
              <Stat label="Monthly Cash Flow" value={formatCurrency(portfolio.totalMonthly)} color={portfolio.totalMonthly >= 0 ? 'green' : 'red'} />
              <Stat label="Annual Cash Flow" value={formatCurrency(portfolio.annualCF)} color={portfolio.annualCF >= 0 ? 'green' : 'red'} />
              <Stat label="Portfolio CoC" value={formatPct(portfolio.portfolioCoc)} color={portfolio.portfolioCoc >= 0 ? 'green' : 'red'} />
              <Stat label="Total Value" value={formatCurrency(portfolio.totalValue)} />
              <Stat label="Total Debt" value={formatCurrency(portfolio.totalDebt)} />
              <Stat label="Total Equity" value={formatCurrency(portfolio.totalEquity)} color="blue" />
              <Stat label="LTV" value={formatPct(portfolio.totalValue > 0 ? (portfolio.totalDebt / portfolio.totalValue) * 100 : 0)} />
            </div>
          )}

          {/* Property Cards */}
          {analyses.map((a, i) => (
            <div key={a.id} className="bg-gray-800/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{a.address}</h3>
                  <p className="text-xs text-gray-500">{a.units} units | Purchased {a.purchaseDate || 'N/A'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(i)} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(i)} className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
                <Metric label="Gross Rent" value={formatCurrency(a.grossRent)} />
                <Metric label="Mortgage" value={formatCurrency(a.mortgagePayment)} />
                <Metric label="Expenses" value={formatCurrency(a.totalExpenses)} />
                <Metric label="Net CF/mo" value={formatCurrency(a.monthlyCF)} color={a.monthlyCF >= 0 ? 'green' : 'red'} />
                <Metric label="CoC Return" value={formatPct(a.coc)} color={a.coc >= 0 ? 'green' : 'red'} />
                <Metric label="Cap Rate" value={formatPct(a.capRate)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
                <Metric label="Value" value={formatCurrency(a.currentValue)} />
                <Metric label="Owed" value={formatCurrency(a.loanBalance)} />
                <Metric label="Equity" value={formatCurrency(a.equity)} color="blue" />
                <Metric label="LTV" value={formatPct(a.ltv)} />
                <Metric label="DSCR" value={a.dscr.toFixed(2)} color={a.dscr >= 1.25 ? 'green' : a.dscr >= 1 ? 'yellow' : 'red'} />
                <Metric label="Annual CF" value={formatCurrency(a.monthlyCF * 12)} color={a.monthlyCF >= 0 ? 'green' : 'red'} />
              </div>
            </div>
          ))}

          {/* Add / Edit Form */}
          {showForm ? (
            <form onSubmit={handleSave} className="bg-gray-800/30 rounded-lg p-4 space-y-4 animate-slide-down">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{editIdx !== null ? 'Edit' : 'Add'} Owned Property</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditIdx(null); setForm(emptyProperty); }} className="text-gray-500 hover:text-white text-sm">Cancel</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Address *</label>
                  <input type="text" value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Main St, City, ST" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Purchase Price *</label>
                  <input type="number" value={form.purchasePrice} onChange={e => update('purchasePrice', e.target.value)} placeholder="200000" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Current Value</label>
                  <input type="number" value={form.currentValue} onChange={e => update('currentValue', e.target.value)} placeholder="220000" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Loan Balance *</label>
                  <input type="number" value={form.loanBalance} onChange={e => update('loanBalance', e.target.value)} placeholder="190000" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Interest Rate %</label>
                  <input type="number" value={form.rate} onChange={e => update('rate', e.target.value)} placeholder="6.75" step="0.125" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Units</label>
                  <select value={form.units} onChange={e => update('units', e.target.value)} className="input w-full">
                    <option value={2}>Duplex (2)</option>
                    <option value={3}>Triplex (3)</option>
                    <option value={4}>Fourplex (4)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rent/Unit (actual) *</label>
                  <input type="number" value={form.actualRentPerUnit} onChange={e => update('actualRentPerUnit', e.target.value)} placeholder="950" className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vacant Units</label>
                  <input type="number" value={form.vacancy} onChange={e => update('vacancy', e.target.value)} placeholder="0" min="0" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Monthly Tax</label>
                  <input type="number" value={form.monthlyTax} onChange={e => update('monthlyTax', e.target.value)} placeholder="200" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Monthly Insurance</label>
                  <input type="number" value={form.monthlyInsurance} onChange={e => update('monthlyInsurance', e.target.value)} placeholder="100" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Monthly Maintenance</label>
                  <input type="number" value={form.monthlyMaintenance} onChange={e => update('monthlyMaintenance', e.target.value)} placeholder="150" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Monthly PM Fee</label>
                  <input type="number" value={form.monthlyPM} onChange={e => update('monthlyPM', e.target.value)} placeholder="0" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Other Expenses/mo</label>
                  <input type="number" value={form.otherMonthlyExpenses} onChange={e => update('otherMonthlyExpenses', e.target.value)} placeholder="0" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Down Payment Paid</label>
                  <input type="number" value={form.downPayment} onChange={e => update('downPayment', e.target.value)} placeholder="7000" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Purchase Date</label>
                  <input type="month" value={form.purchaseDate} onChange={e => update('purchaseDate', e.target.value)} className="input w-full" />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full">{editIdx !== null ? 'Update' : 'Add'} Property</button>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="btn-secondary text-sm w-full">+ Add Owned Property</button>
          )}

          {owned.length === 0 && !showForm && (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm">No owned properties yet. Add your first duplex to start tracking.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function analyze(p) {
  const units = parseInt(p.units) || 2;
  const occupiedUnits = Math.max(0, units - (parseInt(p.vacancy) || 0));
  const grossRent = p.actualRentPerUnit * occupiedUnits;
  const mortgagePayment = p.loanBalance > 0 && p.rate > 0 ? monthlyPayment(p.loanBalance, p.rate) : 0;
  const totalExpenses = p.monthlyTax + p.monthlyInsurance + p.monthlyMaintenance + p.monthlyPM + p.otherMonthlyExpenses;
  const monthlyCF = grossRent - mortgagePayment - totalExpenses;
  const annualCF = monthlyCF * 12;
  const currentValue = p.currentValue || p.purchasePrice;
  const equity = currentValue - p.loanBalance;
  const ltv = currentValue > 0 ? (p.loanBalance / currentValue) * 100 : 0;
  const coc = p.downPayment > 0 ? (annualCF / p.downPayment) * 100 : 0;

  // NOI for cap rate (gross rent at full occupancy minus operating expenses, no mortgage)
  const grossAtFull = p.actualRentPerUnit * units;
  const annualNOI = (grossAtFull * 12) - (totalExpenses * 12);
  const capRate = currentValue > 0 ? (annualNOI / currentValue) * 100 : 0;

  // DSCR
  const annualDebt = mortgagePayment * 12;
  const dscr = annualDebt > 0 ? annualNOI / annualDebt : Infinity;

  return {
    ...p, grossRent, mortgagePayment, totalExpenses, monthlyCF, annualCF,
    currentValue, equity, ltv, coc, capRate, dscr,
  };
}

function Stat({ label, value, color }) {
  const colors = { green: 'text-green-400', red: 'text-red-400', blue: 'text-blue-400', yellow: 'text-yellow-400' };
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-sm font-bold ${colors[color] || 'text-white'}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value, color }) {
  const colors = { green: 'text-green-400', red: 'text-red-400', blue: 'text-blue-400', yellow: 'text-yellow-400' };
  return (
    <div className="bg-gray-800/20 rounded-lg p-2">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-sm font-bold ${colors[color] || 'text-gray-300'}`}>{value}</p>
    </div>
  );
}
