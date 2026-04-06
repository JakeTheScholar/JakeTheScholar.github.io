import { useState } from 'react';

const defaultProperty = {
  address: '',
  price: '',
  bedrooms: 4,
  bathrooms: 2,
  livingArea: '',
  units: 2,
  rentEstimate: '',
  imgSrc: '',
};

export default function ManualEntryForm({ onAdd, onCancel }) {
  const [form, setForm] = useState(defaultProperty);
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.address || !form.price) return;
    onAdd({
      ...form,
      zpid: `manual-${Date.now()}`,
      price: parseFloat(form.price),
      livingArea: parseFloat(form.livingArea) || null,
      rentEstimate: parseFloat(form.rentEstimate) || null,
    });
    setForm(defaultProperty);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-4 animate-slide-down">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Add Property Manually</h3>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-white text-sm">Cancel</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Address *</label>
          <input type="text" value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Main St, City, ST" className="input w-full" required />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Price *</label>
          <input type="number" value={form.price} onChange={e => update('price', e.target.value)} placeholder="200000" className="input w-full" required />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Units</label>
          <select value={form.units} onChange={e => update('units', parseInt(e.target.value))} className="input w-full">
            <option value={2}>Duplex (2)</option>
            <option value={3}>Triplex (3)</option>
            <option value={4}>Fourplex (4)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Bedrooms</label>
          <input type="number" value={form.bedrooms} onChange={e => update('bedrooms', parseInt(e.target.value) || 0)} className="input w-full" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Bathrooms</label>
          <input type="number" value={form.bathrooms} onChange={e => update('bathrooms', parseFloat(e.target.value) || 0)} step="0.5" className="input w-full" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Sq Ft</label>
          <input type="number" value={form.livingArea} onChange={e => update('livingArea', e.target.value)} placeholder="2000" className="input w-full" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Est. Rent/Unit</label>
          <input type="number" value={form.rentEstimate} onChange={e => update('rentEstimate', e.target.value)} placeholder="Auto" className="input w-full" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Image URL (optional)</label>
        <input type="url" value={form.imgSrc} onChange={e => update('imgSrc', e.target.value)} placeholder="https://..." className="input w-full" />
      </div>
      <button type="submit" className="btn-primary w-full">Add Property</button>
    </form>
  );
}
