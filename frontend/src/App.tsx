import "./App.css";
import CyberTerminalBackground from "./components/CyberTerminalBackground";
import Login from "./components/Login";

function App() {
  const handleLoginSuccess = () => {
    // Implement your login logic here
    console.log('Login successful');
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#120F17]">
      <CyberTerminalBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    </div>
  );
}

export default App;
       
    
