import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { CompanyProfile, OperationType } from '../types';
import { Save, Building2, Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const [profile, setProfile] = useState<CompanyProfile>({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    gstin: '',
    pan: '',
    logoUrl: '',
    stampUrl: '',
    bankDetails: {
      bankName: '',
      accountNumber: '',
      ifsc: '',
      branch: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'companyProfile', auth.currentUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setProfile(snap.data() as CompanyProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'companyProfile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Structural Validation
    const requiredFields = ['name', 'address', 'phone'];
    const missingFields = requiredFields.filter(f => !profile[f as keyof typeof profile]);
    
    const requiredBankFields = ['bankName', 'accountNumber', 'ifsc'];
    const missingBankFields = requiredBankFields.filter(f => !profile.bankDetails[f as keyof typeof profile.bankDetails]);

    if (missingFields.length > 0 || missingBankFields.length > 0) {
      toast.error('Validation Error: All mandatory fields must be populated.');
      return;
    }

    if (!auth.currentUser) {
      toast.error('Authentication error: Session expired.');
      return;
    }

    setSaving(true);
    try {
      // 2. Primary Persistence: Firestore
      await setDoc(doc(db, 'companyProfile', auth.currentUser.uid), profile);
      
      // 3. Secondary Persistence: Strategic Local Storage Mirroring
      localStorage.setItem(`quoteflow_profile_${auth.currentUser.uid}`, JSON.stringify({
        ...profile,
        lastPersisted: new Date().toISOString()
      }));

      // Success Feedback
      toast.success('Configuration synchronized successfully.');
    } catch (error) {
      console.error('Persistence Failure:', error);
      toast.error('Failed to sync configuration.');
      handleFirestoreError(error, OperationType.WRITE, 'companyProfile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 w-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
        <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest animate-pulse">Retrieving Profile Architecture...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Settings</h2>
        <p className="text-slate-500 mt-1 font-medium italic">Configure your business environment and financial endpoints.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="p-8 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-white uppercase tracking-[3px] text-[12px]">Entity Identity</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Core Legal Data</p>
              </div>
            </div>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Legal Trading Title *</label>
              <input 
                required
                type="text" 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-bold text-lg placeholder:text-slate-200"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="PRO-SPEC SOLUTIONS LTD"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Corporate Headquarters *</label>
              <textarea 
                required
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all h-32 resize-none text-slate-700 font-semibold"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Principal business address..."
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Corporate Logo URL (Public Image Link)</label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-700 font-semibold"
                value={profile.logoUrl}
                onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Corporate Stamp URL (Public Image Link)</label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-700 font-semibold"
                value={profile.stampUrl}
                onChange={(e) => setProfile({ ...profile, stampUrl: e.target.value })}
                placeholder="https://example.com/stamp.png"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Communication Line *</label>
              <input 
                required
                type="tel"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-bold"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+00 000 000 0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Electronic Mail</label>
              <input 
                type="email"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-bold"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="ops@entity.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Tax Identifier (GSTIN)</label>
              <input 
                type="text"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-700 font-mono tracking-wider"
                value={profile.gstin}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
                placeholder="27AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Financial Registry (PAN)</label>
              <input 
                type="text"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-700 font-mono tracking-wider"
                value={profile.pan}
                onChange={(e) => setProfile({ ...profile, pan: e.target.value })}
                placeholder="ABCDE1234F"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="p-8 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-white uppercase tracking-[3px] text-[12px]">Capital Settlement</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Banking Architecture</p>
              </div>
            </div>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Registered Bank Institution *</label>
              <input 
                required
                type="text"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-bold"
                value={profile.bankDetails.bankName}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, bankName: e.target.value } })}
                placeholder="GLOBAL RESERVE BANK"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Ledger Account Number *</label>
              <input 
                required
                type="text"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-mono text-lg font-black"
                value={profile.bankDetails.accountNumber}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountNumber: e.target.value } })}
                placeholder="0000 0000 0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Electronic Clearing Code (IFSC) *</label>
              <input 
                required
                type="text"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-800 font-mono uppercase font-black"
                value={profile.bankDetails.ifsc}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, ifsc: e.target.value } })}
                placeholder="GRBN0000123"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Branch Designation</label>
              <input 
                type="text"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all text-slate-700 font-bold"
                value={profile.bankDetails.branch}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, branch: e.target.value } })}
                placeholder="Main Square Hub"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-6">
          <button 
            type="submit"
            disabled={saving}
            className="group flex items-center gap-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-[0.3em] py-6 px-14 rounded-3xl transition-all shadow-2xl shadow-slate-900/20 active:scale-95 disabled:scale-100 border-b-4 border-slate-950 hover:border-b-0 hover:translate-y-1"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
            Persist Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
