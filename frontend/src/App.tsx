import { useState } from "react";
import "./App.css";
import CyberTerminalBackground from "./components/ui/CyberTerminalBackground";
import Login from "./components/Login";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#120F17]">
      <CyberTerminalBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        {!isLoggedIn ? (
          <Login onLoginSuccess={handleLoginSuccess} />
        ) : (
          <SidebarProvider defaultOpen>
            <div className="flex min-h-screen w-full max-w-full overflow-hidden rounded-3xl border border-zinc-800 bg-[#18181b]/90 shadow-2xl shadow-black/60">
              <Sidebar className="bg-[#111827]">
                <SidebarHeader>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-100">Melonela</p>
                    <p className="text-xs text-zinc-500">Tableau de bord</p>
                  </div>
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton variant="default">Accueil</SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton variant="default">Audit</SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton variant="default">Paramètres</SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroup>
                </SidebarContent>
                <SidebarFooter className="p-4">
                  <SidebarTrigger />
                </SidebarFooter>
              </Sidebar>

              <SidebarInset className="flex-1 bg-[#0f172a] p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold text-white">Bienvenue</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                      Vous êtes redirigé vers le sidebar après une connexion réelle.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLoggedIn(false)}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Déconnexion
                  </button>
                </div>
                <div className="mt-8 rounded-3xl border border-zinc-700 bg-[#111827] p-6 text-zinc-100 shadow-lg shadow-black/20">
                  <p className="text-sm text-zinc-400">
                    Voici votre espace démo après connexion. Le sidebar est maintenant visible et vous pouvez naviguer entre les sections.
                  </p>
                </div>
              </SidebarInset>
            </div>
          </SidebarProvider>
        )}
      </div>
    </div>
  );
}

export default App;
       
    
