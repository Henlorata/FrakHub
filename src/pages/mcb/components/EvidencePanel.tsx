import {useState} from "react";
import {Brush, Check, FileText, Image as ImageIcon, MoreVertical, Paperclip, Pencil, Plus, ScrollText, Trash2, UploadCloud, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {EmptyState} from "@/components/layout/EmptyState";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {withTransformation} from "@/lib/cloudinary";
import {formatDate} from "@/lib/datetime";
import {isRemoteFile} from "@/lib/mcb";
import {cn} from "@/lib/utils";
import type {CaseEvidence} from "@/types/supabase";

interface EvidencePanelProps {
  evidence: CaseEvidence[];
  numbers: Map<string, number>;
  /** evidence id -> evidence blocks in the document */
  usage: Map<string, number>;
  canEdit: boolean;
  canDelete: (item: CaseEvidence) => boolean;
  onUpload: () => void;
  onView: (id: string) => void;
  onInsert: (id: string) => void;
  onRename: (item: CaseEvidence, name: string) => Promise<boolean>;
  onDelete: (item: CaseEvidence) => void;
  /** Draw on a copy of an uploaded picture (the original stays as it is). */
  onAnnotate?: (item: CaseEvidence) => void;
}

/** The case's evidence as a numbered gallery (#1 = first upload). */
export function EvidencePanel({evidence, numbers, usage, canEdit, canDelete, onUpload, onView, onInsert, onRename, onDelete, onAnnotate}: EvidencePanelProps) {
  const [renaming, setRenaming] = useState<{id: string; name: string} | null>(null);
  const [filter, setFilter] = useState<"all" | "image" | "document" | "unused">("all");
  const sorted = [...evidence].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));
  const shown = sorted.filter((item) => filter === "all" || (filter === "unused" ? !usage.get(item.id)
    : filter === "image" ? item.file_type === "image" : item.file_type !== "image"));
  const unused = evidence.filter((item) => !usage.get(item.id)).length;

  const submitRename = async () => {
    if (!renaming) return;
    const item = evidence.find((entry) => entry.id === renaming.id);
    if (item && renaming.name.trim() && renaming.name.trim() !== item.file_name) {
      if (!(await onRename(item, renaming.name.trim()))) return;
    }
    setRenaming(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {canEdit && (
        <div className="flex shrink-0 items-center gap-2 px-3 pt-3">
          <p className="min-w-0 flex-1 truncate text-xs text-slate-500">Húzd a fájlokat az oldalra, vagy illeszd be (Ctrl+V).</p>
          <Button size="sm" onClick={onUpload} className="h-8 shrink-0 bg-amber-500 text-black hover:bg-amber-400">
            <Plus className="size-4"/> Feltöltés
          </Button>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {([["all", "Mind", evidence.length], ["image", "Képek", null], ["document", "Dokumentumok", null],
            ["unused", "Szövegen kívül", unused]] as const).map(([value, label, count]) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
                    className={cn("h-7 shrink-0 rounded-full px-2.5 text-[11px] ring-1 transition",
                      filter === value ? "bg-amber-500/15 text-amber-200 ring-amber-500/30" : "text-slate-400 ring-white/10 hover:text-white")}>
              {label}{count !== null ? ` · ${count}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {evidence.length === 0 ? (
          <EmptyState compact icon={Paperclip} title="Nincs még bizonyíték"
                      description={canEdit ? "Tölts fel képet vagy dokumentumot, vagy húzd a fájlt az oldalra." : "Az aktához nem csatoltak fájlt."}
                      action={canEdit ? <Button size="sm" variant="outline" onClick={onUpload}><UploadCloud className="size-4"/> Feltöltés</Button> : undefined}/>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">Nincs ilyen bizonyíték.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {shown.map((item) => {
              const inText = usage.get(item.id) ?? 0;
              const image = item.file_type === "image" && isRemoteFile(item.file_path);
              return (
                <li key={item.id} className="group relative overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/10 transition hover:ring-amber-500/40">
                  <button type="button" onClick={() => onView(item.id)} className="block w-full text-left">
                    <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
                      {image ? (
                        <img src={withTransformation(item.file_path, "c_fill,w_320,h_240,q_auto,f_auto")} alt="" loading="lazy"
                             className="size-full object-cover transition duration-500 group-hover:scale-105"/>
                      ) : (
                        <span className="grid size-full place-items-center text-slate-500">
                          {item.file_type === "image" ? <ImageIcon className="size-7"/> : <FileText className="size-7"/>}
                        </span>
                      )}
                      <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                        #{numbers.get(item.id)}
                      </span>
                      {inText > 0 && (
                        <span title="Szerepel a dokumentumban" className="absolute right-1.5 bottom-1.5 grid size-5 place-items-center rounded-md bg-emerald-500/80 text-black">
                          <ScrollText className="size-3"/>
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="px-2 py-1.5">
                    {renaming?.id === item.id ? (
                      <form className="flex items-center gap-1" onSubmit={(event) => {
                        event.preventDefault();
                        void submitRename();
                      }}>
                        <Input value={renaming.name} autoFocus maxLength={120} onChange={(event) => setRenaming({...renaming, name: event.target.value})}
                               className="h-7 px-2 text-xs"/>
                        <button type="submit" aria-label="Mentés" className="rounded p-1 text-emerald-300 hover:bg-white/10"><Check className="size-3.5"/></button>
                        <button type="button" aria-label="Mégse" onClick={() => setRenaming(null)} className="rounded p-1 text-slate-400 hover:bg-white/10">
                          <X className="size-3.5"/>
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="truncate text-xs font-medium text-slate-100" title={item.file_name}>{item.file_name}</p>
                        <p className="truncate text-[10px] text-slate-500">{formatDate(item.created_at)}{item.uploader_name ? ` · ${item.uploader_name}` : ""}</p>
                      </>
                    )}
                  </div>
                  {(canEdit || canDelete(item)) && renaming?.id !== item.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label="Műveletek"
                                className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-md bg-black/60 text-slate-200 opacity-0 transition group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100">
                          <MoreVertical className="size-4"/>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {canEdit && (
                          <DropdownMenuItem onSelect={() => onInsert(item.id)}><ScrollText className="size-4"/> Beillesztés a dokumentumba</DropdownMenuItem>
                        )}
                        {canEdit && (
                          <DropdownMenuItem onSelect={() => setRenaming({id: item.id, name: item.file_name})}><Pencil className="size-4"/> Átnevezés</DropdownMenuItem>
                        )}
                        {canEdit && image && onAnnotate && (
                          <DropdownMenuItem onSelect={() => onAnnotate(item)}><Brush className="size-4"/> Jelölt másolat</DropdownMenuItem>
                        )}
                        {canDelete(item) && (
                          <>
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}><Trash2 className="size-4"/> Törlés</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
