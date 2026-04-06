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
    holdYears: 5,
    rentGrowthPct: 2,
    discountRate: 10,
    sellingCostPct: 6,
  });

  const [activeTab, setActiveTab] = useState('overview');
  const update = (key, value) => setAssumptions(prev => ({ ...prev, [key]: value }));

  const analysis = useMemo(() => fullAnalysis(property, assumptions), [property, assumptions]);
  const nhData = getDefaultNeighborhoodData(property);
  const nh = calculateNeighborhoodScore(nhData);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'dcf', label: 'DCF Analysis' },
    { id: 'cashflows', label: 'Cash Flows' },
    { id: 'neighborhood', label: 'Neighborhood' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4 animate-fade-in">
      <div className="card max-w-4xl w-full my-8 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">{property.address}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl font-bold text-green-400">{formatCurrency(property.price)}</span>
              <NeighborhoodBadge badge={nh.badge} score={nh.overall} />
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:rotate-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {/* Assumptions (always visible) */}
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
              <Field label="Hold Period" value={assumptions.holdYears} onChange={v => update('holdYears', v)} suffix="yr" />
              <Field label="Rent Growth" value={assumptions.rentGrowthPct} onChange={v => update('rentGrowthPct', v)} suffix="%" step="0.5" />
              <Field label="Discount Rate" value={assumptions.discountRate} onChange={v => update('discountRate', v)} suffix="%" />
              <Field label="Selling Costs" value={assumptions.sellingCostPct} onChange={v => update('sellingCostPct', v)} suffix="%" />
            </div>
          </div>

          {activeTab === 'overview' && <OverviewTab analysis={analysis} assumptions={assumptions} />}
          {activeTab === 'dcf' && <DCFTab analysis={analysis} assumptions={assumptions} />}
          {activeTab === 'cashflows' && <CashFlowsTab analysis={analysis} />}
          {activeTab === 'neighborhood' && <NeighborhoodTab nh={nh} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ analysis, assumptions }) {
  return (
    <>
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
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Key Metrics</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          <MetricBox label="Cap Rate" value={formatPct(analysis.capRate)} sub="NOI / price" />
          <MetricBox label="Break-Even Rent" value={formatCurrency(analysis.breakEvenRent)} sub="per unit" />
          <MetricBox label="DSCR" value={analysis.dcf.dscr.toFixed(2)} sub={analysis.dcf.dscr >= 1.25 ? 'Healthy' : analysis.dcf.dscr >= 1.0 ? 'Tight' : 'Negative'} />
          <MetricBox label="GRM" value={analysis.dcf.grm.toFixed(1)} sub="price / annual rent" />
          <MetricBox label="Expense Ratio" value={formatPct(analysis.expenseRatio)} sub="expenses / gross rent" />
          <MetricBox label="Rent-to-Price" value={formatPct(analysis.rentToPriceRatio)} sub={analysis.rentToPriceRatio >= 1.0 ? '1% rule pass' : 'Below 1% rule'} />
          <MetricBox label="Est. Value (2yr)" value={formatCurrency(analysis.equity.futureValue)} />
          <MetricBox label="Loan Amount" value={formatCurrency(analysis.housing.loanAmount)} />
        </div>
      </div>
    </>
  );
}

