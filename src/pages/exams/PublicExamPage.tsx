import {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {supabase} from "@/lib/supabaseClient";
import {ExamRunner} from "./ExamRunner";
import {Loader2, AlertTriangle, Clock, ShieldAlert} from "lucide-react";
import type {Exam} from "@/types/exams";
import {Card, CardContent} from "@/components/ui/card";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";

export function PublicExamPage() {
  const {examId} = useParams<{ examId: string }>();
  const {user, loading: authLoading} = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);

  useEffect(() => {
    const fetchExam = async () => {
      if (!examId) return;

      // 1. Vizsga betöltése
      const {data, error} = await supabase
        .from('exams')
        .select(`*, exam_questions (*, exam_options (id, option_text, question_id))`)
        .eq('id', examId)
        .single();

      if (error) {
        console.error(error);
        setError("A vizsga nem található vagy nincs jogosultságod.");
        setLoading(false);
        return;
      }

      // 2. Cooldown ellenőrzés (JAVÍTVA: .maybeSingle())
      if (user) {
        const {data: lastSub, error: subError} = await supabase
          .from('exam_submissions')
          .select('retry_allowed_at, status')
          .eq('exam_id', examId)
          .eq('user_id', user.id)
          .order('start_time', {ascending: false})
          .limit(1)
          .maybeSingle(); // <--- EZ VOLT A HIBA (406), a single() hibát dob ha üres

        // Ha van hiba, de nem az, hogy üres, akkor logoljuk (opcionális)
        if (subError && subError.code !== 'PGRST116') console.error(subError);

        if (lastSub && lastSub.status === 'failed' && lastSub.retry_allowed_at) {
          const retryTime = new Date(lastSub.retry_allowed_at);
          if (retryTime > new Date()) {
            setIsBlocked(true);
            setBlockedUntil(lastSub.retry_allowed_at);
            setLoading(false);
            setExam(data as any);
            return;
          }
        }
      }

      // Rendezzük a kérdéseket index szerint
      if (data.exam_questions) {
        data.exam_questions.sort((a: any, b: any) => a.order_index - b.order_index);
      }
      setExam(data as any);
      setLoading(false);
    };

    if (!authLoading) {
      fetchExam();
    }
  }, [examId, user, authLoading]);

  if (loading || authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <Loader2 className="w-10 h-10 text-yellow-500 animate-spin"/></div>;

  // --- BLOKKOLT KÉPERNYŐ (Urlap nem indul el) ---
  if (isBlocked && blockedUntil) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-900 border-red-900/50 shadow-2xl">
        <CardContent className="p-8 text-center space-y-6">
          <div
            className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
            <ShieldAlert className="w-10 h-10 text-red-500"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Vizsga Letiltva</h1>
            <p className="text-slate-400">Sajnos a legutóbbi próbálkozásod sikertelen volt. A vizsgáztató türelmi időt
              állított be.</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Újrapróbálkozás ekkor:</p>
            <div className="flex items-center justify-center gap-2 text-xl font-mono font-bold text-yellow-500">
              <Clock className="w-5 h-5"/>
              {formatDistanceToNow(new Date(blockedUntil), {locale: hu, addSuffix: true})}
            </div>
            <p className="text-xs text-slate-600 mt-2">({new Date(blockedUntil).toLocaleString('hu-HU')})</p>
          </div>

          {/* Gomb a visszalépéshez */}
          <button onClick={() => window.history.back()} className="text-slate-500 hover:text-white underline text-sm">
            Vissza
          </button>
        </CardContent>
      </Card>
    </div>
  );

  if (error || !exam) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto"/>
        <h1 className="text-2xl font-bold">Hiba történt</h1>
        <p className="text-slate-400">{error}</p>
      </div>
    </div>
  );

  if (!exam.is_active) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <h1 className="text-xl text-red-400">Ez a vizsga jelenleg nem aktív.</h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 md:px-8">
      <ExamRunner exam={exam}/>
    </div>
  );
}