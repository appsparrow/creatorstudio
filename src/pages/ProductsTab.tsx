import React from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

export default function ProductsTab() {
  const { personaId } = useParams();

  return (
    <div className="p-6">
      <div className="text-center py-16 text-gray-500">
        <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Product Catalog</p>
        <p className="text-sm mt-1">Manage products and affiliates for this persona. Coming in MVP1.</p>
      </div>
    </div>
  );
}