function DCFTab({ analysis, assumptions }) {
  const { dcf } = analysis;
  const npvPositive = dcf.npv >= 0;
  const irrGood = dcf.irr >= assumptions.discountRate;

  return (
    <>
      {/* DCF Hero Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-xl border p-4 ${npvPositive ? 'border-green-600/30 bg-green-600/5' : 'border-red-600/30 bg-red-600/5'}`}>
          <p className="text-[10px] text-gray-500 uppercase">Net Present Value</p>
          <p className={`text-2xl font-bold ${npvPositive ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(dcf.npv)}</p>
          <p className="text-[10px] text-gray-500">@ {assumptions.discountRate}% discount rate</p>
        </div>
        <div className={`rounded-xl border p-4 ${irrGood ? 'border-green-600/30 bg-green-600/5' : 'border-yellow-600/30 bg-yellow-600/5'}`}>
          <p className="text-[10px] text-gray-500 uppercase">IRR</p>
          <p className={`text-2xl font-bold ${irrGood ? 'text-green-400' : 'text-yellow-400'}`}>{formatPct(dcf.irr)}</p>
          <p className="text-[10px] text-gray-500">{irrGood ? 'Beats discount rate' : 'Below discount rate'}</p>
        </div>
        <div className="rounded-xl border border-blue-600/30 bg-blue-600/5 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Equity Multiple</p>
          <p className="text-2xl font-bold text-blue-400">{dcf.equityMultiple.toFixed(2)}x</p>
          <p className="text-[10px] text-gray-500">{assumptions.holdYears}yr hold</p>
        </div>
        <div className="rounded-xl border border-purple-600/30 bg-purple-600/5 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Total ROI</p>
          <p className="text-2xl font-bold text-purple-400">{formatPct(dcf.totalROI)}</p>
          <p className="text-[10px] text-gray-500">{assumptions.holdYears}yr total return</p>
        </div>
      </div>

      {/* Exit Analysis */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Exit Analysis (Year {assumptions.holdYears})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricBox label="Exit Value" value={formatCurrency(dcf.exitValue)} sub={`@ ${assumptions.appreciationPct}%/yr`} />
          <MetricBox label="Selling Costs" value={formatCurrency(dcf.sellingCosts)} sub={`${assumptions.sellingCostPct}%`} />
          <MetricBox label="Remaining Loan" value={formatCurrency(dcf.annualCashFlows[dcf.annualCashFlows.length - 1]?.loanBalance || 0)} />
          <MetricBox label="Net Sale Proceeds" value={formatCurrency(dcf.saleProceeds)} highlight />
        </div>
      </div>

      {/* Return Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Return Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          <MetricBox label="Total Cash Flow" value={formatCurrency(dcf.totalCashFlow)} sub={`${assumptions.holdYears} years cumulative`} />
          <MetricBox label="Sale Proceeds" value={formatCurrency(dcf.saleProceeds)} sub="after loan payoff + costs" />
          <MetricBox label="Total Return" value={formatCurrency(dcf.totalReturn)} highlight sub={`on ${formatCurrency(dcf.totalInvested)} invested`} />
        </div>
      </div>

      {/* Deal Verdict */}
      <DealVerdict dcf={dcf} assumptions={assumptions} analysis={analysis} />
    </>
  );
}

function DealVerdict({ dcf, assumptions, analysis }) {
  const checks = [
    { label: 'NPV > 0', pass: dcf.npv > 0, value: formatCurrency(dcf.npv) },
    { label: `IRR > ${assumptions.discountRate}%`, pass: dcf.irr > assumptions.discountRate, value: formatPct(dcf.irr) },
    { label: 'DSCR > 1.25', pass: dcf.dscr >= 1.25, value: dcf.dscr.toFixed(2) },
    { label: 'Cap Rate > 6%', pass: analysis.capRate >= 6, value: formatPct(analysis.capRate) },
    { label: '1% Rule', pass: analysis.rentToPriceRatio >= 1.0, value: formatPct(analysis.rentToPriceRatio) },
    { label: 'Cash Flow Positive', pass: analysis.fullRental.net > 0, value: formatCurrency(analysis.fullRental.net) + '/mo' },
  ];

  const passCount = checks.filter(c => c.pass).length;
  const verdict = passCount >= 5 ? 'Strong Buy' : passCount >= 3 ? 'Worth Considering' : 'Pass';
  const verdictColor = passCount >= 5 ? 'text-green-400' : passCount >= 3 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase">Deal Scorecard</h3>
        <span className={`text-lg font-bold ${verdictColor}`}>{verdict} ({passCount}/6)</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-sm">
            <span className={c.pass ? 'text-green-400' : 'text-red-400'}>{c.pass ? '\u2713' : '\u2717'}</span>
            <span className="text-gray-400">{c.label}</span>
            <span className="text-gray-500 ml-auto text-xs">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashFlowsTab({ analysis }) {
  const { dcf } = analysis;
  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Year-by-Year Projections (Fully Rented)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left p-2">Year</th>
                <th className="text-right p-2">Gross Rent</th>
                <th className="text-right p-2">NOI</th>
                <th className="text-right p-2">Debt Service</th>
                <th className="text-right p-2">Cash Flow</th>
                <th className="text-right p-2">Princ. Paid</th>
                <th className="text-right p-2">Loan Bal.</th>
              </tr>
            </thead>
            <tbody>
              {dcf.annualCashFlows.map(yr => (
                <tr key={yr.year} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-2 text-gray-300">Yr {yr.year}</td>
                  <td className="p-2 text-right text-gray-300">{formatCurrency(yr.grossRent)}</td>
                  <td className="p-2 text-right text-gray-300">{formatCurrency(yr.noi)}</td>
                  <td className="p-2 text-right text-gray-400">{formatCurrency(yr.debtService)}</td>
                  <td className={`p-2 text-right font-medium ${yr.cashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(yr.cashFlow)}
                  </td>
                  <td className="p-2 text-right text-blue-400">{formatCurrency(yr.principalPaydown)}</td>
                  <td className="p-2 text-right text-gray-500">{formatCurrency(yr.loanBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 font-medium">
                <td className="p-2 text-gray-300">Total</td>
                <td className="p-2 text-right text-gray-300">{formatCurrency(dcf.annualCashFlows.reduce((s, y) => s + y.grossRent, 0))}</td>
                <td className="p-2 text-right text-gray-300">{formatCurrency(dcf.annualCashFlows.reduce((s, y) => s + y.noi, 0))}</td>
                <td className="p-2 text-right text-gray-400">{formatCurrency(dcf.annualCashFlows.reduce((s, y) => s + y.debtService, 0))}</td>
                <td className={`p-2 text-right font-bold ${dcf.totalCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(dcf.totalCashFlow)}
                </td>
                <td className="p-2 text-right text-blue-400">{formatCurrency(dcf.annualCashFlows.reduce((s, y) => s + y.principalPaydown, 0))}</td>
                <td className="p-2 text-right text-gray-500">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cash Flow Chart (ASCII bar chart) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Cash Flow Trend</h3>
        <div className="space-y-1">
          {dcf.annualCashFlows.map(yr => {
            const maxCF = Math.max(...dcf.annualCashFlows.map(y => Math.abs(y.cashFlow)));
            const pct = maxCF > 0 ? Math.abs(yr.cashFlow) / maxCF * 100 : 0;
            const positive = yr.cashFlow >= 0;
            return (
              <div key={yr.year} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-gray-500">Yr {yr.year}</span>
                <div className="flex-1 h-5 bg-gray-800 rounded-sm overflow-hidden relative">
                  <div
                    className={`h-full rounded-sm transition-all duration-700 ease-out ${positive ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                  <span className={`absolute right-1 top-0.5 text-[10px] ${positive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(yr.cashFlow)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function NeighborhoodTab({ nh }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Neighborhood Scores</h3>
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(nh.scores).map(([key, val]) => (
          <div key={key} className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
            <p className="text-2xl font-bold text-white">{val}</p>
            <div className="w-full h-1.5 bg-gray-700 rounded-full mt-2">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${val * 10}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-3">
        Scores based on default estimates. Override by adjusting rent and price assumptions above.
        Sweet spot = below-median price, moderate crime, strong rent-to-price ratio.
      </p>
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
    <div className={`rounded-lg p-3 transition-all duration-200 hover:scale-[1.02] ${highlight ? 'bg-green-600/10 border border-green-600/20 hover:border-green-600/40' : 'bg-gray-800/50 hover:bg-gray-800/70'}`}>
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
    <div className={`rounded-xl border p-4 transition-all duration-200 hover:scale-[1.01] ${colorClasses}`}>
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
