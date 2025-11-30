import * as React from "react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Shield, Users, FileText, Plus, Paperclip, UserPlus, Fingerprint, X, Trash2, ExternalLink} from "lucide-react";
import type {Case} from "@/types/supabase";
import {cn} from "@/lib/utils";
import {useAuth} from "@/context/AuthContext";

// --- STÍLUS KONSTANSOK ---
const TECH_CARD_BASE = "bg-slate-950/80 border border-sky-900/30 backdrop-blur-md shadow-lg overflow-hidden relative group";
const TECH_HEADER = "pb-2 border-b border-sky-500/10 bg-sky-900/5";
const TECH_TITLE = "text-[10px] uppercase tracking-[0.2em] text-sky-400 font-bold flex items-center gap-2";

// --- INFO KÁRTYA (Bal oldal) ---
export function CaseInfoCard({caseData}: { caseData: Case }) {
  return (
    <Card className={TECH_CARD_BASE}>
      {/* Dekoratív sarok elem */}
      <div
        className="absolute top-0 right-0 w-8 h-8 border-t border-r border-sky-500/30 rounded-tr-lg pointer-events-none"></div>

      <CardHeader className={TECH_HEADER}>
        <CardTitle className={TECH_TITLE}>
          <Shield className="w-3.5 h-3.5"/> ÜGYIRAT ADATOK
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm relative z-10">
        <div className="flex justify-between items-center group/item">
          <span className="text-slate-500 text-xs uppercase font-mono">Ügyszám</span>
          <span
            className="font-mono text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 group-hover/item:border-sky-400 transition-colors">
             #{caseData.case_number.toString().padStart(4, '0')}
           </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-xs uppercase font-mono">Státusz</span>
          <Badge variant={caseData.status === 'open' ? 'default' : 'secondary'}
                 className={cn("uppercase tracking-wider text-[10px]", caseData.status === 'open' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30' : '')}>
            {caseData.status === 'open' ? 'NYITOTT' : caseData.status === 'closed' ? 'LEZÁRT' : 'ARCHIVÁLT'}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-xs uppercase font-mono">Prioritás</span>
          <Badge variant="outline" className={
            caseData.priority === 'critical' ? 'text-red-500 border-red-500 bg-red-500/10 animate-pulse' :
              caseData.priority === 'high' ? 'text-orange-400 border-orange-400 bg-orange-400/10' :
                'text-slate-300 border-slate-700'
          }>
            {caseData.priority.toUpperCase()}
          </Badge>
        </div>
        <div className="pt-3 border-t border-slate-800/50">
          <span className="text-slate-500 text-[10px] uppercase font-mono block mb-2">Vezető Nyomozó</span>
          <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded border border-slate-800">
            <div
              className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs font-bold text-sky-500 border border-slate-700">
              {caseData.owner?.full_name.charAt(0)}
            </div>
            <div>
              <p className="text-slate-200 text-xs font-bold">{caseData.owner?.full_name || "Ismeretlen"}</p>
              <p className="text-[10px] text-slate-500 font-mono">ID: {caseData.owner_id?.slice(0, 8)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- ÉRINTETT SZEMÉLYEK ---
export function SuspectsCard({suspects, onAdd, onView, onDelete}: {
  suspects: any[],
  onAdd?: () => void,
  onView: (suspect: any) => void,
  onDelete?: (id: string) => void
}) {
  return (
    <Card className={cn(TECH_CARD_BASE, "flex flex-col h-[320px] shrink-0")}>
      <CardHeader className={cn(TECH_HEADER, "flex flex-row items-center justify-between space-y-0 shrink-0")}>
        <CardTitle className={TECH_TITLE}>
          <Fingerprint className="w-3.5 h-3.5 text-red-500"/> ÉRINTETTEK ({suspects.length})
        </CardTitle>
        {onAdd &&
          <Button size="icon" variant="ghost"
                  className="h-5 w-5 text-slate-400 hover:text-white hover:bg-white/10 -mr-2" onClick={onAdd}>
            <Plus className="w-3.5 h-3.5"/>
          </Button>}
      </CardHeader>
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {suspects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 opacity-30">
                <Fingerprint className="w-8 h-8 mb-2"/>
                <p className="text-[10px] uppercase tracking-widest">Nincs adat</p>
              </div>
            ) : (
              suspects.map((item) => (
                <div key={item.id}
                     className="flex items-center justify-between p-2 rounded-md bg-slate-900/50 border border-slate-800 hover:border-sky-500/30 hover:bg-slate-900 transition-all group cursor-pointer relative overflow-hidden"
                >
                  {/* Status Indicator Stripe */}
                  <div className={cn("absolute left-0 top-0 bottom-0 w-0.5",
                    item.involvement_type === 'suspect' ? 'bg-red-500' :
                      item.involvement_type === 'perpetrator' ? 'bg-red-700' :
                        item.involvement_type === 'witness' ? 'bg-blue-500' : 'bg-yellow-500')}/>

                  <div className="flex items-center gap-3 overflow-hidden flex-1 pl-2"
                       onClick={() => onView(item.suspect)}>
                    <Avatar className="h-9 w-9 border border-slate-700 rounded-md">
                      <AvatarImage src={item.suspect?.mugshot_url} className="object-cover"/>
                      <AvatarFallback className="text-[10px] bg-slate-800 text-slate-400 rounded-md">
                        {item.suspect?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-bold text-slate-200 truncate group-hover:text-sky-400 transition-colors">{item.suspect?.full_name}</p>
                      <div className="flex items-center gap-2">
                         <span className={cn("text-[9px] uppercase font-bold tracking-wider",
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
                            className="h-6 w-6 text-slate-600 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item.id);
                            }}>
                      <Trash2 className="w-3 h-3"/>
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

// --- BIZONYÍTÉKOK ---
export function EvidenceCard({evidence, onUpload, onView, onDelete}: {
  evidence: any[],
  onUpload?: () => void,
  onView: (file: any) => void,
  onDelete?: (id: string) => void
}) {
  const {supabase} = useAuth();

  // Komponens az egyes fájloknak, hogy a preview URL működjön
  const EvidenceItem = ({file}: { file: any }) => {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    React.useEffect(() => {
      if (file.file_type === 'image') {
        supabase.storage.from('case_evidence').createSignedUrl(file.file_path, 3600).then(({data}) => {
          if (data) setPreviewUrl(data.signedUrl);
        });
      }
    }, [file]);

    return (
      <div
        className="flex items-center gap-3 p-2 rounded-md bg-slate-900/50 border border-slate-800 hover:border-sky-500/30 transition-all group cursor-pointer"
        onClick={() => onView(file)}>
        <div
          className="w-10 h-10 rounded bg-black/50 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 relative">
          {previewUrl ? (
            <img src={previewUrl} alt=""
                 className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"/>
          ) : (
            <FileText className="w-5 h-5 text-slate-600 group-hover:text-sky-400"/>
          )}
          {file.file_type === 'image' &&
            <div className="absolute inset-0 bg-sky-500/10 opacity-0 group-hover:opacity-100 transition-opacity"/>}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-medium text-slate-300 truncate group-hover:text-sky-400 transition-colors">{file.file_name}</p>
          <p className="text-[9px] text-slate-500 font-mono">{new Date(file.created_at).toLocaleDateString('hu-HU')}</p>
        </div>
        {onDelete && (
          <Button variant="ghost" size="icon"
                  className="h-7 w-7 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file.id);
                  }}>
            <Trash2 className="w-3 h-3"/>
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className={cn(TECH_CARD_BASE, "flex flex-col h-full min-h-0")}>
      <CardHeader className={cn(TECH_HEADER, "flex flex-row items-center justify-between space-y-0 shrink-0")}>
        <CardTitle className={TECH_TITLE}>
          <Paperclip className="w-3.5 h-3.5 text-orange-500"/> BIZONYÍTÉKOK
        </CardTitle>
        {onUpload && (
          <Button size="icon" variant="ghost"
                  className="h-5 w-5 text-slate-400 hover:text-white hover:bg-white/10 -mr-2" onClick={onUpload}>
            <Plus className="w-3.5 h-3.5"/>
          </Button>
        )}
      </CardHeader>
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {evidence.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 opacity-30">
                <Paperclip className="w-8 h-8 mb-2"/>
                <p className="text-[10px] uppercase tracking-widest">Üres mappa</p>
              </div>
            ) : (
              evidence.map((file) => <EvidenceItem key={file.id} file={file}/>)
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}

// --- KÖZREMŰKÖDŐK (Collaborators) ---
export function CollaboratorsCard({collaborators, onAdd, onDelete}: {
  collaborators: any[], onAdd?: () => void, onDelete?: (id: string) => void
}) {
  return (
    <Card className={cn(TECH_CARD_BASE, "flex flex-col h-[200px] shrink-0")}>
      <CardHeader className={cn(TECH_HEADER, "flex flex-row items-center justify-between space-y-0 shrink-0")}>
        <CardTitle className={TECH_TITLE}>
          <Users className="w-3.5 h-3.5 text-blue-500"/> KÖZREMŰKÖDŐK
        </CardTitle>
        {onAdd &&
          <Button size="icon" variant="ghost"
                  className="h-5 w-5 text-slate-400 hover:text-white hover:bg-white/10 -mr-2" onClick={onAdd}>
            <UserPlus className="w-3.5 h-3.5"/>
          </Button>}
      </CardHeader>
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {collaborators.map((collab) => (
              <div key={collab.id}
                   className="flex items-center justify-between p-2 rounded bg-slate-900/30 border border-slate-800/60 group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Avatar className="h-6 w-6 border border-slate-700">
                    <AvatarImage src={collab.profile?.avatar_url}/>
                    <AvatarFallback
                      className="text-[9px] bg-slate-800">{collab.profile?.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-300 truncate">{collab.profile?.full_name}</p>
                  </div>
                </div>
                {onDelete ? (
                  <Button variant="ghost" size="icon"
                          className="h-5 w-5 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100"
                          onClick={() => onDelete(collab.id)}>
                    <X className="w-3 h-3"/>
                  </Button>
                ) : (
                  <Badge variant="outline"
                         className="text-[9px] border-slate-800 text-slate-600 px-1">{collab.role === 'editor' ? 'EDIT' : 'READ'}</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}