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
  const [signInError, setSignInError] = useState<string | null>(null);
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

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-transparent p-6 font-sans text-zinc-100 selection:bg-emerald-500/30">
      {/* Grille de fond subtile façon SOC */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(rgba(250,250,250,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Conteneur principal */}
      <div className="z-10 flex w-full max-w-4xl flex-col items-center justify-center">
        <div
          className={`relative flex w-full overflow-hidden rounded-2xl border border-zinc-800 bg-[#18181b] shadow-2xl shadow-black/60 transition-all duration-700 ease-in-out ${
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
              <div className="mb-2 flex items-center justify-center rounded-full bg-emerald-500/10 p-3">
                <Shield className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
                Authentification
              </h2>
              <p className="mt-1 text-center text-xs font-medium text-zinc-400">
                Dashboard d'Audit Système & Sécurité
              </p>

              <form onSubmit={handleSignIn} className="mt-6 w-full space-y-4">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Identifiant ou Email"
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:bg-zinc-800/90"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-12 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:bg-zinc-800/90"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300"
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
                    className="text-xs font-medium text-zinc-500 hover:text-emerald-400 transition"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>

                {signInError && (
                  <p className="text-sm text-red-400 text-center">{signInError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSignInSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 hover:shadow-emerald-500/40 border border-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSignInSubmitting ? 'Connexion...' : <><LogIn className="h-4 w-4" />
                  Connexion</>}
                </button>
              </form>

              <div className="mt-4 text-center sm:hidden">
                <button
                  type="button"
                  onClick={togglePanel}
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 transition hover:text-white"
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
              <div className="mb-2 flex items-center justify-center rounded-full bg-emerald-500/10 p-3">
                <Fingerprint className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
                Créer un Compte
              </h2>
              <p className="mt-1 text-center text-xs font-medium text-zinc-400">
                Réservé au personnel de l'équipe de sécurité
              </p>

              <form onSubmit={handleSignUp} className="mt-6 w-full space-y-4">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Nom d'utilisateur"
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:bg-zinc-800/90"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-12 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:bg-zinc-800/90"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300"
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
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    placeholder="Vérification du mot de passe"
                    value={signUpPasswordConfirm}
                    onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-12 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:bg-zinc-800/90"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300"
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
                  <p className="text-sm text-red-400 text-center">{signUpError}</p>
                )}

                {signUpSuccess && (
                  <p className="text-sm text-emerald-400 text-center">{signUpSuccess}</p>
                )}

                <button
                  type="submit"
                  disabled={isSignUpSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 hover:shadow-emerald-500/40 border border-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSignUpSubmitting ? 'Inscription...' : <><UserPlus className="h-4 w-4" />
                  Créer un compte</>}
                </button>
              </form>

              <div className="mt-4 text-center sm:hidden">
                <button
                  type="button"
                  onClick={togglePanel}
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 transition hover:text-white"
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
              <div className="flex h-full w-1/2 flex-col items-center justify-center bg-[#0c0c0e] px-8 text-center border-r border-zinc-800/50">
                <Shield className="mb-3 h-10 w-10 text-emerald-400/80" />
                <h2 className="text-2xl font-bold text-white">Nouveau sur le SIEM ? </h2>
                <p className="mt-2 max-w-xs text-sm text-zinc-400">
                  Enregistrez un compte administrateur.
                </p>
                <button
                  onClick={togglePanel}
                  className="mt-6 flex items-center gap-2 rounded-full border border-zinc-700 bg-transparent px-6 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-emerald-500 hover:text-white hover:shadow-[0_0_20px_rgba(5,150,105,0.15)]"
                >
                  <ChevronRight className="h-4 w-4" />
                  S'inscrire
                </button>
              </div>

              {/* Panneau droit : Nouveau sur le SIEM ? */}
              <div className="flex h-full w-1/2 flex-col items-center justify-center bg-[#0c0c0e] px-8 text-center">
                <Fingerprint className="mb-3 h-10 w-10 text-emerald-400/80" />
                <h2 className="text-2xl font-bold text-white">Déjà inscrit ?</h2>
                <p className="mt-2 max-w-xs text-sm text-zinc-400">
                  Accédez au centre de contrôle.
                </p>
                <button
                  onClick={togglePanel}
                  className="mt-6 flex items-center gap-2 rounded-full border border-zinc-700 bg-transparent px-6 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-emerald-500 hover:text-white hover:shadow-[0_0_20px_rgba(5,150,105,0.15)]"
                >
                  <ChevronRight className="h-4 w-4" />
                  connexion
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- AVERTISSEMENT DE SÉCURITÉ ---------- */}
        <p className="mt-6 text-center text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-zinc-600">
          ACCÈS RESTREINT AU PERSONNEL AUTORISÉ — TOUTES LES REQUÊTES SONT
          JOURNALISÉES VIA PIDS
        </p>
      </div>
    </div>
  );
};

export default Login;