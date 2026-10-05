import {useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {Check, ClipboardCopy, Code2, Eye, FolderOpen, Info} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {BbcodePreview} from "@/components/BbcodePreview";
import {useAuth} from "@/context/AuthContext";
import {folderCode} from "@/lib/report-templates";
import {cn} from "@/lib/utils";

/** The opening post of the member's report folder on the forum. */
export function FolderTab() {
  const {profile} = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const code = folderCode(name);

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
      <section className="panel animate-rise space-y-4 p-5">
        <header className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25"><FolderOpen className="size-4"/></div>
          <div>
            <h3 className="font-semibold text-white">Jelentési mappa nyitása</h3>
            <p className="text-xs text-slate-500">A fórum Jelentések részlegén nyiss új témát ezzel a nyitó hozzászólással.</p>
          </div>
        </header>
        <div className="space-y-1.5">
          <Label htmlFor="folder-name">A mappa neve (a te neved)</Label>
          <Input id="folder-name" value={name} onChange={(event) => {
            setName(event.target.value);
            setCopied(false);
          }}/>
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-3 text-xs text-slate-300 ring-1 ring-white/10">
          <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300"/>
          Utána minden jelentésedet ebbe a témába válaszként töltsd fel. A hozzászólás linkjét (a „#” számra kattintva)
          a Jelentéseim fülön rögzítheted.
        </p>
      </section>

      <section className="panel animate-rise overflow-hidden" style={{"--i": 1} as CSSProperties}>
        <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <div className="inline-flex rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/10">
            {(["preview", "code"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setView(mode)}
                      className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors", view === mode ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                {mode === "preview" ? <><Eye className="size-3.5"/> Előnézet</> : <><Code2 className="size-3.5"/> BBCode</>}
              </button>
            ))}
          </div>
          <Button className="ml-auto" onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            toast.success("BBCode a vágólapon.");
          }}>{copied ? <Check/> : <ClipboardCopy/>} {copied ? "Másolva" : "Másolás"}</Button>
        </header>
        <div className="min-h-40 bg-[#141b24]/70 p-4">
          {view === "preview" ? <BbcodePreview source={code}/> : <pre className="font-mono text-[11px] whitespace-pre-wrap text-emerald-200/85 wrap-anywhere">{code}</pre>}
        </div>
      </section>
    </div>
  );
}
