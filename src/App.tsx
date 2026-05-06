import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { Sidebar } from './components/Sidebar';
import { Inventory } from './components/Inventory';
import { Customers } from './components/Customers';
import { Quotations } from './components/Quotations';
import { NewQuotation } from './components/NewQuotation';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotations');
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const navigateTo = (tab: string, id: string | null = null) => {
    setActiveTab(tab);
    setEditingQuotationId(id);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
        <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest animate-pulse">Initializing Environment...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'inventory':
        return <Inventory />;
      case 'customers':
        return <Customers />;
      case 'quotations':
        return <Quotations navigateTo={navigateTo} />;
      case 'new-quotation':
        return <NewQuotation navigateTo={navigateTo} quotationId={editingQuotationId} />;
      case 'settings':
        return <Settings />;
      default:
        return <Quotations navigateTo={navigateTo} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-800">
      <Toaster position="top-right" expand={false} richColors duration={4000} />
      <Sidebar activeTab={activeTab} setActiveTab={navigateTo} user={user} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8 pt-20 md:pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
