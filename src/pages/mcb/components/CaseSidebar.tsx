import * as React from "react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Shield, Users, FileText, Plus, Paperclip, UserPlus, Fingerprint, X, Trash2} from "lucide-react";
import type {Case} from "@/types/supabase";
import {cn} from "@/lib/utils.ts";
import {useAuth} from "@/context/AuthContext.tsx";

// --- INFO KÁRTYA (Bal oldal) ---
export function CaseInfoCard({caseData}: { caseData: Case }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-slate-800/50">
        <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-yellow-500"/> Akta Adatok
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Ügyszám:</span>
          <span className="font-mono text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded">
             #{caseData.case_number.toString().padStart(4, '0')}
           </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Státusz:</span>
          <Badge variant={caseData.status === 'open' ? 'default' : 'secondary'}
                 className={caseData.status === 'open' ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : ''}>
            {caseData.status === 'open' ? 'NYITOTT' : caseData.status === 'closed' ? 'LEZÁRT' : 'ARCHIVÁLT'}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Prioritás:</span>
          <Badge variant="outline" className={
            caseData.priority === 'critical' ? 'text-red-500 border-red-500 bg-red-500/10 animate-pulse' :
              caseData.priority === 'high' ? 'text-orange-400 border-orange-400 bg-orange-400/10' :
                'text-slate-300 border-slate-700'
          }>
            {caseData.priority.toUpperCase()}
          </Badge>
        </div>
        <div className="pt-2 border-t border-slate-800/50">
          <span className="text-slate-500 text-xs block mb-1">Vezető Nyomozó:</span>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-700">
              {caseData.owner?.full_name.charAt(0)}
            </div>
            <p className="text-white font-medium">{caseData.owner?.full_name || "Ismeretlen"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- KÖZREMŰKÖDŐK (Törlés gombbal) ---
export function CollaboratorsCard({collaborators, onAdd, onDelete}: {
  collaborators: any[],
  onAdd?: () => void,
  onDelete?: (id: string) => void
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm flex flex-col h-[200px] shrink-0">
      <CardHeader
        className="pb-2 py-3 border-b border-slate-800/50 flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500"/> Közreműködők
        </CardTitle>
        {onAdd &&
          <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-white -mr-2" onClick={onAdd}><UserPlus
            className="w-4 h-4"/></Button>}
      </CardHeader>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {collaborators.length === 0 ? <p className="text-xs text-slate-500 text-center py-2">Nincsenek további
              közreműködők.</p> : collaborators.map((collab) => (
              <div key={collab.id}
                   className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/60 group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar className="h-8 w-8 border border-slate-700">
                    <AvatarImage src={collab.profile?.avatar_url}/>
                    <AvatarFallback
                      className="text-xs bg-slate-800 text-slate-400">{collab.profile?.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{collab.profile?.full_name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{collab.profile?.faction_rank}</p>
                  </div>
                </div>
                {onDelete ? (
                  <Button variant="ghost" size="icon"
                          className="h-6 w-6 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onDelete(collab.id)}>
                    <X className="w-3 h-3"/>
                  </Button>
                ) : (
                  <Badge variant="outline"
                         className="text-[9px] border-slate-700 text-slate-500 px-1 h-5">{collab.role === 'editor' ? 'SZERK' : 'OLVAS'}</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}

// --- ÉRINTETT SZEMÉLYEK (Törlés gombbal) ---
export function SuspectsCard({suspects, onAdd, onView, onDelete}: {
  suspects: any[],
  onAdd?: () => void,
  onView: (suspect: any) => void,
  onDelete?: (id: string) => void
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm flex flex-col h-[300px] shrink-0">
      <CardHeader
        className="pb-2 py-3 border-b border-slate-800/50 flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-red-500"/> Érintett Személyek
        </CardTitle>
        {onAdd &&
          <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-white -mr-2" onClick={onAdd}><Plus
            className="w-4 h-4"/></Button>}
      </CardHeader>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {suspects.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Nincsenek rögzített személyek az aktában.</p>
            ) : (
              suspects.map((item) => (
                <div key={item.id}
                     className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/60 group hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                       onClick={() => onView(item.suspect)}>
                    <Avatar className="h-8 w-8 border border-slate-700 group-hover:border-slate-500 transition-colors">
                      <AvatarImage src={item.suspect?.mugshot_url}/>
                      <AvatarFallback className="text-xs bg-slate-800 text-slate-400">
                        {item.suspect?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">{item.suspect?.full_name}</p>
                      <div className="flex items-center gap-2 text-[10px]">
                                     <span className={cn(
                                       "uppercase font-bold",
                                       item.involvement_type === 'suspect' ? "text-red-400" :
                                         item.involvement_type === 'perpetrator' ? "text-red-600" :
                                           item.involvement_type === 'witness' ? "text-blue-400" : "text-yellow-400"
                                     )}>
                                         {item.involvement_type === 'suspect' ? 'GYANÚSÍTOTT' :
                                           item.involvement_type === 'perpetrator' ? 'ELKÖVETŐ' :
                                             item.involvement_type === 'witness' ? 'TANÚ' : 'ÁLDOZAT'}
                                     </span>
                      </div>
                    </div>
                  </div>
                  {onDelete && (
                    <Button variant="ghost" size="icon"
                            className="h-6 w-6 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onDelete(item.id)}>
                      <X className="w-3 h-3"/>
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}

// --- EGYEDI BIZONYÍTÉK ELEM (Preview betöltéssel) ---
const EvidenceItem = ({file, onView, onDelete}: {
  file: any,
  onView: (file: any) => void,
  onDelete?: (id: string) => void
}) => {
  const {supabase} = useAuth();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (file.file_type === 'image') {
      supabase.storage.from('case_evidence').createSignedUrl(file.file_path, 3600)
        .then(({data}) => {
          if (data) setPreviewUrl(data.signedUrl);
        });
    }
  }, [file, supabase]);

  return (
    <div
      className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/60 group hover:border-slate-700 hover:bg-slate-900 transition-all cursor-pointer"
      onClick={() => onView(file)}>
      <div className="flex items-center gap-3 overflow-hidden">
        <div
          className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center border border-slate-700 overflow-hidden shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover"/>
          ) : (
            <FileText className="w-5 h-5 text-slate-500"/>
          )}
        </div>
        <div className="min-w-0">
          <p
            className="text-xs font-medium text-slate-300 truncate max-w-[120px] group-hover:text-yellow-500 transition-colors">{file.file_name}</p>
          <p className="text-[10px] text-slate-500">{new Date(file.created_at).toLocaleDateString('hu-HU')}</p>
        </div>
      </div>
      {onDelete && (
        <Button variant="ghost" size="icon"
                className="h-7 w-7 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.id);
                }}>
          <Trash2 className="w-3 h-3"/>
        </Button>
      )}
    </div>
  );
}

// --- BIZONYÍTÉKOK KÁRTYA (Használja az EvidenceItem-et) ---
export function EvidenceCard({evidence, onUpload, onView, onDelete}: {
  evidence: any[],
  onUpload?: () => void,
  onView: (file: any) => void,
  onDelete?: (id: string) => void
}) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm flex flex-col h-full min-h-0">
      <CardHeader
        className="pb-2 py-3 border-b border-slate-800/50 flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-orange-500"/> Bizonyítékok
        </CardTitle>
        {onUpload && (
          <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-white -mr-2"
                  onClick={onUpload}>
            <Plus className="w-4 h-4"/>
          </Button>
        )}
      </CardHeader>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {evidence.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-600">
                <FileText className="w-8 h-8 mb-2 opacity-20"/>
                <p className="text-xs">Nincsenek csatolt fájlok.</p>
              </div>
            ) : (
              evidence.map((file) => (
                <EvidenceItem key={file.id} file={file} onView={onView} onDelete={onDelete}/>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}