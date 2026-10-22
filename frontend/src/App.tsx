import { useEffect } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import Platform from "@/pages/Platform";
import Citizen from "@/pages/Citizen";
import CommandCentreIntro from "@/pages/CommandCentreIntro";
import Intelligence from "@/pages/Intelligence";
import HowItWorks from "@/pages/HowItWorks";
import Trust from "@/pages/Trust";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import CitizenApp from "@/pages/CitizenApp";
import CommandCentreOps from "@/pages/CommandCentreOps";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ease-navy px-4 text-center">
      <div>
        <p className="font-data text-sm text-ease-sky">404</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-white">This page doesn't exist.</h1>
        <p className="mt-3 text-sm text-slate-400">In an emergency in India, call <a href="tel:112" className="font-bold text-white underline">112</a>.</p>
        <Link to="/" data-testid="notfound-home-link" className="mt-6 inline-block rounded-xl bg-ease-blue px-5 py-3 text-sm font-bold text-white">Back to EASE</Link>
      </div>
    </div>
  );
}

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/platform" element={<Platform />} />
        <Route path="/citizen" element={<Citizen />} />
        <Route path="/command-centre" element={<CommandCentreIntro />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<CitizenApp />} />
        <Route path="/ops" element={<CommandCentreOps />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
