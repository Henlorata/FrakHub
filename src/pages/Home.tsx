import { Button } from "@/components/ui/button";
import { Shield, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-900 text-white p-4">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-2">FrakHub</h1>
        <p className="text-xl text-slate-400">
          Központi rendszer a rendvédelmi frakciók számára
        </p>
      </header>

      <main className="flex flex-col md:flex-row flex-wrap justify-center gap-6">
        <Link to="/sfsd" className="w-full md:w-64">
          <Button
            variant="outline"
            className="w-full h-auto p-6 flex flex-col items-center justify-center gap-4 bg-slate-800 hover:bg-slate-700 border-slate-700"
          >
            <Shield size={48} className="text-blue-400" />
            <span className="text-lg font-semibold text-center">
              San Fierro
              <br />
              Sheriff's Department
            </span>
          </Button>
        </Link>

        <Link to="/mcb/login" className="w-full md:w-64">
          <Button
            variant="outline"
            className="w-full h-auto p-6 flex flex-col items-center justify-center gap-4 bg-slate-800 hover:bg-slate-700 border-slate-700"
          >
            <Briefcase size={48} className="text-yellow-500" />
            <span className="text-lg font-semibold text-center">
              Major Crimes Bureau
              <br />
              Adatbázis
            </span>
          </Button>
        </Link>

        <Button
          variant="outline"
          disabled
          className="w-full md:w-64 h-auto p-6 flex flex-col items-center justify-center gap-4 bg-slate-800 border-slate-700 opacity-50"
        >
          <Shield size={48} className="text-gray-500" />
          <span className="text-lg font-semibold text-center">
            Los Santos
            <br />
            Police Department
          </span>
          <span className="text-xs text-slate-400">(Hamarosan...)</span>
        </Button>
      </main>
    </div>
  );
}