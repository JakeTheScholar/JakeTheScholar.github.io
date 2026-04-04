import { fullAnalysis, formatCurrency, formatPct } from '../utils/mortgage';
import { calculateNeighborhoodScore, getDefaultNeighborhoodData } from '../utils/neighborhood';
import NeighborhoodBadge from './NeighborhoodBadge';

export default function PropertyCard({ property, onSelect, onSave, onRemove, isSaved }) {
  const analysis = fullAnalysis(property);
  const nhData = getDefaultNeighborhoodData(property);
  const nh = calculateNeighborhoodScore(nhData);

  const cashFlowPositive = analysis.liveIn.net >= 0;

  return (
    <div
      className="card overflow-hidden hover:border-gray-700 transition-all cursor-pointer group"
      onClick={() => onSelect?.(property)}
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-800 overflow-hidden">
        {property.imgSrc ? (
          <img src={property.imgSrc} alt={property.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <NeighborhoodBadge badge={nh.badge} score={nh.overall} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); isSaved ? onRemove?.(property.zpid) : onSave?.(property); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <svg className={`w-5 h-5 ${isSaved ? 'text-red-500 fill-red-500' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-xl font-bold text-green-400">{formatCurrency(property.price)}</h3>
          <span className="text-xs text-gray-500">{property.units || 2} units</span>
        </div>
        <p className="text-sm text-gray-300 mb-1">{property.address}</p>
        <p className="text-xs text-gray-500 mb-3">
          {property.bedrooms} bd | {property.bathrooms} ba | {property.livingArea ? `${property.livingArea.toLocaleString()} sqft` : ''}
        </p>

        {/* Quick metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-800/50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase">Monthly CF</p>
            <p className={`text-sm font-bold ${cashFlowPositive ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(analysis.liveIn.net)}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase">CoC Return</p>
            <p className="text-sm font-bold text-blue-400">{formatPct(analysis.liveIn.coc)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 uppercase">Est. Rent</p>
            <p className="text-sm font-bold text-gray-300">{formatCurrency(analysis.estimatedRent)}/u</p>
          </div>
        </div>
      </div>
    </div>
  );
}
