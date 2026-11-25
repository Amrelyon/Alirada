import React, { useState } from 'react';
import { X, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { EntityType } from '../types/alirada';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    setAuthModalOpen,
    signInWithGoogle,
    signInEmail,
    registerEmail,
    recoverViaSecurityQuestion,
  } = useAlirada();

  const [mode, setMode] = useState<'signin' | 'register' | 'recover'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('Individual');
  const [avatarUrl, setAvatarUrl] = useState('/src/assets/images/avatar_member_portrait_1795619024258.jpg');
  const [securityQuestion, setSecurityQuestion] = useState('What city was your cooperative unit founded in?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      await signInEmail(email, password);
    } else if (mode === 'register') {
      await registerEmail(
        email,
        password,
        fullName,
        entityType,
        avatarUrl,
        securityQuestion,
        securityAnswer
      );
    } else {
      const res = await recoverViaSecurityQuestion(email, securityAnswer);
      setRecoveryNotice(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
          <div>
            <h2 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100">
              Alirada Identity Access
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Verified email bound strictly to one immutable Universal ID
            </p>
          </div>
          <button
            onClick={() => setAuthModalOpen(false)}
            className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Close sign in dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="w-full py-2.5 px-4 rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          Continue with Google (Recommended)
        </button>

        <div className="flex items-center gap-3 text-xs text-stone-400">
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
          <span>or Email & Password</span>
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#0B0D10] rounded-lg">
          {(['signin', 'register', 'recover'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                setRecoveryNotice(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === tab
                  ? 'bg-white dark:bg-[#191D25] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              {tab === 'signin' ? 'Sign In' : tab === 'register' ? 'Register' : 'Recover'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
              Verified Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute start-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@domain.org"
                className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>

          {mode !== 'recover' && (
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute start-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                    Full Name / Entity Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value as EntityType)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Family">Family</option>
                    <option value="Organization">Organization</option>
                    <option value="Governmental">Governmental</option>
                    <option value="Charity / Vulnerable Entity">Charity / Vulnerable Entity</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Mandatory Profile Avatar URL
                </label>
                <input
                  type="text"
                  required
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Security Recovery Question
                </label>
                <input
                  type="text"
                  required
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Security Answer (Hashed)
                </label>
                <input
                  type="text"
                  required
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                />
              </div>
            </>
          )}

          {mode === 'recover' && (
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                Security Question Answer
              </label>
              <input
                type="text"
                required
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Enter your saved security answer"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
              />
            </div>
          )}

          {recoveryNotice && (
            <p className="text-xs text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800/70 p-2.5 rounded-lg">
              {recoveryNotice}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-2 px-4 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 font-medium text-sm hover:bg-stone-100 dark:hover:bg-stone-800/70 transition-colors"
          >
            {mode === 'signin'
              ? 'Sign In with Email'
              : mode === 'register'
                ? 'Register Cooperative Profile'
                : 'Verify & Dispatch Password Reset'}
          </button>

          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
            Note: Google Sign-In is active immediately. To use Email/Password sign-in, ensure the Email/Password provider is enabled in your Firebase Authentication console.
          </p>
        </form>
      </div>
    </div>
  );
};
