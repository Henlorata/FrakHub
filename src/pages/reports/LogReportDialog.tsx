import {useMemo, useState} from "react";
import {toast} from "sonner";
import {Link2, ListPlus, Loader2, Save} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useProfileDirectory} from "@/lib/profile-directory";
import {todayKey} from "@/lib/datetime";
import {normalizeForumUrl} from "@/lib/report-templates";
import {reportLog, reportLogError, type ReportLog} from "@/lib/report-log";
import {cn} from "@/lib/utils";

interface LogReportDialogProps {
  /** Whose report it is (the caller unless staff pick someone). */
  userId: string;
  /** Staff may record reports for others (counted from the forum). */
  pickMember?: boolean;
  /** Editing an existing entry. */
  entry?: ReportLog | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Records a report posted on the forum (or several at once by their links), or edits one. */
export function LogReportDialog({userId, pickMember, entry, defaultDate, onClose, onSaved}: LogReportDialogProps) {
  const {profiles} = useProfileDirectory();
  const [member, setMember] = useState(entry?.user_id ?? userId);
  const [term, setTerm] = useState("");
  const [date, setDate] = useState(entry?.occurred_on ?? defaultDate ?? todayKey());
  const [title, setTitle] = useState(entry?.title ?? "");
  const [link, setLink] = useState(entry?.forum_url ?? "");
  const [bulk, setBulk] = useState(false);
  const [links, setLinks] = useState("");
  const [saving, setSaving] = useState(false);

  const members = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return profiles.filter((profile) => profile.system_role !== "pending"
      && (!needle || profile.full_name.toLowerCase().includes(needle) || profile.badge_number.includes(needle))).slice(0, 8);
  }, [profiles, term]);
  const chosen = profiles.find((profile) => profile.id === member);

  const bulkLines = links.split(/\s+/).map((line) => line.trim()).filter(Boolean);
  const bulkUrls = bulkLines.map(normalizeForumUrl);
  const bulkInvalid = bulkUrls.filter((url) => url === null).length;
  const linkInvalid = link.trim() !== "" && normalizeForumUrl(link) === null;

  const submit = async () => {
    if (!date) return toast.error("Add meg a dátumot.");
    setSaving(true);
    try {
      if (entry) {
        if (!title.trim()) return toast.error("Adj címet a bejegyzésnek.");
        if (linkInvalid) return toast.error("Csak forum.hl-rpg.eu link adható meg.");
        await reportLog.update(entry.id, {title: title.trim(), forum_url: normalizeForumUrl(link), occurred_on: date});
        toast.success("Bejegyzés mentve.");
      } else if (bulk) {
        if (bulkLines.length === 0) return toast.error("Illeszd be a fórum-linkeket (soronként egyet).");
        if (bulkInvalid > 0) return toast.error(`${bulkInvalid} link nem a fórumra mutat.`);
        const unique = [...new Set(bulkUrls as string[])];
        await reportLog.add(unique.map((url) => ({
          user_id: member, occurred_on: date, source: "manual" as const, forum_url: url,
          title: `Fórum-jelentés ${url.match(/posts\/(\d+)/)?.[1] ? `#${url.match(/posts\/(\d+)/)?.[1]}` : ""}`.trim(),
        })));
        toast.success(`${unique.length} jelentés rögzítve.`);
      } else {
        if (!title.trim()) return toast.error("Adj címet a jelentésnek (pl. a gyanúsított neve és a vád).");
        if (linkInvalid) return toast.error("Csak forum.hl-rpg.eu link adható meg.");
        await reportLog.add([{user_id: member, occurred_on: date, title: title.trim(), forum_url: normalizeForumUrl(link), source: "manual"}]);
        toast.success("Jelentés rögzítve.");
      }
      onSaved();
    } catch (error) {
      toast.error(reportLogError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle className="flex items-center gap-2"><ListPlus className="size-4 text-sky-400"/> {entry ? "Bejegyzés szerkesztése" : "Jelentés rögzítése"}</DialogTitle>
          <DialogDescription className="mt-1">
            A havi fizetés a rögzített jelentéseket számolja. A fórum-link nem kötelező, de a vezetőség ebből ellenőrzi a jelentést.
          </DialogDescription>
        </div>

        {pickMember && !entry && (
          <div className="space-y-1.5">
            <Label>Tag</Label>
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={chosen ? `${chosen.full_name} (#${chosen.badge_number})` : "Név vagy jelvényszám…"}/>
            {term && (
              <div className="flex flex-wrap gap-1.5">
                {members.map((profile) => (
                  <button key={profile.id} type="button" onClick={() => {
                    setMember(profile.id);
                    setTerm("");
                  }} className={cn("rounded-full px-2.5 py-1 text-xs ring-1 transition-colors",
                    profile.id === member ? "bg-sky-500/15 text-sky-200 ring-sky-500/40" : "text-slate-300 ring-white/10 hover:bg-white/5")}>
                    {profile.full_name}
                  </button>
                ))}
              </div>
            )}
            {chosen && !term && <p className="text-xs text-slate-400">Kinek: <span className="text-white">{chosen.full_name}</span> · {chosen.faction_rank}</p>}
          </div>
        )}

        {!entry && (
          <div className="inline-flex w-fit rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/10">
            {[false, true].map((value) => (
              <button key={String(value)} type="button" onClick={() => setBulk(value)}
                      className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", bulk === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
                {value ? "Több link egyszerre" : "Egy jelentés"}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="log-date">Az intézkedés napja</Label>
          <Input id="log-date" type="date" value={date} max={todayKey()} onChange={(event) => setDate(event.target.value)} className="w-48"/>
        </div>

        {bulk && !entry ? (
          <div className="space-y-1.5">
            <Label htmlFor="log-links">Fórum-linkek (soronként egy)</Label>
            <Textarea id="log-links" value={links} onChange={(event) => setLinks(event.target.value)} className="min-h-32 font-mono text-xs"
                      placeholder={"https://forum.hl-rpg.eu/threads/.../post-123456\nhttps://forum.hl-rpg.eu/posts/123457/"}/>
            <p className={cn("text-xs", bulkInvalid ? "text-red-300" : "text-slate-500")}>
              {bulkLines.length} link{bulkInvalid ? ` · ${bulkInvalid} nem fórum-link` : ""}. Ugyanaz a bejegyzés csak egyszer számít.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="log-title">Cím</Label>
              <Input id="log-title" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)}
                     placeholder="pl. John Doe – gyorshajtás, rendőri utasítás megtagadása"/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-link" className="flex items-center gap-1.5"><Link2 className="size-3.5"/> Fórum-link (nem kötelező)</Label>
              <Input id="log-link" value={link} onChange={(event) => setLink(event.target.value)} aria-invalid={linkInvalid}
                     className={cn("font-mono text-xs", linkInvalid && "ring-2 ring-red-500/60")} placeholder="https://forum.hl-rpg.eu/threads/.../post-123456"/>
              <p className="text-[11px] text-slate-500">A hozzászólás „#” számára kattintva kapod meg a linkjét.</p>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} {entry ? "Mentés" : "Rögzítés"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
