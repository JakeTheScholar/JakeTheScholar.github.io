import { useState, useMemo } from 'react';
import { fullAnalysis, formatCurrency, formatPct, sensitivityAnalysis, monteCarloSimulation, wealthProjection, amortizationSchedule } from '../utils/mortgage';
import { calculateNeighborhoodScore, getDefaultNeighborhoodData } from '../utils/neighborhood';
import { strAnalysis, strLocationScore, defaultNightlyRate, estimateOccupancy, seasonalityFor, monthlyRevenueCurve, ltrBaseline, getMarketStats } from '../utils/str';
import NeighborhoodBadge from './NeighborhoodBadge';

export default function ROICalculator({ property, onClose, mode = 'hack', location }) {
  if (mode === 'str') {
    return <STRCalculator property={property} onClose={onClose} location={location} />;
  }
  return <HackCalculator property={property} onClose={onClose} />;
}

function HackCalculator({ property, onClose }) {
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
    { id: 'sensitivity', label: 'Sensitivity' },
    { id: 'montecarlo', label: 'Monte Carlo' },
    { id: 'wealth', label: 'Wealth' },
    { id: 'amortization', label: 'Amortization' },
    { id: 'neighborhood', label: 'Neighborhood' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4 animate-fade-in">
      <div className="card max-w-4xl w-full my-8 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between p-4 md:p-6 border-b border-gray-800">
          <div className="min-w-0 flex-1 mr-3">
            <h2 className="text-lg md:text-xl font-bold text-white truncate">{property.address}</h2>
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
        <div className="flex overflow-x-auto border-b border-gray-800 px-4 md:px-6 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 md:px-4 py-2.5 text-xs md:text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6 space-y-6">
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
          {activeTab === 'sensitivity' && <SensitivityTab property={property} assumptions={assumptions} />}
          {activeTab === 'montecarlo' && <MonteCarloTab property={property} assumptions={assumptions} />}
          {activeTab === 'wealth' && <WealthTab property={property} assumptions={assumptions} />}
          {activeTab === 'amortization' && <AmortizationTab analysis={analysis} />}
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

function SensitivityTab({ property, assumptions }) {
  const { scenarios } = useMemo(() => sensitivityAnalysis(property, assumptions), [property, assumptions]);

  const renderTable = (title, data, cols) => (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-2">Value</th>
              {cols.map(c => <th key={c.key} className="text-right p-2">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-2 text-gray-300 font-medium">{row.label}</td>
                {cols.map(c => (
                  <td key={c.key} className={`p-2 text-right ${c.color ? (row[c.key] >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}`}>
                    {c.fmt(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <p className="text-xs text-gray-500 mb-4">How do changes in key assumptions affect your returns? Each table varies one factor while holding others constant.</p>
      {renderTable('Interest Rate Sensitivity', scenarios.rate, [
        { key: 'cashFlow', label: 'Monthly CF', fmt: formatCurrency, color: true },
        { key: 'coc', label: 'CoC Return', fmt: formatPct, color: true },
        { key: 'dscr', label: 'DSCR', fmt: v => v.toFixed(2) },
        { key: 'npv', label: 'NPV', fmt: formatCurrency, color: true },
      ])}
      {renderTable('Vacancy Rate Sensitivity', scenarios.vacancy, [
        { key: 'cashFlow', label: 'Monthly CF', fmt: formatCurrency, color: true },
        { key: 'coc', label: 'CoC Return', fmt: formatPct, color: true },
        { key: 'dscr', label: 'DSCR', fmt: v => v.toFixed(2) },
        { key: 'npv', label: 'NPV', fmt: formatCurrency, color: true },
      ])}
      {renderTable('Rent Sensitivity', scenarios.rent, [
        { key: 'pctChange', label: 'Change', fmt: v => `${v >= 0 ? '+' : ''}${v}%` },
        { key: 'cashFlow', label: 'Monthly CF', fmt: formatCurrency, color: true },
        { key: 'coc', label: 'CoC Return', fmt: formatPct, color: true },
        { key: 'npv', label: 'NPV', fmt: formatCurrency, color: true },
      ])}
      {renderTable('Appreciation Sensitivity', scenarios.appreciation, [
        { key: 'totalROI', label: 'Total ROI', fmt: formatPct, color: true },
        { key: 'irr', label: 'IRR', fmt: formatPct },
        { key: 'npv', label: 'NPV', fmt: formatCurrency, color: true },
      ])}
    </>
  );
}

function MonteCarloTab({ property, assumptions }) {
  const mc = useMemo(() => monteCarloSimulation(property, assumptions, 2000), [property, assumptions]);

  const renderDistribution = (title, data, fmtVal) => {
    const maxCount = Math.max(...data.map(b => b.count));
    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">{title}</h4>
        <div className="space-y-0.5">
          {data.map((bucket, i) => {
            const w = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
            const midVal = (bucket.min + bucket.max) / 2;
            const positive = midVal >= 0;
            return (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="w-16 text-right text-gray-500">{fmtVal(bucket.min)}</span>
                <div className="flex-1 h-4 bg-gray-800 rounded-sm overflow-hidden">
                  <div className={`h-full rounded-sm ${positive ? 'bg-green-500/50' : 'bg-red-500/50'}`} style={{ width: `${w}%` }} />
                </div>
                <span className="w-8 text-gray-500">{bucket.pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <p className="text-xs text-gray-500 mb-4">
        {mc.numSims.toLocaleString()} simulations with randomized vacancy, rates, rent, appreciation, and maintenance. Shows range of likely outcomes.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-green-600/30 bg-green-600/5 p-4">
          <p className="text-[10px] text-gray-500 uppercase">P(NPV &gt; 0)</p>
          <p className="text-2xl font-bold text-green-400">{mc.npv.probPositive.toFixed(0)}%</p>
          <p className="text-[10px] text-gray-500">chance deal is profitable</p>
        </div>
        <div className="rounded-xl border border-blue-600/30 bg-blue-600/5 p-4">
          <p className="text-[10px] text-gray-500 uppercase">P(CF &gt; 0)</p>
          <p className="text-2xl font-bold text-blue-400">{mc.cashFlow.probPositive.toFixed(0)}%</p>
          <p className="text-[10px] text-gray-500">monthly cash flow positive</p>
        </div>
        <div className="rounded-xl border border-purple-600/30 bg-purple-600/5 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Median ROI</p>
          <p className="text-2xl font-bold text-purple-400">{formatPct(mc.roi.median)}</p>
          <p className="text-[10px] text-gray-500">{assumptions.holdYears}yr hold</p>
        </div>
        <div className="rounded-xl border border-yellow-600/30 bg-yellow-600/5 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Median IRR</p>
          <p className="text-2xl font-bold text-yellow-400">{formatPct(mc.irr.median)}</p>
          <p className="text-[10px] text-gray-500">5th: {formatPct(mc.irr.p5)} | 95th: {formatPct(mc.irr.p95)}</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Monthly Cash Flow Distribution</h4>
        <div className="grid grid-cols-5 gap-3 mb-4">
          <MetricBox label="Worst (5th)" value={formatCurrency(mc.cashFlow.p5)} />
          <MetricBox label="Bear (25th)" value={formatCurrency(mc.cashFlow.p25)} />
          <MetricBox label="Median" value={formatCurrency(mc.cashFlow.median)} highlight />
          <MetricBox label="Bull (75th)" value={formatCurrency(mc.cashFlow.p75)} />
          <MetricBox label="Best (95th)" value={formatCurrency(mc.cashFlow.p95)} />
        </div>
      </div>

      {renderDistribution('NPV Distribution', mc.npvHistogram, v => v >= 1000 || v <= -1000 ? `$${(v/1000).toFixed(0)}K` : formatCurrency(v))}
      {renderDistribution('Monthly Cash Flow Distribution', mc.cfHistogram, formatCurrency)}

      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Total ROI Percentiles ({assumptions.holdYears}yr)</h4>
        <div className="grid grid-cols-5 gap-3">
          <MetricBox label="5th pctile" value={formatPct(mc.roi.p5)} />
          <MetricBox label="25th pctile" value={formatPct(mc.roi.p25)} />
          <MetricBox label="Median" value={formatPct(mc.roi.median)} highlight />
          <MetricBox label="75th pctile" value={formatPct(mc.roi.p75)} />
          <MetricBox label="95th pctile" value={formatPct(mc.roi.p95)} />
        </div>
      </div>
    </>
  );
}

function WealthTab({ property, assumptions }) {
  const wealth = useMemo(() => wealthProjection(property, assumptions), [property, assumptions]);
  const maxWealth = Math.max(...wealth.map(w => Math.max(w.totalWealth, w.equity, w.cumulativeCashFlow)));
  const minWealth = Math.min(...wealth.map(w => Math.min(w.totalWealth, w.cumulativeCashFlow)), 0);
  const range = maxWealth - minWealth || 1;

  return (
    <>
      <p className="text-xs text-gray-500 mb-4">Total wealth built over your hold period from equity growth, principal paydown, and cumulative cash flow.</p>

      {/* Stacked visual */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Wealth Growth</h4>
        <div className="space-y-2">
          {wealth.map(yr => {
            const eqPct = Math.max(0, yr.equity / range * 100);
            const cfPct = Math.max(0, yr.cumulativeCashFlow / range * 100);
            return (
              <div key={yr.year} className="flex items-center gap-3">
                <span className="w-10 text-xs text-gray-500">Yr {yr.year}</span>
                <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden flex">
                  <div className="h-full bg-blue-500/60" style={{ width: `${eqPct}%` }} title={`Equity: ${formatCurrency(yr.equity)}`} />
                  <div className="h-full bg-green-500/60" style={{ width: `${Math.max(0, cfPct)}%` }} title={`Cash Flow: ${formatCurrency(yr.cumulativeCashFlow)}`} />
                </div>
                <span className="w-20 text-right text-xs font-medium text-white">{formatCurrency(yr.totalWealth)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500/60 rounded" /> Equity</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500/60 rounded" /> Cumulative Cash Flow</span>
        </div>
      </div>

      {/* Year-by-year table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-2">Year</th>
              <th className="text-right p-2">Property Value</th>
              <th className="text-right p-2">Loan Balance</th>
              <th className="text-right p-2">Equity</th>
              <th className="text-right p-2">Year CF</th>
              <th className="text-right p-2">Cumulative CF</th>
              <th className="text-right p-2">Total Wealth</th>
            </tr>
          </thead>
          <tbody>
            {wealth.map(yr => (
              <tr key={yr.year} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-2 text-gray-300">Yr {yr.year}</td>
                <td className="p-2 text-right text-gray-300">{formatCurrency(yr.propertyValue)}</td>
                <td className="p-2 text-right text-gray-500">{formatCurrency(yr.loanBalance)}</td>
                <td className="p-2 text-right text-blue-400">{formatCurrency(yr.equity)}</td>
                <td className={`p-2 text-right ${yr.cashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(yr.cashFlow)}</td>
                <td className={`p-2 text-right ${yr.cumulativeCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(yr.cumulativeCashFlow)}</td>
                <td className="p-2 text-right font-bold text-white">{formatCurrency(yr.totalWealth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AmortizationTab({ analysis }) {
  const schedule = useMemo(() => amortizationSchedule(analysis.housing.loanAmount, 6.75), [analysis.housing.loanAmount]);
  const totalInterest = schedule.reduce((s, y) => s + y.interest, 0);
  const totalPrincipal = schedule.reduce((s, y) => s + y.principal, 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricBox label="Loan Amount" value={formatCurrency(analysis.housing.loanAmount)} />
        <MetricBox label="Total Interest (30yr)" value={formatCurrency(totalInterest)} />
        <MetricBox label="Total Paid" value={formatCurrency(totalPrincipal + totalInterest)} highlight />
      </div>

      {/* Visual: principal vs interest over time */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 uppercase mb-3">Principal vs Interest by Year</h4>
        <div className="space-y-0.5">
          {schedule.filter((_, i) => i < 30).map(yr => {
            const total = yr.principal + yr.interest;
            const pPct = total > 0 ? (yr.principal / total * 100) : 0;
            return (
              <div key={yr.year} className="flex items-center gap-2 text-[10px]">
                <span className="w-6 text-gray-500">{yr.year}</span>
                <div className="flex-1 h-4 bg-gray-800 rounded-sm overflow-hidden flex">
                  <div className="h-full bg-blue-500/70" style={{ width: `${pPct}%` }} />
                  <div className="h-full bg-red-500/40" style={{ width: `${100 - pPct}%` }} />
                </div>
                <span className="w-16 text-right text-gray-500">{formatCurrency(yr.balance)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500/70 rounded" /> Principal</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500/40 rounded" /> Interest</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-2">Year</th>
              <th className="text-right p-2">Principal</th>
              <th className="text-right p-2">Interest</th>
              <th className="text-right p-2">Total Paid</th>
              <th className="text-right p-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map(yr => (
              <tr key={yr.year} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-2 text-gray-300">{yr.year}</td>
                <td className="p-2 text-right text-blue-400">{formatCurrency(yr.principal)}</td>
                <td className="p-2 text-right text-red-400">{formatCurrency(yr.interest)}</td>
                <td className="p-2 text-right text-gray-300">{formatCurrency(yr.principal + yr.interest)}</td>
                <td className="p-2 text-right text-gray-500">{formatCurrency(yr.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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

/* ======================================================================= */
/* STR Calculator — Airbnb/short-term-rental ROI with Y1 cost-seg tax shield */
/* ======================================================================= */

function STRCalculator({ property, onClose, location }) {
  const [a, setA] = useState({
    nightlyRate: defaultNightlyRate(property, location),
    occupancyPct: estimateOccupancy(location),
    cleaningPerStay: 100,
    avgStayDays: 4,
    mgmtPct: 0,
    suppliesUtilitiesAnnual: 4800,
    strInsuranceAnnual: 2400,
    strMaintenancePct: 8,
    avgRate: 6.75,
    downPct: 25,
    closingCostPct: 3,
    taxRatePct: 1.1,
    marginalTaxRatePct: 35,
    costSegBonusPct: 28,
    landPct: 15,
    furnishingCost: 25000,
    activeIncome: 0,
  });
  const update = (k, v) => setA(prev => ({ ...prev, [k]: v }));

  const r = useMemo(() => strAnalysis(property, a), [property, a]);
  const locScore = useMemo(() => strLocationScore({ location, property }), [location, property]);
  const stats = useMemo(() => getMarketStats(location), [location]);
  const monthly = useMemo(() => monthlyRevenueCurve({
    nightlyRate: a.nightlyRate,
    occupancyPct: a.occupancyPct,
    seasonality: seasonalityFor(location),
  }), [a.nightlyRate, a.occupancyPct, location]);
  const ltr = useMemo(() => ltrBaseline(property, a), [property, a]);
  const strAdvantageY1 = r.cashFlowAnnual - ltr.cashFlowAnnual + r.taxShieldY1;
  const maxMonthlyRev = Math.max(1, ...monthly.map(m => m.revenue));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4 animate-fade-in">
      <div className="card max-w-4xl w-full my-8 shadow-2xl animate-scale-in">
        <div className="flex items-start justify-between p-4 md:p-6 border-b border-gray-800">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">STR / Airbnb Analysis</span>
              <NeighborhoodBadge badge={locScore.badge} score={locScore.overall} />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-white truncate">{property.address}</h2>
            <span className="text-2xl font-bold text-purple-400">{formatCurrency(property.price)}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:rotate-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* STR Assumptions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">STR Assumptions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Nightly Rate (ADR)" value={a.nightlyRate} onChange={v => update('nightlyRate', v)} prefix="$" step="5" />
              <Field label="Occupancy %" value={a.occupancyPct} onChange={v => update('occupancyPct', v)} suffix="%" step="1" />
              <Field label="Avg Stay (days)" value={a.avgStayDays} onChange={v => update('avgStayDays', v)} suffix="d" step="0.5" />
              <Field label="Cleaning/stay" value={a.cleaningPerStay} onChange={v => update('cleaningPerStay', v)} prefix="$" step="5" />
              <Field label="Mgmt Fee %" value={a.mgmtPct} onChange={v => update('mgmtPct', v)} suffix="%" step="1" />
              <Field label="Maintenance %" value={a.strMaintenancePct} onChange={v => update('strMaintenancePct', v)} suffix="%" step="1" />
              <Field label="Supplies+Util/yr" value={a.suppliesUtilitiesAnnual} onChange={v => update('suppliesUtilitiesAnnual', v)} prefix="$" step="100" />
              <Field label="Insurance/yr" value={a.strInsuranceAnnual} onChange={v => update('strInsuranceAnnual', v)} prefix="$" step="100" />
              <Field label="Down Payment %" value={a.downPct} onChange={v => update('downPct', v)} suffix="%" step="1" />
              <Field label="Interest Rate" value={a.avgRate} onChange={v => update('avgRate', v)} suffix="%" step="0.125" />
              <Field label="Marginal Tax %" value={a.marginalTaxRatePct} onChange={v => update('marginalTaxRatePct', v)} suffix="%" step="1" />
              <Field label="Cost Seg Bonus %" value={a.costSegBonusPct} onChange={v => update('costSegBonusPct', v)} suffix="%" step="1" />
              <Field label="Furnishing + Setup" value={a.furnishingCost} onChange={v => update('furnishingCost', v)} prefix="$" step="1000" />
              <Field label="Active Income to Shelter" value={a.activeIncome} onChange={v => update('activeIncome', v)} prefix="$" step="5000" />
            </div>
            {stats && (
              <p className="text-[11px] text-gray-600 mt-2">
                ADR + occupancy defaults sourced from <span className="text-gray-400">{stats.source}</span>. These are market medians — override above with real nearby comps.
              </p>
            )}
            {!stats && (
              <p className="text-[11px] text-gray-600 mt-2">
                No market stats for this location — ADR defaulted from a 0.18% heuristic. Enter a target STR market (e.g. Gatlinburg, Broken Bow, 30A) for medians + seasonality.
              </p>
            )}
          </div>

          {/* Hero metrics — the strategy in numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`rounded-xl border p-4 ${r.cashFlowMonthly >= 0 ? 'border-green-600/30 bg-green-600/5' : 'border-red-600/30 bg-red-600/5'}`}>
              <p className="text-[10px] text-gray-500 uppercase">Monthly Cash Flow</p>
              <p className={`text-2xl font-bold ${r.cashFlowMonthly >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(r.cashFlowMonthly)}</p>
              <p className="text-[10px] text-gray-500">before tax shield</p>
            </div>
            <div className="rounded-xl border border-purple-600/40 bg-purple-600/10 p-4">
              <p className="text-[10px] text-gray-500 uppercase">Y1 Tax Shield</p>
              <p className="text-2xl font-bold text-purple-400">{formatCurrency(r.taxShieldY1)}</p>
              <p className="text-[10px] text-gray-500">cost seg @ {a.costSegBonusPct}% | tax @ {a.marginalTaxRatePct}%</p>
            </div>
            <div className="rounded-xl border border-blue-600/30 bg-blue-600/5 p-4">
              <p className="text-[10px] text-gray-500 uppercase">CoC (w/ shield)</p>
              <p className="text-2xl font-bold text-blue-400">{formatPct(r.cocWithShield)}</p>
              <p className="text-[10px] text-gray-500">pure CoC: {formatPct(r.cocPure)}</p>
            </div>
            <div className="rounded-xl border border-yellow-600/30 bg-yellow-600/5 p-4">
              <p className="text-[10px] text-gray-500 uppercase">Cap Rate</p>
              <p className="text-2xl font-bold text-yellow-400">{formatPct(r.capRate)}</p>
              <p className="text-[10px] text-gray-500">NOI / price</p>
            </div>
          </div>

          {/* Revenue */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Annual Revenue</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricBox label="Nights Booked" value={`${r.nightsBookedAnnual} / 365`} sub={`${a.occupancyPct}% occupancy`} />
              <MetricBox label="Stays / yr" value={r.stays.toString()} sub={`avg ${a.avgStayDays}d`} />
              <MetricBox label="Lodging Revenue" value={formatCurrency(r.lodgingRevenue)} />
              <MetricBox label="Gross Revenue" value={formatCurrency(r.grossRevenue)} highlight />
            </div>
          </div>

          {/* Expenses */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Annual Operating Expenses</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricBox label="Mgmt Fee" value={formatCurrency(r.mgmtFee)} />
              <MetricBox label="Cleaning" value={formatCurrency(r.cleaningCost)} />
              <MetricBox label="Supplies+Util" value={formatCurrency(r.suppliesUtilitiesAnnual)} />
              <MetricBox label="Insurance" value={formatCurrency(r.strInsuranceAnnual)} />
              <MetricBox label="Property Tax" value={formatCurrency(r.propertyTaxAnnual)} />
              <MetricBox label="Maintenance" value={formatCurrency(r.maintenance)} />
              <MetricBox label="Total OpEx" value={formatCurrency(r.totalOpEx)} highlight />
              <MetricBox label="NOI" value={formatCurrency(r.noi)} highlight />
            </div>
          </div>

          {/* Debt & Investment */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Financing & Cash In</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricBox label="Down Payment" value={formatCurrency(r.downPayment)} sub={`${a.downPct}%`} />
              <MetricBox label="Closing Costs" value={formatCurrency(r.closingCosts)} sub={`${a.closingCostPct}%`} />
              <MetricBox label="Furnishing" value={formatCurrency(r.furnishingCost)} sub="STR setup" />
              <MetricBox label="Total Cash In" value={formatCurrency(r.totalInvested)} highlight />
              <MetricBox label="Annual Debt Svc" value={formatCurrency(r.debtServiceAnnual)} sub={`PI @ ${a.avgRate}%`} />
            </div>
          </div>

          {/* LTR vs STR — apples-to-apples same-property comparison */}
          <div className="rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">LTR Baseline vs STR — same property</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricBox label="LTR Rent/mo" value={formatCurrency(ltr.rentMonthly)} sub="long-term tenant" />
              <MetricBox label="LTR Cash Flow/yr" value={formatCurrency(ltr.cashFlowAnnual)} sub={`cap ${formatPct(ltr.capRate)}`} />
              <MetricBox label="STR Cash Flow/yr" value={formatCurrency(r.cashFlowAnnual)} sub="no shield" />
              <MetricBox label="STR Advantage Y1" value={formatCurrency(strAdvantageY1)} highlight sub="STR CF − LTR CF + Y1 shield" />
            </div>
            <p className="text-[11px] text-gray-500 mt-3">
              LTR is a passive activity — depreciation is trapped against other passive income. STR's sub-7-day rule is what unlocks the shield against your active (W-2/business) income, so
              &quot;STR advantage&quot; captures both the cash-flow delta and the Y1 tax shield.
            </p>
          </div>

          {/* Cost-seg tax shield — the headline number */}
          <div className="rounded-xl border border-purple-600/40 bg-gradient-to-br from-purple-600/10 to-purple-900/5 p-4">
            <h3 className="text-sm font-semibold text-purple-300 uppercase mb-3">Year-1 Cost Seg Tax Shield (the reason to STR)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricBox label="Building Basis" value={formatCurrency(r.buildingBasis)} sub={`${100 - a.landPct}% of price`} />
              <MetricBox label="Accel. Deprec Y1" value={formatCurrency(r.accelDepreciation)} sub={`${a.costSegBonusPct}% of basis`} />
              <MetricBox label="Marginal Tax Rate" value={`${a.marginalTaxRatePct}%`} />
              <MetricBox label="Tax Shield Y1" value={formatCurrency(r.taxShieldY1)} highlight />
            </div>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              Under IRS Reg 1.469-1T(e)(3)(ii)(A), when <strong className="text-purple-300">average guest stay is 7 days or fewer</strong> AND you
              <strong className="text-purple-300"> materially participate</strong> ({'>'}100 hours/yr, more than anyone else), this is a non-passive
              activity. Accelerated depreciation from cost segregation offsets ordinary income — W-2, business, or investment.
            </p>
          </div>

          {/* Active-income shelter */}
          {a.activeIncome > 0 && (
            <div className="rounded-xl border border-indigo-600/40 bg-gradient-to-br from-indigo-600/10 to-indigo-900/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-indigo-300 uppercase">Active-Income Shelter</h3>
                <span className={`text-xs font-bold ${r.shelterCoveragePct >= 100 ? 'text-green-400' : 'text-indigo-300'}`}>
                  {r.shelterCoveragePct >= 100 ? 'Fully shelters this year' : `${r.shelterCoveragePct?.toFixed(0)}% covered`}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricBox label="Active Income Target" value={formatCurrency(a.activeIncome)} />
                <MetricBox label="Shielded Y1" value={formatCurrency(r.incomeShielded)} highlight sub="by this property alone" />
                <MetricBox label="Remaining to Shield" value={formatCurrency(r.incomeRemaining)} sub={r.incomeRemaining > 0 ? 'uncovered' : 'fully covered'} />
                <MetricBox label="Properties Needed" value={r.propertiesNeededForFullShelter?.toString() || '—'} sub="at this shield size" />
              </div>
              <div className="mt-3 w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min(100, r.shelterCoveragePct || 0)}%` }} />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                Shelter capacity = accelerated depreciation ({formatCurrency(r.accelDepreciation)}). Cash tax saved at your marginal rate = {formatCurrency(r.taxShieldY1)}.
              </p>
            </div>
          )}

          {/* Eligibility checklist */}
          <div className="rounded-xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">Non-Passive Eligibility</h3>
              <span className={`text-sm font-bold ${r.allEligibilityPass ? 'text-green-400' : 'text-yellow-400'}`}>
                {r.allEligibilityPass ? 'All gates pass' : 'Review gates'}
              </span>
            </div>
            <div className="space-y-2">
              {r.eligibility.map(gate => (
                <div key={gate.label} className="flex items-start gap-2 text-sm">
                  <span className={gate.pass ? 'text-green-400' : 'text-red-400'}>{gate.pass ? '\u2713' : '\u2717'}</span>
                  <div className="flex-1">
                    <p className="text-gray-300">{gate.label}</p>
                    <p className="text-xs text-gray-500">{gate.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly revenue projection — seasonality curve */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Monthly Revenue Projection (seasonality)</h3>
            <div className="space-y-1">
              {monthly.map(m => (
                <div key={m.month} className="flex items-center gap-2 text-[11px]">
                  <span className="w-8 text-gray-500">{m.month}</span>
                  <div className="flex-1 h-5 bg-gray-800 rounded-sm overflow-hidden relative">
                    <div
                      className="h-full bg-purple-500/60 rounded-sm transition-all duration-700 ease-out"
                      style={{ width: `${(m.revenue / maxMonthlyRev) * 100}%` }}
                    />
                    <span className="absolute right-1 top-0.5 text-[10px] text-purple-200">
                      {formatCurrency(m.revenue)} | {m.nights}n @ ${m.adr}
                    </span>
                  </div>
                  <span className="w-12 text-right text-gray-500">{m.occupancyPct}%</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-600 mt-2">
              Yearly totals: {formatCurrency(monthly.reduce((s, m) => s + m.revenue, 0))} revenue across {monthly.reduce((s, m) => s + m.nights, 0)} booked nights.
              Curve rescales monthly ADR + occupancy around your annual averages above.
            </p>
          </div>

          {/* Market intel */}
          <div className="rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Market Intel</h3>
            {locScore.location.kind === 'banned' && (
              <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3 mb-3">
                <p className="text-red-300 text-sm font-semibold">Regulatory blocker: {locScore.location.name}</p>
                <p className="text-red-300/70 text-xs mt-0.5">{locScore.location.reason}</p>
              </div>
            )}
            {locScore.location.kind === 'caution' && (
              <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3 mb-3">
                <p className="text-yellow-300 text-sm font-semibold">Permit / zoning caution: {locScore.location.name}</p>
                <p className="text-yellow-300/70 text-xs mt-0.5">{locScore.location.reason}</p>
                <p className="text-gray-500 text-[11px] mt-1">Not an outright ban — but confirm zoning, HOA docs, and permit availability before closing.</p>
              </div>
            )}
            {locScore.location.kind === 'target' && (
              <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-3 mb-3">
                <p className="text-purple-300 text-sm font-semibold">Tier {locScore.location.tier} target market: {locScore.location.name}</p>
                <p className="text-purple-300/70 text-xs mt-0.5">{locScore.location.theme}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <MetricBox label="Market Score" value={`${locScore.scores.market}/10`} />
              <MetricBox label="Property Fit" value={`${locScore.scores.propertyFit}/10`} sub="SFR/condo/cabin > multi" />
              <MetricBox label="Price Band" value={`${locScore.scores.priceBand}/10`} sub="$250K-$550K sweet spot" />
            </div>
            <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
              Regulation list is not exhaustive. Always verify with the local STR ordinance, HOA/POA deed restrictions, and any overlay zoning before making an offer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
