import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { Quotation, QuotationStatus, OperationType } from '../types';
import { Plus, Search, Edit2, Trash2, Eye, FileText, Download, Clock, CheckCircle2 } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface QuotationsProps {
  navigateTo: (tab: string, id: string | null) => void;
}

export function Quotations({ navigateTo }: QuotationsProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'quotations'), 
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id } as Quotation;
      });
      setQuotations(list);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'quotations'));
    
    return unsubscribe;
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string | undefined) => {
    e.preventDefault();
    e.stopPropagation();

    if (!id) {
      toast.error("Quotation record missing ID.");
      return;
    }

    toast('Are you sure you want to delete this quotation?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          setIsDeleting(id);
          try {
            await deleteDoc(doc(db, 'quotations', id));
            toast.success("Quotation deleted successfully.");
          } catch (error) {
            console.error("Deletion error:", error);
            toast.error("Failed to delete quotation.");
            handleFirestoreError(error, OperationType.DELETE, `quotations/${id}`);
          } finally {
            setIsDeleting(null);
          }
        },
      },
      actionButtonStyle: { backgroundColor: '#e11d48', color: 'white' },
    });
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case QuotationStatus.DRAFT:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 flex items-center gap-1"><Clock className="w-3 h-3"/> Draft</span>;
      case QuotationStatus.SENT:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 flex items-center gap-1"><FileText className="w-3 h-3"/> Sent</span>;
      case QuotationStatus.PAID:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Paid</span>;
      default:
        return null;
    }
  };

  const filtered = quotations.filter(q => 
    q.quotationNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight leading-tight">Recent Quotations</h2>
          <p className="text-slate-500 text-sm">Full history of generated proposals</p>
        </div>
        <button 
          onClick={() => navigateTo('new-quotation', null)}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-lg shadow-slate-200 active:scale-95 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          New Quote
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search record ID or customer..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium placeholder:text-slate-400 text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto md:overflow-x-visible">
          {/* Mobile View: Card List */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filtered.map((quote) => (
              <div 
                key={quote.id} 
                className="p-4 space-y-4 active:bg-slate-50 transition-colors"
                onClick={() => navigateTo('new-quotation', quote.id!)}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] font-bold text-slate-400 mb-1">{quote.quotationNo}</p>
                    <p className="font-bold text-slate-800 leading-tight break-words">{quote.customerName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                      {format(new Date(quote.date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="shrink-0 scale-90 origin-right transition-all group-active:scale-100 flex flex-col items-end gap-2">
                    {getStatusBadge(quote.status)}
                    <button 
                      onClick={(e) => handleDelete(e, quote.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-tighter border border-slate-200/50">
                    {quote.isIGST ? 'IGST 18%' : 'CGST/SGST 18%'}
                  </span>
                  <p className="text-sm font-black text-slate-900 font-mono tracking-tight">
                    {formatCurrency(quote.grandTotal)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">RECORD ID</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">CUSTOMER</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">TAX CONFIG</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em]">AMOUNT</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.1em] text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((quote) => (
                <tr 
                  key={quote.id} 
                  className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                  onClick={() => navigateTo('new-quotation', quote.id!)}
                >
                  <td className="px-6 py-5 font-mono text-xs font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                    {quote.quotationNo}
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-semibold text-slate-800 leading-tight mb-1">{quote.customerName}</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Dated: {format(new Date(quote.date), 'dd MMM yyyy')}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">
                      {quote.isIGST ? 'IGST 18%' : 'CGST/SGST 18%'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-black text-slate-900 font-mono tracking-tight">{formatCurrency(quote.grandTotal)}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {getStatusBadge(quote.status)}
                      <button 
                         onClick={(e) => handleDelete(e, quote.id)}
                         className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all ml-2"
                         title="Delete Quotation"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && !loading && (
            <div className="px-6 py-24 text-center">
              <div className="flex flex-col items-center gap-3">
                <FileText className="w-10 h-10 text-slate-200" />
                <p className="text-slate-400 font-medium italic">No active records discovered in your repository.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
