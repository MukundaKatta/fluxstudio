'use client';

import { useState } from 'react';
import { useFluxStore } from '@/hooks/use-flux-store';

export function GalleryPanel() {
  const gallery = useFluxStore((s) => s.gallery);
  const toggleFavorite = useFluxStore((s) => s.toggleFavorite);
  const removeFromGallery = useFluxStore((s) => s.removeFromGallery);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = gallery.filter((img) => {
    if (filter === 'favorites' && !img.isFavorite) return false;
    if (searchQuery) return img.params.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Gallery ({gallery.length})</h2>
        <div className="flex gap-1">
          <button onClick={() => setFilter('all')} className={`px-2 py-1 rounded text-[10px] ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/30'}`}>All</button>
          <button onClick={() => setFilter('favorites')} className={`px-2 py-1 rounded text-[10px] ${filter === 'favorites' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/30'}`}>Favorites</button>
        </div>
      </div>

      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by prompt..." className="fx-input mb-3" />

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-white/20 text-center py-16">No images yet</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((img) => (
              <div key={img.id} className="fx-card p-2 group relative">
                <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center text-white/10 text-xs">{img.width}x{img.height}</div>
                <div className="mt-1.5">
                  <p className="text-[10px] text-white/40 truncate">{img.params.prompt}</p>
                  <div className="text-[9px] text-white/20">Seed: {img.seed} | {img.params.sampler} | {img.params.steps} steps</div>
                </div>
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => toggleFavorite(img.id)} className={`p-1 rounded ${img.isFavorite ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/30'}`}>
                    {img.isFavorite ? '★' : '☆'}
                  </button>
                  <button onClick={() => removeFromGallery(img.id)} className="p-1 rounded bg-red-500/20 text-red-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
