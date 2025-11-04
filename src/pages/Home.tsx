import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
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

      <main className="flex flex-col md:flex-row gap-6">
        {/* SFSD Kártya */}
        <Link to="/sfsd" className="w-full md:w-64">
          <Button
            variant="outline"
            className="w-full h-auto p-6 flex flex-col items-center justify-center gap-4 bg-slate-800 hover:bg-slate-700 border-slate-700"
          >
            <Shield size={48} className="text-blue-400" />
            <span className="text-lg font-semibold">
              San Fierro
              <br />
              Sheriff's Department
            </span>
          </Button>
        </Link>

        {/* LSPD Kártya (Inaktív) */}
        <Button
          variant="outline"
          disabled
          className="w-full md:w-64 h-auto p-6 flex flex-col items-center justify-center gap-4 bg-slate-800 border-slate-700 opacity-50"
        >
          <Shield size={48} className="text-gray-500" />
          <span className="text-lg font-semibold">
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