import { fullAnalysis, formatCurrency, formatPct } from '../utils/mortgage';
import { calculateNeighborhoodScore, getDefaultNeighborhoodData } from '../utils/neighborhood';
import NeighborhoodBadge from './NeighborhoodBadge';

export default function CompareTable({ properties, onRemove }) {
  if (properties.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500 text-lg">No properties to compare</p>
        <p className="text-gray-600 text-sm mt-1">Save some properties first, then come here to compare them side by side.</p>
      </div>
    );
  }

  const analyses = properties.map(p => ({
    property: p,
    analysis: fullAnalysis(p),
    nh: calculateNeighborhoodScore(getDefaultNeighborhoodData(p)),
  }));

  const rows = [
    { label: 'Price', get: a => formatCurrency(a.analysis.price) },
    { label: 'Units', get: a => a.analysis.units },
    { label: 'Neighborhood', get: a => <NeighborhoodBadge badge={a.nh.badge} score={a.nh.overall} /> },
    { label: 'Down Payment', get: a => formatCurrency(a.analysis.downPayment) },
    { label: 'Total Cash In', get: a => formatCurrency(a.analysis.totalInvested), highlight: true },
    { label: 'Monthly PITI', get: a => formatCurrency(a.analysis.housing.total) },
    { label: 'Est. Rent/Unit', get: a => formatCurrency(a.analysis.estimatedRent) },
    { label: 'Live-In CF/mo', get: a => <CashFlowCell value={a.analysis.liveIn.net} />, highlight: true },
    { label: 'Live-In CoC', get: a => formatPct(a.analysis.liveIn.coc) },
    { label: 'Full Rental CF/mo', get: a => <CashFlowCell value={a.analysis.fullRental.net} /> },
    { label: 'Full Rental CoC', get: a => formatPct(a.analysis.fullRental.coc) },
    { label: 'Cap Rate', get: a => formatPct(a.analysis.capRate) },
    { label: 'Break-Even Rent', get: a => formatCurrency(a.analysis.breakEvenRent) },
    { label: '2yr Equity Built', get: a => formatCurrency(a.analysis.equity.totalEquity), highlight: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left p-3 text-gray-500 font-medium w-40">Metric</th>
            {analyses.map(a => (
              <th key={a.property.zpid} className="p-3 text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium truncate max-w-[200px]">{a.property.address}</p>
                    <p className="text-green-400 font-bold">{formatCurrency(a.property.price)}</p>
                  </div>
                  <button onClick={() => onRemove(a.property.zpid)} className="text-gray-600 hover:text-red-400 ml-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className={`border-b border-gray-800/50 ${row.highlight ? 'bg-gray-900/50' : ''}`}>
              <td className="p-3 text-gray-400">{row.label}</td>
              {analyses.map(a => (
                <td key={a.property.zpid} className="p-3 text-white">{row.get(a)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashFlowCell({ value }) {
  const positive = value >= 0;
  return (
    <span className={`font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {formatCurrency(value)}
    </span>
  );
}
