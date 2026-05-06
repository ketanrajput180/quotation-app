import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut,
  PlusCircle,
  Menu,
  X
} from 'lucide-react';
import { User } from 'firebase/auth';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User;
  onLogout: () => void;
}

export function Sidebar({ activeTab, setActiveTab, user, onLogout }: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const menuItems = [
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'inventory', label: 'Products', icon: Package },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-xl shadow-lg border border-gray-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
              <span className="text-white font-bold text-xl">Q</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">QuoteFlow</h1>
          </div>

          <button 
            onClick={() => {
              setActiveTab('new-quotation');
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all mb-8 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            New Quote
          </button>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === item.id 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6" />
        </div>

        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-8 h-8 rounded-full ring-2 ring-slate-100"
              alt="Profile"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
