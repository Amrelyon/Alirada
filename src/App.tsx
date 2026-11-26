import React, { useState } from 'react';
import {
  Compass,
  FolderKanban,
  Home,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { AliradaProvider, AppSection, useAlirada } from './context/AliradaContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AliradaLogo } from './components/AliradaLogo';
import { GoogleTranslateControl } from './components/GoogleTranslateControl';
import { UserAvatar } from './components/UserAvatar';
import { UserInspectorModal } from './components/UserInspectorModal';
import { AuthModal } from './components/AuthModal';
import { EmbeddedC2PCheckoutModal } from './components/EmbeddedC2PCheckoutModal';
import { ReportDialog } from './components/ReportDialog';
import { HomeOverviewView } from './views/HomeOverviewView';
import { ServiceLedgerView } from './views/ServiceLedgerView';
import { MarketplaceView } from './views/MarketplaceView';
import { ProjectsEmploymentView } from './views/ProjectsEmploymentView';
import { PaymentsExchangeView } from './views/PaymentsExchangeView';
import { GovernancePeopleView } from './views/GovernancePeopleView';
import { AdminConsoleView } from './views/AdminConsoleView';

const NAV_LABELS: Record<AppSection, string> = {
  home: 'Home',
  ledger: 'Service Ledger',
  marketplace: 'Marketplace',
  projects: 'Projects & Jobs',
  payments: 'Payments & Swap',
  governance: 'People & Gov',
  admin: 'Admin Console',
};

const NAV_ITEMS: { id: AppSection; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', icon: Home },
  { id: 'ledger', icon: Compass },
  { id: 'marketplace', icon: ShoppingBag },
  { id: 'projects', icon: FolderKanban },
  { id: 'payments', icon: Repeat },
  { id: 'governance', icon: ShieldCheck },
  { id: 'admin', icon: SlidersHorizontal },
];

const AliradaWorkspace: React.FC = () => {
  const {
    firebaseUser,
    isAdmin,
    currentProfile,
    metricsMap,
    activeSection,
    setActiveSection,
    theme,
    toggleTheme,
    setAuthModalOpen,
    signOutUser,
    toasts,
    dismissToast,
  } = useAlirada();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const myBalance = metricsMap[currentProfile.universal_id]?.balance ?? 0;

  return (
    <div className="min-h-screen flex bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100">
      {/* Desktop Collapsible Sidebar (Sticky Flex — naturally flips start edge in RTL with zero overlap) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen border-e border-stone-200 dark:border-stone-800/80 bg-white dark:bg-[#101318] z-30 transition-[width] duration-200 ease-out overflow-hidden ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div
          className={`border-b border-stone-200 dark:border-stone-800/80 flex items-center ${
            sidebarCollapsed ? 'flex-col gap-2 py-3 px-2 justify-center' : 'p-4 justify-between gap-2'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <AliradaLogo size={sidebarCollapsed ? 28 : 34} />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="notranslate font-cinzel text-lg font-bold tracking-wide text-stone-900 dark:text-stone-100 block leading-none">
                  Alirada
                </span>
                <span className="text-[11px] text-[#B88B1E] dark:text-[#D4AF37] block mt-1 truncate">
                  be served as you serve
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/70 hover:text-stone-900 dark:hover:text-stone-100 shrink-0"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 rtl:rotate-180" />
            ) : (
              <PanelLeftClose className="w-4 h-4 rtl:rotate-180" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto" aria-label="Primary">
          {NAV_ITEMS.filter((item) => item.id !== 'admin' || isAdmin).map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                title={NAV_LABELS[item.id]}
                aria-label={NAV_LABELS[item.id]}
                className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  active
                    ? 'bg-[#B88B1E]/12 dark:bg-[#D4AF37]/15 text-[#B88B1E] dark:text-[#D4AF37]'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{NAV_LABELS[item.id]}</span>}
              </button>
            );
          })}
        </nav>

        <div className={`border-t border-stone-200 dark:border-stone-800/80 ${sidebarCollapsed ? 'p-2.5 flex justify-center' : 'p-4 space-y-3'}`}>
          {sidebarCollapsed ? (
            <UserAvatar universalId={firebaseUser ? currentProfile.universal_id : 'GUEST'} />
          ) : firebaseUser ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <UserAvatar universalId={currentProfile.universal_id} showName showUid />
              </div>
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                <span>Balance</span>
                <span className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                  {myBalance} pts
                </span>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <UserAvatar universalId="GUEST" showName showUid />
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full py-1.5 px-3 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Sign In to Access Account
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (3-zone contract, <= 56px height) */}
        <header className="sticky top-0 z-20 h-14 bg-white/90 dark:bg-[#101318]/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800/80 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Mobile Brand / Desktop Sidebar Toggle + Section Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="md:hidden flex items-center gap-2">
              <AliradaLogo size={24} />
              <span className="notranslate font-cinzel text-base font-bold whitespace-nowrap">Alirada</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:inline-flex p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/70 hover:text-stone-900 dark:hover:text-stone-100 shrink-0"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 rtl:rotate-180" />
              ) : (
                <PanelLeftClose className="w-4 h-4 rtl:rotate-180" />
              )}
            </button>
            <span className="hidden md:inline text-sm font-medium text-stone-700 dark:text-stone-200 whitespace-nowrap truncate">
              {NAV_LABELS[activeSection]}
            </span>
          </div>

          {/* Zone 2 & 3: Utility Controls + Primary Auth Action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Full Google Website Translator + Clean Reset (✕) */}
            <GoogleTranslateControl />

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark or light theme"
              className="p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/60"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {firebaseUser ? (
              <button
                type="button"
                onClick={signOutUser}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10">
          {activeSection === 'home' && <HomeOverviewView />}
          {activeSection === 'ledger' && <ServiceLedgerView />}
          {activeSection === 'marketplace' && <MarketplaceView />}
          {activeSection === 'projects' && <ProjectsEmploymentView />}
          {activeSection === 'payments' && <PaymentsExchangeView />}
          {activeSection === 'governance' && <GovernancePeopleView />}
          {activeSection === 'admin' && <AdminConsoleView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed, h-14, no horizontal scroll) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white/95 dark:bg-[#101318]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 grid grid-cols-5"
      >
        {(
          [
            ['home', Home, NAV_LABELS.home],
            ['ledger', Compass, 'Ledger'],
            ['marketplace', ShoppingBag, 'Market'],
            ['projects', FolderKanban, 'Projects'],
          ] as const
        ).map(([id, Icon, shortLabel]) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveSection(id);
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-[#B88B1E] dark:text-[#D4AF37]' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[64px]">{shortLabel}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            mobileMenuOpen ||
            activeSection === 'payments' ||
            activeSection === 'governance' ||
            activeSection === 'admin'
              ? 'text-[#B88B1E] dark:text-[#D4AF37]'
              : 'text-stone-500 dark:text-stone-400'
          }`}
        >
          <Menu className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile Collapsible Drawer for Payments, Governance, Admin */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-14 z-30 bg-white dark:bg-[#12151B] border-t border-stone-200 dark:border-stone-800 p-4 space-y-2 shadow-xl">
          {(['payments', 'governance', ...(isAdmin ? (['admin'] as const) : [])] as AppSection[]).map(
            (id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSection(id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-start px-3 py-2.5 rounded-lg text-sm font-medium ${
                  activeSection === id
                    ? 'bg-[#B88B1E]/15 text-[#B88B1E] dark:text-[#D4AF37]'
                    : 'text-stone-700 dark:text-stone-200'
                }`}
              >
                {NAV_LABELS[id]}
              </button>
            )
          )}
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 md:bottom-5 end-4 z-50 space-y-2 max-w-sm w-[calc(100%-2rem)]">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-lg border text-xs flex items-start justify-between gap-3 shadow-lg ${
                t.kind === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                  : t.kind === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                    : 'bg-white dark:bg-[#161A22] border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100'
              }`}
            >
              <span className="leading-relaxed">{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global Modals */}
      <UserInspectorModal />
      <AuthModal />
      <EmbeddedC2PCheckoutModal />
      <ReportDialog />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AliradaProvider>
        <AliradaWorkspace />
      </AliradaProvider>
    </ErrorBoundary>
  );
}
