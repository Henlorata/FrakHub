import {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {Card, CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {AlertTriangle, ArrowRight} from "lucide-react";
import {useAuth} from "@/context/AuthContext";

export function ActiveExamAlert() {
  const location = useLocation();
  const navigate = useNavigate();
  const {user} = useAuth();
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState<string>("");

  useEffect(() => {
    const checkActiveExam = () => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("exam_session_")) {
          try {
            const sessionData = JSON.parse(localStorage.getItem(key) || "{}");
            const sessionUserId = user?.id || 'guest';
            if (key.includes(sessionUserId)) {
              if (sessionData.startTime) {
                setActiveExamId(sessionData.examId);
                setExamTitle(sessionData.examTitle || "Folyamatban lévő vizsga");
                return;
              }
            }
          } catch (e) {
            console.error("Hiba a session parse-olásakor", e);
          }
        }
      }
      setActiveExamId(null);
    };

    checkActiveExam();

    window.addEventListener('storage', checkActiveExam);
    return () => window.removeEventListener('storage', checkActiveExam);
  }, [location, user]);

  if (!activeExamId) return null;
  if (location.pathname.includes(`/exam/public/${activeExamId}`)) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="max-w-md w-full bg-slate-900 border-yellow-600/50 shadow-2xl border-t-4 border-t-yellow-500">
        <CardContent className="p-8 text-center space-y-6">
          <div
            className="w-20 h-20 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto border border-yellow-500/30 animate-pulse">
            <AlertTriangle className="w-10 h-10 text-yellow-500"/>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Vizsga Folyamatban!</h2>
            <p className="text-slate-400">
              Érzékeltük, hogy elhagytad a(z) <span
              className="text-yellow-400 font-semibold">{examTitle}</span> kitöltését.
            </p>
            <p className="text-sm text-slate-500">
              Az idő közben is telik! Kérjük, fejezd be a vizsgát, mielőtt más oldalra lépsz.
            </p>
          </div>

          <Button
            onClick={() => navigate(`/exam/public/${activeExamId}`)}
            className="w-full py-6 text-lg bg-yellow-600 hover:bg-yellow-700 text-black font-bold shadow-lg shadow-yellow-900/20"
          >
            Vissza a vizsgához <ArrowRight className="w-5 h-5 ml-2"/>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}