import { useState, useMemo } from 'react';
import { fullAnalysis, formatCurrency, formatPct } from '../utils/mortgage';
import { calculateNeighborhoodScore, getDefaultNeighborhoodData } from '../utils/neighborhood';
import NeighborhoodBadge from './NeighborhoodBadge';

export default function ROICalculator({ property, onClose }) {
  const [assumptions, setAssumptions] = useState({
    downPct: 3.5,
    rate: 6.75,
    taxRate: 1.1,
    insuranceAnnual: 1200,
    vacancyPct: 8,
    maintenancePct: 10,
    closingCostPct: 3,
    appreciationPct: 3,
    rentPerUnit: null,
  });

  const update = (key, value) => setAssumptions(prev => ({ ...prev, [key]: value }));

  const analysis = useMemo(() => fullAnalysis(property, assumptions), [property, assumptions]);
  const nhData = getDefaultNeighborhoodData(property);
  const nh = calculateNeighborhoodScore(nhData);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="card max-w-3xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">{property.address}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl font-bold text-green-400">{formatCurrency(property.price)}</span>
              <NeighborhoodBadge badge={nh.badge} score={nh.overall} />
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Assumptions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Assumptions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Down Payment %" value={assumptions.downPct} onChange={v => update('downPct', v)} suffix="%" />
              <Field label="Interest Rate" value={assumptions.rate} onChange={v => update('rate', v)} suffix="%" step="0.125" />
              <Field label="Rent/Unit" value={assumptions.rentPerUnit || analysis.estimatedRent} onChange={v => update('rentPerUnit', v)} prefix="$" />
              <Field label="Property Tax Rate" value={assumptions.taxRate} onChange={v => update('taxRate', v)} suffix="%" step="0.1" />
              <Field label="Insurance/yr" value={assumptions.insuranceAnnual} onChange={v => update('insuranceAnnual', v)} prefix="$" step="100" />
              <Field label="Vacancy" value={assumptions.vacancyPct} onChange={v => update('vacancyPct', v)} suffix="%" />
              <Field label="Maintenance" value={assumptions.maintenancePct} onChange={v => update('maintenancePct', v)} suffix="%" />
              <Field label="Appreciation" value={assumptions.appreciationPct} onChange={v => update('appreciationPct', v)} suffix="%" step="0.5" />
            </div>
          </div>

          {/* Investment Summary */}
          <div className="grid grid-cols-3 gap-4">
            <MetricBox label="Down Payment" value={formatCurrency(analysis.downPayment)} sub={`${assumptions.downPct}%`} />
            <MetricBox label="Closing Costs" value={formatCurrency(analysis.closingCosts)} sub={`${assumptions.closingCostPct}%`} />
            <MetricBox label="Total Cash In" value={formatCurrency(analysis.totalInvested)} highlight />
          </div>

          {/* Monthly Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Monthly Housing Cost</h3>
            <div className="grid grid-cols-4 gap-3">
              <MetricBox label="P&I" value={formatCurrency(analysis.housing.pi)} />
              <MetricBox label="Taxes" value={formatCurrency(analysis.housing.tax)} />
              <MetricBox label="Insurance" value={formatCurrency(analysis.housing.insurance)} />
              <MetricBox label="Total PITI" value={formatCurrency(analysis.housing.total)} highlight />
            </div>
          </div>

          {/* Scenarios */}
          <div className="grid md:grid-cols-2 gap-4">
            <ScenarioCard
              title="Live-In Hack"
              subtitle={`Rent ${analysis.units - 1} unit(s), live in 1`}
              cashFlow={analysis.liveIn.net}
              coc={analysis.liveIn.coc}
              annual={analysis.liveIn.annual}
              color="green"
            />
            <ScenarioCard
              title="Full Rental"
              subtitle={`Rent all ${analysis.units} units (after move out)`}
              cashFlow={analysis.fullRental.net}
              coc={analysis.fullRental.coc}
              annual={analysis.fullRental.annual}
              color="blue"
            />
          </div>

          {/* 2-Year Equity */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Equity After 2 Years</h3>
            <div className="grid grid-cols-3 gap-4">
              <MetricBox label="Principal Paydown" value={formatCurrency(analysis.equity.principalPaydown)} />
              <MetricBox label="Appreciation" value={formatCurrency(analysis.equity.appreciation)} sub={`@ ${assumptions.appreciationPct}%/yr`} />
              <MetricBox label="Total Equity Built" value={formatCurrency(analysis.equity.totalEquity)} highlight />
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <MetricBox label="Break-Even Rent" value={formatCurrency(analysis.breakEvenRent)} sub="per unit to cover PITI" />
            <MetricBox label="Cap Rate" value={formatPct(analysis.capRate)} sub="fully rented NOI / price" />
            <MetricBox label="Est. Home Value (2yr)" value={formatCurrency(analysis.equity.futureValue)} />
          </div>

          {/* Neighborhood Scores */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Neighborhood Scores</h3>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(nh.scores).map(([key, val]) => (
                <div key={key} className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-lg font-bold text-white">{val}</p>
                  <div className="w-full h-1 bg-gray-700 rounded-full mt-1">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${val * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, prefix, suffix, step = '1' }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          className={`input w-full text-sm ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-6' : ''}`}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

function MetricBox({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-green-600/10 border border-green-600/20' : 'bg-gray-800/50'}`}>
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
    </div>
  );
}

function ScenarioCard({ title, subtitle, cashFlow, coc, annual, color }) {
  const positive = cashFlow >= 0;
  const colorClasses = color === 'green'
    ? 'border-green-600/20 bg-green-600/5'
    : 'border-blue-600/20 bg-blue-600/5';

  return (
    <div className={`rounded-xl border p-4 ${colorClasses}`}>
      <h4 className="font-semibold text-white">{title}</h4>
      <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Monthly Cash Flow</span>
          <span className={`text-sm font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(cashFlow)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Annual Cash Flow</span>
          <span className={`text-sm font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(annual)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Cash-on-Cash Return</span>
          <span className={`text-sm font-bold ${color === 'green' ? 'text-green-400' : 'text-blue-400'}`}>{formatPct(coc)}</span>
        </div>
      </div>
    </div>
  );
}
