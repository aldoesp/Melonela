import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { loginUser, registerUser } from '../api/authApi';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ChevronRight,
  Fingerprint,
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRightPanelActive, setIsRightPanelActive] = useState<boolean>(false);
  const [showSignInPassword, setShowSignInPassword] = useState<boolean>(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState<boolean>(false);
  const [signInIdentifier, setSignInIdentifier] = useState<string>('');
  const [signInPassword, setSignInPassword] = useState<string>('');
  const [signInError, setSignInError] = useState<string | null>(() => {
    const message = localStorage.getItem('authMessage');
    localStorage.removeItem('authMessage');
    return message;
  });
  const [isSignInSubmitting, setIsSignInSubmitting] = useState<boolean>(false);
  const [signUpUsername, setSignUpUsername] = useState<string>('');
  const [signUpPassword, setSignUpPassword] = useState<string>('');
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState<string>('');
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [isSignUpSubmitting, setIsSignUpSubmitting] = useState<boolean>(false);
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null);

  const handleSignIn = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSignInError(null);
    setIsSignInSubmitting(true);

    try {
      await loginUser(signInIdentifier.trim(), signInPassword);
      onLoginSuccess();
    } catch (error) {
      if (error instanceof Error) {
        setSignInError(error.message);
      } else {
        setSignInError('Erreur inconnue lors de la connexion');
      }
    } finally {
      setIsSignInSubmitting(false);
    }
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSignUpError(null);
    setSignUpSuccess(null);

    // Validation
    if (signUpPassword !== signUpPasswordConfirm) {
      setSignUpError('Les mots de passe ne correspondent pas');
      return;
    }

    if (signUpPassword.length < 6) {
      setSignUpError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (signUpUsername.trim().length < 3) {
      setSignUpError('Le nom d\'utilisateur doit contenir au moins 3 caractères');
      return;
    }

    setIsSignUpSubmitting(true);

    try {
      await registerUser(signUpUsername.trim(), signUpPassword);
      setSignUpSuccess('Inscription réussie ! Veuillez vous connecter.');
      // Réinitialiser les champs
      setSignUpUsername('');
      setSignUpPassword('');
      setSignUpPasswordConfirm('');
      // Rediriger vers le formulaire de connexion après 2 secondes
      setTimeout(() => {
        setIsRightPanelActive(false);
        setSignUpSuccess(null);
      }, 2000);
    } catch (error) {
      if (error instanceof Error) {
        setSignUpError(error.message);
      } else {
        setSignUpError('Erreur inconnue lors de l\'inscription');
      }
    } finally {
      setIsSignUpSubmitting(false);
    }
  };

  const togglePanel = (): void => {
    setIsRightPanelActive((prev) => !prev);
  };

  const telemetry = [
    { label: 'Events/min', value: '1.8k', tone: 'text-cyan-300' },
    { label: 'Agents', value: '42', tone: 'text-emerald-300' },
    { label: 'High', value: '7', tone: 'text-amber-300' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#05080a] p-4 font-sans text-slate-100 selection:bg-cyan-400/25 sm:p-6">
      {/* Grille de fond subtile façon SOC */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(57,208,200,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(57,208,200,0.06) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_30%_18%,rgba(57,208,200,0.12),transparent_28%),radial-gradient(circle_at_72%_70%,rgba(125,211,252,0.09),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_32%)]" />

      {/* Conteneur principal */}
      <div className="z-10 flex w-full max-w-5xl flex-col items-center justify-center">
        <div
          className={`relative flex w-full overflow-hidden rounded-xl border border-cyan-300/15 bg-[#071014]/95 shadow-2xl shadow-black/70 ring-1 ring-white/[0.04] backdrop-blur-xl transition-all duration-700 ease-in-out ${
            isRightPanelActive ? 'h-[520px] sm:h-[500px]' : 'h-[520px] sm:h-[500px]'
          }`}
        >
          {/* ---------- FORMULAIRE CONNEXION ---------- */}
          <div
            className={`absolute left-0 top-0 flex h-full w-full flex-col items-center justify-center px-8 transition-all duration-700 ease-in-out sm:w-1/2 ${
              isRightPanelActive
                ? 'z-10 translate-x-full opacity-0'
                : 'z-20 translate-x-0 opacity-100'
            }`}
          >
            <div className="flex w-full max-w-xs flex-col items-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 shadow-[0_0_34px_rgba(57,208,200,0.12)]">
                <Shield className="h-7 w-7 text-cyan-200" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-50">
                Melonela Access
              </h2>
              <p className="mt-1 text-center text-xs font-medium text-slate-400">
                Console SIEM temps réel
              </p>

              <form onSubmit={handleSignIn} className="mt-6 w-full space-y-4">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Identifiant ou Email"
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0d171d] py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-[#101d24] focus:ring-2 focus:ring-cyan-300/10"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0d171d] py-2.5 pl-10 pr-12 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-[#101d24] focus:ring-2 focus:ring-cyan-300/10"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 transition hover:text-cyan-200"
                    aria-label={showSignInPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showSignInPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="text-right">
                  <a
                    href="#"
                    className="text-xs font-medium text-slate-500 transition hover:text-cyan-200"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>

                {signInError && (
                  <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">{signInError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSignInSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-300/15 py-2.5 text-sm font-bold uppercase tracking-wider text-cyan-50 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300/22 hover:shadow-cyan-400/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSignInSubmitting ? 'Connexion...' : <><LogIn className="h-4 w-4" />
                  Connexion</>}
                </button>
              </form>

              <div className="mt-4 text-center sm:hidden">
                <button
                  type="button"
                  onClick={togglePanel}
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200 transition hover:text-white"
                >
                  Créer un compte
                </button>
              </div>
            </div>
          </div>

          {/* ---------- FORMULAIRE INSCRIPTION ---------- */}
          <div
            className={`absolute left-0 top-0 flex h-full w-full flex-col items-center justify-center px-8 transition-all duration-700 ease-in-out sm:w-1/2 ${
              isRightPanelActive
                ? 'z-20 translate-x-0 opacity-100'
                : 'z-10 translate-x-full opacity-0'
            }`}
          >
            <div className="flex w-full max-w-xs flex-col items-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 shadow-[0_0_34px_rgba(57,208,200,0.12)]">
                <Fingerprint className="h-7 w-7 text-cyan-200" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-50">
                Nouvel analyste
              </h2>
              <p className="mt-1 text-center text-xs font-medium text-slate-400">
                Enrôlement dans la console Melonela
              </p>

              <form onSubmit={handleSignUp} className="mt-6 w-full space-y-4">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Nom d'utilisateur"
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0d171d] py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-[#101d24] focus:ring-2 focus:ring-cyan-300/10"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0d171d] py-2.5 pl-10 pr-12 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-[#101d24] focus:ring-2 focus:ring-cyan-300/10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 transition hover:text-cyan-200"
                    aria-label={showSignUpPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showSignUpPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    placeholder="Vérification du mot de passe"
                    value={signUpPasswordConfirm}
                    onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0d171d] py-2.5 pl-10 pr-12 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-[#101d24] focus:ring-2 focus:ring-cyan-300/10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 transition hover:text-cyan-200"
                    aria-label={showSignUpPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showSignUpPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {signUpError && (
                  <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">{signUpError}</p>
                )}

                {signUpSuccess && (
                  <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-200">{signUpSuccess}</p>
                )}

                <button
                  type="submit"
                  disabled={isSignUpSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-300/15 py-2.5 text-sm font-bold uppercase tracking-wider text-cyan-50 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300/22 hover:shadow-cyan-400/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSignUpSubmitting ? 'Inscription...' : <><UserPlus className="h-4 w-4" />
                  Créer un compte</>}
                </button>
              </form>

              <div className="mt-4 text-center sm:hidden">
                <button
                  type="button"
                  onClick={togglePanel}
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200 transition hover:text-white"
                >
                  Connexion
                </button>
              </div>
            </div>
          </div>

          {/* ---------- OVERLAY NOIR (PANNEAUX GLISSANTS) ---------- */}
          <div
            className="absolute right-0 top-0 hidden h-full w-1/2 overflow-hidden transition-all duration-700 ease-in-out sm:block"
            style={{ zIndex: 100 }}
          >
            <div
              className={`relative flex h-full w-[200%] transition-transform duration-700 ease-in-out ${
                isRightPanelActive ? '-translate-x-1/2' : 'translate-x-0'
              }`}
            >
              {/* Panneau gauche : Déjà inscrit ? */}
              <div className="flex h-full w-1/2 flex-col items-center justify-center border-r border-cyan-300/10 bg-[#071117] px-8 text-center">
                <div className="mb-5 grid w-full max-w-xs grid-cols-3 gap-2">
                  {telemetry.map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.035] px-2 py-2">
                      <p className={`font-mono text-sm font-bold ${item.tone}`}>{item.value}</p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>
                <Shield className="mb-3 h-10 w-10 text-cyan-200" />
                <h2 className="text-2xl font-bold text-white">Centre de supervision</h2>
                <p className="mt-2 max-w-xs text-sm text-slate-400">
                  Créez un accès contrôlé pour rejoindre l'espace d'analyse Melonela.
                </p>
                <button
                  onClick={togglePanel}
                  className="mt-6 flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-6 py-2 text-xs font-bold uppercase tracking-wider text-cyan-50 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                  S'inscrire
                </button>
              </div>

              {/* Panneau droit : Nouveau sur le SIEM ? */}
              <div className="flex h-full w-1/2 flex-col items-center justify-center bg-[#071117] px-8 text-center">
                <div className="mb-5 w-full max-w-xs rounded-lg border border-cyan-300/15 bg-black/20 p-3 text-left">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
                    <span>Security posture</span>
                    <span className="text-emerald-300">stable</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-2 w-[78%] rounded-full bg-cyan-300/70" />
                  </div>
                </div>
                <Fingerprint className="mb-3 h-10 w-10 text-cyan-200" />
                <h2 className="text-2xl font-bold text-white">Session analyste</h2>
                <p className="mt-2 max-w-xs text-sm text-slate-400">
                  Reprenez la surveillance des événements système et utilisateurs.
                </p>
                <button
                  onClick={togglePanel}
                  className="mt-6 flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-6 py-2 text-xs font-bold uppercase tracking-wider text-cyan-50 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                  connexion
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- AVERTISSEMENT DE SÉCURITÉ ---------- */}
        <p className="mt-6 text-center text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-slate-600">
          ACCÈS RESTREINT AU PERSONNEL AUTORISÉ — ACTIONS ET SESSIONS JOURNALISÉES
        </p>
      </div>
    </div>
  );
};

export default Login;
