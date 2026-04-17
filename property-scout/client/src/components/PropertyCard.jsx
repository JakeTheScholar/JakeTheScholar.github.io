import { fullAnalysis, formatCurrency, formatPct } from '../utils/mortgage';
import { calculateNeighborhoodScore, getDefaultNeighborhoodData } from '../utils/neighborhood';
import { strAnalysis, strLocationScore, defaultNightlyRate, estimateOccupancy } from '../utils/str';
import NeighborhoodBadge from './NeighborhoodBadge';

export default function PropertyCard({ property, mode = 'hack', location, onSelect, onSave, onRemove, isSaved, index = 0 }) {
  const isStr = mode === 'str';

  // Build the right analysis + badge for the active mode
  let primary, secondary, tertiary, badge, score;
  if (isStr) {
    const nightlyRate = defaultNightlyRate(property, location);
    const occupancyPct = estimateOccupancy(location);
    const str = strAnalysis(property, { nightlyRate, occupancyPct });
    const strScore = strLocationScore({ location, property });
    primary   = { label: 'Cash Flow / mo',  value: formatCurrency(str.cashFlowMonthly), color: str.cashFlowMonthly >= 0 ? 'text-green-400' : 'text-red-400' };
    secondary = { label: 'Y1 Tax Shield',   value: formatCurrency(str.taxShieldY1),     color: 'text-purple-400' };
    tertiary  = { label: `ADR @ ${str.occupancyPct}%`, value: `$${str.nightlyRate}/n`,  color: 'text-gray-300' };
    badge = strScore.badge;
    score = strScore.overall;
  } else {
    const analysis = fullAnalysis(property);
    const nhData = getDefaultNeighborhoodData(property);
    const nh = calculateNeighborhoodScore(nhData);
    const cashFlowPositive = analysis.liveIn.net >= 0;
    primary   = { label: 'Monthly CF',  value: formatCurrency(analysis.liveIn.net),    color: cashFlowPositive ? 'text-green-400' : 'text-red-400' };
    secondary = { label: 'CoC Return',  value: formatPct(analysis.liveIn.coc),         color: 'text-blue-400' };
    tertiary  = { label: 'Est. Rent',   value: `${formatCurrency(analysis.estimatedRent)}/u`, color: 'text-gray-300' };
    badge = nh.badge;
    score = nh.overall;
  }

  const unitsLabel = isStr ? `${property.bedrooms || 0} br` : `${property.units || 2} units`;

  return (
    <div
      className={`card card-hover glow-ring overflow-hidden cursor-pointer group animate-fade-in-up stagger-${Math.min(index + 1, 9)}`}
      onClick={() => onSelect?.(property)}
    >
      <div className="relative h-48 bg-gray-800 overflow-hidden">
        {property.imgSrc ? (
          <img src={property.imgSrc} alt={property.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 skeleton-shimmer">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-900/80 to-transparent pointer-events-none" />
        <div className="absolute top-2 left-2">
          <NeighborhoodBadge badge={badge} score={score} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); isSaved ? onRemove?.(property.zpid) : onSave?.(property); }}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center transition-all duration-200 hover:scale-110 ${isSaved ? 'hover:bg-red-900/50' : 'hover:bg-black/70'}`}
        >
          <svg className={`w-5 h-5 transition-all duration-200 ${isSaved ? 'text-red-500 fill-red-500 scale-110' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className={`text-xl font-bold ${isStr ? 'text-purple-400' : 'text-green-400'}`}>{formatCurrency(property.price)}</h3>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{unitsLabel}</span>
        </div>
        <p className="text-sm text-gray-300 mb-1">{property.address}</p>
        <p className="text-xs text-gray-500 mb-3">
          {property.bedrooms} bd | {property.bathrooms} ba | {property.livingArea ? `${property.livingArea.toLocaleString()} sqft` : ''}
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniMetric label={primary.label}   value={primary.value}   color={primary.color} />
          <MiniMetric label={secondary.label} value={secondary.value} color={secondary.color} />
          <MiniMetric label={tertiary.label}  value={tertiary.value}  color={tertiary.color} />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2 transition-colors duration-200 group-hover:bg-gray-800/70">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}
