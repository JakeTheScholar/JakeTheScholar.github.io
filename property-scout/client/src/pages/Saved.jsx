import { useState, useEffect } from 'react';
import PropertyCard from '../components/PropertyCard';
import ROICalculator from '../components/ROICalculator';
import OwnedPortfolio from '../components/OwnedPortfolio';
import { getSavedProperties, saveProperty, removeProperty } from '../utils/api';

export default function Saved() {
  const [saved, setSaved] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);

  useEffect(() => { setSaved(getSavedProperties()); }, []);

  const handleRemove = (zpid) => {
    removeProperty(zpid);
    setSaved(getSavedProperties());
  };

  const handleSave = (property) => {
    saveProperty(property);
    setSaved(getSavedProperties());
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white mb-1">Saved Properties</h1>
        <p className="text-gray-500 text-sm">{saved.length} properties saved for analysis</p>
      </div>

      <OwnedPortfolio />

      {saved.length === 0 ? (
        <div className="card p-12 text-center animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="text-5xl mb-4 animate-float">📌</div>
          <p className="text-gray-500">No saved properties yet. Search and save properties you're interested in.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {saved.map((property, i) => (
            <PropertyCard
              key={property.zpid}
              property={property}
              onSelect={setSelectedProperty}
              onSave={handleSave}
              onRemove={handleRemove}
              isSaved={true}
              index={i}
            />
          ))}
        </div>
      )}

      {selectedProperty && (
        <ROICalculator property={selectedProperty} onClose={() => setSelectedProperty(null)} />
      )}
    </div>
  );
}
