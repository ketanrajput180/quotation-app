import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, auth } from '../lib/firebase';
import { InventoryItem, OperationType } from '../types';
import { Plus, Search, Edit2, Trash2, X, Package } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'sonner';

export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hsn, setHsn] = useState('');
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState('PCS');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'products'),
      where('userId', '==', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id } as InventoryItem;
      });
      setItems(itemsList);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
    return unsubscribe;
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setHsn('');
    setRate('');
    setUnit('PCS');
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const itemData = {
      userId: auth.currentUser.uid,
      name,
      description,
      hsn,
      rate: Number(rate),
      unit,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'products', editingItem.id!), itemData);
        toast.success('Product updated successfully');
      } else {
        await addDoc(collection(db, 'products'), itemData);
        toast.success('Product added to repository');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save product');
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setHsn(item.hsn);
    setRate(item.rate.toString());
    setUnit(item.unit);
    setIsModalOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string | undefined) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!id) {
      toast.error("Cannot delete product - ID is missing.");
      return;
    }

    toast('Are you sure you want to delete this product?', {
      action: {
        label: 'Delete',
        onClick: async () => {
          setIsDeleting(id);
          try {
            const docRef = doc(db, 'products', id);
            await deleteDoc(docRef);
            toast.success("Product deleted successfully.");
          } catch (error) {
            console.error("Deletion error:", error);
            toast.error("Failed to delete product.");
            handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
          } finally {
            setIsDeleting(null);
          }
        },
      },
      actionButtonStyle: { backgroundColor: '#e11d48', color: 'white' },
    });
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.hsn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight leading-tight">Product Repository</h2>
          <p className="text-slate-500 text-sm">Product catalog & HSN configuration</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-lg shadow-slate-200 active:scale-95 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search catalog..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto md:overflow-x-visible">
          {/* Mobile view: Card List */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 break-words line-clamp-2">{item.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-tight break-words line-clamp-2">{item.description || 'No sub-details'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] uppercase text-slate-400 font-bold tracking-widest">HSN/SAC</span>
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-[10px] rounded w-fit">
                      {item.hsn || '000000'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] uppercase text-slate-400 font-bold tracking-widest block mb-0.5">Price / {item.unit}</span>
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(item.rate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view: Table */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">PRODUCT</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">HSN/SAC</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">PRICE</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-tight">{item.description || 'No sub-details'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-[10px] rounded">
                      {item.hsn || '000000'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(item.rate)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate">per {item.unit}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredItems.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-slate-400 text-sm font-medium italic">
              No portfolio items discovered.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px]" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">{editingItem ? 'Update Portfolio' : 'New Entry'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nomenclature</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Precision Drone Kit"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Extended Description</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all h-20 resize-none placeholder:text-slate-300"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Technical specifications..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">HSN Assignment</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300"
                    value={hsn}
                    onChange={(e) => setHsn(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Measurement</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="PCS">PCS</option>
                    <option value="SET">SET</option>
                    <option value="UNIT">UNIT</option>
                    <option value="KG">KG</option>
                    <option value="LTR">LTR</option>
                    <option value="SERVICE">SERVICE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Unit Rate (INR)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  className="w-full bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                >
                  Confirm Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
