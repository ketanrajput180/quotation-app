import React, { useState } from 'react';
import { signInWithGoogle } from '../lib/firebase';
import { LogIn, Loader2, ShieldCheck, Zap, Globe, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export const Login: React.FC = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async () => {
    if (isAuthenticating) return;
    
    setIsAuthenticating(true);
    try {
      await signInWithGoogle();
      toast.success('Access granted. Welcome back.');
    } catch (error: any) {
      console.error("Login attempt failed:", error);
      toast.error(error.message || 'Identity verification failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white overflow-hidden selection:bg-slate-900 selection:text-white">
      {/* Left Pane - Brand & Narrative */}
      <div className="md:w-1/2 relative bg-slate-900 p-8 md:p-16 flex flex-col justify-between overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-10 bg-grid-slate-200 pointer-events-none" />
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-slate-800 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-slate-800 rounded-full blur-3xl opacity-30" />

        {/* Logo Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl rotate-3">
            <span className="text-xl font-black text-slate-900 italic">QF</span>
          </div>
          <span className="text-white font-display font-extrabold text-2xl tracking-tight">QuoteFlow</span>
        </motion.div>

        {/* Hero Narrative */}
        <div className="relative z-10 max-w-lg mt-24 md:mt-0">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-display font-extrabold text-white leading-[0.9] tracking-tighter mb-8"
          >
            Smart <br />
            <span className="text-slate-400 italic">Quotation</span> <br />
            Management.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg md:text-xl font-medium max-w-sm leading-relaxed"
          >
            Create professional GST quotations and manage your business workflow with ease.
          </motion.p>
        </div>

        {/* Feature Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.4 }}
          className="relative z-10 grid grid-cols-2 gap-8 mt-12 md:mt-0"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Secure Data</span>
          </div>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Inventory Sync</span>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">GST Ready</span>
          </div>
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Premium Support</span>
          </div>
        </motion.div>
      </div>

      {/* Right Pane - Authentication */}
      <div className="md:w-1/2 bg-white flex flex-col justify-center items-center p-8 md:p-24 relative">
        <div className="absolute inset-0 opacity-40 bg-grid-slate-200 pointer-events-none md:hidden" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md text-center md:text-left"
        >
          <div className="mb-12">
            <h2 className="text-3xl font-display font-extrabold text-slate-900 mb-3 tracking-tight">Sign In</h2>
            <p className="text-slate-500 font-medium font-sans">Sign in securely to continue to your workspace.</p>
          </div>

          <div className="space-y-6">
            <button
              onClick={handleLogin}
              disabled={isAuthenticating}
              className="w-full h-16 flex items-center justify-center gap-4 bg-slate-900 hover:bg-black text-white font-display font-bold rounded-2xl transition-all shadow-xl shadow-slate-200 hover:shadow-2xl active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm uppercase tracking-widest font-black">Establishing Connection...</span>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                  <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                    <LogIn className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm uppercase tracking-widest font-black">Continue with Google</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-4 py-4">
              <div className="h-[1px] flex-1 bg-slate-100" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2">Authorized Access Only</span>
              <div className="h-[1px] flex-1 bg-slate-100" />
            </div>

            <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-sm mx-auto md:mx-0">
              Manage your professional invoices, quotations, and inventory in one secure location. 
              Your data is protected with industry-standard security protocols.
            </p>
          </div>
          
          <div className="mt-24 pt-8 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-[10px] text-slate-300 font-bold tracking-widest uppercase">Trusted by Businesses Globally</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
