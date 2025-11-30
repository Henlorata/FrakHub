import {useEffect, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {supabase} from "@/lib/supabaseClient";
import {ExamRunner} from "./ExamRunner";
import {Loader2, AlertTriangle, Clock, ShieldAlert, FileX, ArrowLeft, Lock} from "lucide-react";
import type {Exam} from "@/types/exams";
import {Card, CardContent} from "@/components/ui/card";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {Button} from "@/components/ui/button";

export function PublicExamPage() {
  const {examId} = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const {user, loading: authLoading} = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);

  useEffect(() => {
    const fetchExam = async () => {
      if (!examId) return;
      try {
        const {
          data,
          error
        } = await supabase.from('exams').select(`*, exam_questions (*, exam_options (id, option_text, question_id))`).eq('id', examId).maybeSingle();
        if (error) throw error;
        if (!data) {
          setError("A vizsga nem található, vagy privát.");
          setLoading(false);
          return;
        }

        if (user) {
          const {data: lastSub} = await supabase.from('exam_submissions').select('retry_allowed_at, status').eq('exam_id', examId).eq('user_id', user.id).order('start_time', {ascending: false}).limit(1).maybeSingle();
          if (lastSub && lastSub.status === 'failed' && lastSub.retry_allowed_at) {
            if (new Date(lastSub.retry_allowed_at) > new Date()) {
              setIsBlocked(true);
              setBlockedUntil(lastSub.retry_allowed_at);
              setLoading(false);
              setExam(data as any);
              return;
            }
          }
        }
        if (data.exam_questions) data.exam_questions.sort((a: any, b: any) => a.order_index - b.order_index);
        setExam(data as any);
      } catch (err: any) {
        console.error(err);
        setError("Technikai hiba.");
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) fetchExam();
  }, [examId, user, authLoading]);

  if (loading || authLoading) return <div
    className="min-h-screen bg-slate-950 flex flex-col items-center justify-center"><Loader2
    className="w-12 h-12 text-yellow-500 animate-spin mb-4"/><p
    className="text-slate-400 font-mono tracking-widest text-sm">BETÖLTÉS...</p></div>;

  if (isBlocked && blockedUntil) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-900/50 border-red-900/30 shadow-2xl">
        <CardContent className="p-8 text-center space-y-6">
          <div
            className="w-24 h-24 bg-red-900/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <Clock className="w-12 h-12 text-red-500"/></div>
          <div><h1 className="text-3xl font-bold text-white mb-2">Pihenőidő</h1><p className="text-slate-400">A rendszer
            várakozási időt írt elő.</p></div>
          <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/50"><p
            className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Hátralévő idő</p>
            <div
              className="text-2xl font-mono font-bold text-yellow-500">{formatDistanceToNow(new Date(blockedUntil), {locale: hu})}</div>
          </div>
          <Button variant="ghost" onClick={() => navigate('/exams')}
                  className="text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2"/> Vissza</Button>
        </CardContent>
      </Card>
    </div>
  );

  if (error || !exam) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-900/50 border-slate-800 shadow-2xl">
        <CardContent className="p-10 text-center space-y-6">
          <div
            className="relative mx-auto w-24 h-24 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-full">
            <Lock className="w-10 h-10 text-slate-500"/></div>
          <div><h1 className="text-2xl font-bold text-white">Hiba</h1><p
            className="text-slate-400 text-sm">{error || "Nincs hozzáférés."}</p></div>
          <div className="flex flex-col gap-3 pt-4"><Button className="bg-yellow-600 text-black font-bold"
                                                            onClick={() => navigate('/login')}>Bejelentkezés</Button><Button
            variant="outline" onClick={() => window.history.back()}>Vissza</Button></div>
        </CardContent>
      </Card>
    </div>
  );

  if (!exam.is_active) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-900/50 border-orange-900/30 shadow-2xl">
        <CardContent className="p-8 text-center">
          <div
            className="w-20 h-20 bg-orange-900/10 rounded-full flex items-center justify-center mx-auto border border-orange-500/20 mb-6">
            <AlertTriangle className="w-10 h-10 text-orange-500"/></div>
          <h1 className="text-2xl font-bold text-white mb-2">Lezárva</h1><p className="text-slate-400 mb-8">A vizsga
          jelenleg nem fogad kitöltéseket.</p><Button variant="secondary"
                                                      onClick={() => navigate('/exams')}>Vissza</Button></CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 md:px-8 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-20" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, #334155 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }}></div>
      <ExamRunner exam={exam}/>
    </div>
  );
}