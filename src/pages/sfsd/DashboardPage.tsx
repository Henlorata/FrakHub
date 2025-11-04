import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calculator, BookMarked } from "lucide-react";
import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">SFSD Kezdőlap</h1>
      <p className="text-slate-400">
        Üdvözlünk a San Fierro Sheriff's Department központi rendszerében.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <Link to="/sfsd/penalcode" className="hover:scale-[1.02] transition-transform">
          <Card className="bg-slate-900 border-slate-700 hover:border-blue-500 transition-colors">
            <CardHeader className="flex flex-row items-center gap-4">
              <Calculator className="w-12 h-12 text-blue-400" />
              <div>
                <CardTitle>Büntetés Kalkulátor</CardTitle>
                <CardDescription>Paragrafusok és büntetési tételek számítása.</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/sfsd/szabalyzat" className="hover:scale-[1.02] transition-transform">
          <Card className="bg-slate-900 border-slate-700 hover:border-blue-500 transition-colors">
            <CardHeader className="flex flex-row items-center gap-4">
              <BookMarked className="w-12 h-12 text-green-400" />
              <div>
                <CardTitle>Frakció Szabályzat</CardTitle>
                <CardDescription>A frakció hivatalos és naprakész szabályzata.</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        {/* Ide jöhetnek majd az új kártyák, pl. Rádiókódok */}

      </div>
    </div>
  );
}