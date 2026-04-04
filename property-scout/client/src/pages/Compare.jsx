import { useState, useEffect } from 'react';
import CompareTable from '../components/CompareTable';
import { getSavedProperties, removeProperty } from '../utils/api';

export default function Compare() {
  const [saved, setSaved] = useState([]);

  useEffect(() => { setSaved(getSavedProperties()); }, []);

  const handleRemove = (zpid) => {
    removeProperty(zpid);
    setSaved(getSavedProperties());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Compare Properties</h1>
        <p className="text-gray-500 text-sm">Side-by-side analysis of your saved properties</p>
      </div>

      <div className="card overflow-hidden">
        <CompareTable properties={saved} onRemove={handleRemove} />
      </div>
    </div>
  );
}
