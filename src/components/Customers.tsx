import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db, handleFirestoreError, auth } from '../lib/firebase';
import { Customer, OperationType } from '../types';
import { Plus, Search, Edit2, Trash2, X, User } from 'lucide-react';
import { toast } from 'sonner';

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'customers'),
      where('userId', '==', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customerList = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id } as Customer;
      });
      setCustomers(customerList);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));
    return unsubscribe;
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setGstin('');
    setState('');
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const customerData = {
      userId: auth.currentUser.uid,
      name,
      email,
      phone,
      address,
      gstin,
      state,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id!), customerData);
        toast.success('Customer profile updated');
      } else {
        await addDoc(collection(db, 'customers'), customerData);
        toast.success('New customer registered');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save customer record');
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setEmail(customer.email);
    setPhone(customer.phone);
    setAddress(customer.address);
    setGstin(customer.gstin);
    setState(customer.state);
    setIsModalOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string | undefined) => {
    e.preventDefault();
    e.stopPropagation();

    if (!id) {
      toast.error("Customer record not identified.");
      return;
    }

    toast('Are you sure you want to delete this customer?', {
      description: 'Previous quotations will not be deleted.',
      action: {
        label: 'Delete',
        onClick: async () => {
          setIsDeleting(id);
          try {
            await deleteDoc(doc(db, 'customers', id));
            toast.success("Customer deleted successfully.");
          } catch (error) {
            console.error("Deletion error:", error);
            toast.error("Failed to delete customer.");
            handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
          } finally {
            setIsDeleting(null);
          }
        },
      },
      actionButtonStyle: { backgroundColor: '#e11d48', color: 'white' },
    });
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight leading-tight">Customers</h2>
          <p className="text-slate-500 text-sm">Manage business contacts & billing details</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-lg shadow-slate-200 active:scale-95 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search customers by name, email or state..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto md:overflow-x-visible">
          {/* Mobile View: Card List */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <div key={customer.id} className="p-4 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 break-words line-clamp-1">{customer.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{customer.state || 'Generic'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleEdit(customer)}
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, customer.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase text-slate-400 font-bold tracking-widest block">Contact</span>
                      <p className="font-medium text-slate-700 truncate">{customer.email || '—'}</p>
                      <p className="text-slate-500">{customer.phone || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase text-slate-400 font-bold tracking-widest block">Tax Identity</span>
                      <p className="font-mono font-bold text-slate-600 uppercase break-all">
                        {customer.gstin || 'NO GSTIN'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
               <div className="px-6 py-20 text-center text-slate-400 italic font-medium">
                  No contact records identified.
               </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">Customer Identity</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">Contact & Reach</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">Tax Information</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] text-right">Records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 group-hover:scale-105 transition-transform duration-200">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 leading-none mb-1">{customer.name}</p>
                          <p className="text-xs text-slate-400 font-medium truncate max-w-[200px]">{customer.address || 'No address specified'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-700">{customer.email || '—'}</p>
                        <p className="text-xs text-slate-400">{customer.phone || '—'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-medium text-slate-500 uppercase">
                          {customer.gstin || 'No GSTIN'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{customer.state || 'Generic'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, customer.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <p className="text-slate-400 italic font-medium">No contact records identified.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">{editingCustomer ? 'Refine Customer' : 'Add New Record'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trading Name / Legal Entity *</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nexus Dynamics Ltd."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Electronic Mail</label>
                  <input 
                    type="email" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="billing@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Direct Phone</label>
                  <input 
                    type="tel" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 00000 00000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Registered Address</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all h-24 resize-none placeholder:text-slate-400 text-slate-700"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street details, Building name, Landmark..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">GST Identity Number</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700 font-mono text-sm uppercase"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="27AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Place of Supply (State)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                  />
                </div>
              </div>
              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3.5 border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
                >
                  {editingCustomer ? 'Update Entity' : 'Finalize Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
