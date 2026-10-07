import {useEffect, useMemo, useRef, useState} from "react";
import {toast} from "sonner";
import {AtSign, Building2, Globe, Loader2, Send, Users, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {useConfirm} from "@/components/ConfirmDialog";
import {useAuth} from "@/context/AuthContext";
import {formatMonthDate} from "@/lib/datetime";
import {fillMailTokens, mailApi, type MailDirectory, type MailRecipient, type MailSenderKind, type MailTemplate} from "@/lib/mail";
import {cn, errorMessage} from "@/lib/utils";
import {TemplatePicker} from "./MailTemplates";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type Chip = MailRecipient & {label: string; address: string};

/** The "to:" field: shared addresses and members, picked by name or address. */
export function RecipientPicker({directory, value, onChange, exclude = []}: {
  directory: MailDirectory;
  value: Chip[];
  onChange: (value: Chip[]) => void;
  exclude?: string[];
}) {
  const [term, setTerm] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const taken = new Set([...value.map((chip) => chip.address), ...exclude]);
  const needle = fold(term.trim());
  const groups = directory.groups.filter((group) => group.allowed && !taken.has(group.address)
    && (!needle || fold(`${group.label} ${group.address}`).includes(needle)));
  const members = directory.members.filter((member) => !taken.has(member.address) && member.address !== directory.me.address
    && (!needle || fold(`${member.name} ${member.address} ${member.badge}`).includes(needle))).slice(0, needle ? 8 : 5);

  const add = (chip: Chip) => {
    onChange([...value, chip]);
    setTerm("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className={cn("flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 transition",
        focused && "ring-2 ring-ring/50")} onClick={() => inputRef.current?.focus()}>
        {value.map((chip) => (
          <span key={chip.address} className={cn("inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1",
            chip.kind === "group" ? "bg-indigo-500/10 text-indigo-200 ring-indigo-500/30" : "bg-white/5 text-slate-200 ring-white/10")}>
            {chip.kind === "group" ? <Users className="size-3 shrink-0"/> : <AtSign className="size-3 shrink-0"/>}
            <span className="truncate">{chip.label}</span>
            <button type="button" aria-label={`${chip.label} eltávolítása`} className="rounded hover:bg-white/10"
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(value.filter((item) => item.address !== chip.address));
                    }}><X className="size-3"/></button>
          </span>
        ))}
        <input ref={inputRef} value={term} onChange={(event) => setTerm(event.target.value)} placeholder={value.length ? "" : "Név, cím vagy csoport…"}
               onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 150)}
               onKeyDown={(event) => {
                 if (event.key === "Backspace" && !term && value.length) onChange(value.slice(0, -1));
                 if (event.key === "Enter") {
                   event.preventDefault();
                   const first = groups[0] ? {kind: "group" as const, key: groups[0].key, label: groups[0].label, address: groups[0].address}
                     : members[0] ? {kind: "user" as const, id: members[0].id, label: members[0].name, address: members[0].address} : null;
                   if (first) add(first);
                 }
               }}
               aria-label="Címzett" className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"/>
      </div>
      {focused && (groups.length > 0 || members.length > 0) && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#0b1220] p-1 shadow-2xl">
          {groups.length > 0 && <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Csoportcímek</p>}
          {groups.map((group) => (
            <button key={group.key} type="button" onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add({kind: "group", key: group.key, label: group.label, address: group.address})}
                    className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5">
              <Users className="size-4 shrink-0 text-indigo-300"/>
              <span className="min-w-0 flex-1 truncate text-slate-100">{group.label}</span>
              <span className="truncate font-mono text-[11px] text-slate-500">{group.address}</span>
            </button>
          ))}
          {members.length > 0 && <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Tagok</p>}
          {members.map((member) => (
            <button key={member.id} type="button" onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add({kind: "user", id: member.id, label: member.name, address: member.address})}
                    className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5">
              <AtSign className="size-4 shrink-0 text-slate-400"/>
              <span className="min-w-0 flex-1 truncate text-slate-100">{member.name} <span className="text-xs text-slate-500">{member.rank}</span></span>
              <span className="truncate font-mono text-[11px] text-slate-500">{member.address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type {Chip as RecipientChip};

export const toRecipient = (chip: Chip): MailRecipient => (chip.kind === "group" ? {kind: "group", key: chip.key} : {kind: "user", id: chip.id});

/** Who the letter is from: the member, an office they belong to, or (recorded) an outside sender. */
export function SenderSelect({directory, value, onChange}: {directory: MailDirectory; value: MailSenderKind; onChange: (value: MailSenderKind) => void}) {
  if (directory.offices.length === 0 && !directory.can_external) return null;
  return (
    <Select value={value} onValueChange={(next) => onChange(next as MailSenderKind)}>
      <SelectTrigger className="h-9 w-full max-w-full min-w-0 sm:w-auto sm:max-w-sm"><SelectValue/></SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)]">
        <SelectItem value="self"><span className="min-w-0 truncate font-mono text-xs">{directory.me.address}</span></SelectItem>
        {directory.offices.map((office) => (
          <SelectItem key={office.key} value={office.key}>
            <Building2 className="size-3.5"/> <span className="min-w-0 truncate">{office.label} <span className="font-mono text-xs text-slate-500">{office.address}</span></span>
          </SelectItem>
        ))}
        {directory.can_external && <SelectItem value="external"><Globe className="size-3.5"/> Külső feladó (rögzítés)</SelectItem>}
      </SelectContent>
    </Select>
  );
}

/** A new letter. */
export function MailComposer({open, onOpenChange, onSent, initialTo}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (threadId: string) => void;
  initialTo?: Chip[];
}) {
  const [directory, setDirectory] = useState<MailDirectory | null>(null);
  const [to, setTo] = useState<Chip[]>(initialTo ?? []);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sender, setSender] = useState<MailSenderKind>("self");
  const [externalName, setExternalName] = useState("");
  const [externalAddress, setExternalAddress] = useState("");
  const [sending, setSending] = useState(false);
  const {profile} = useAuth();
  const confirm = useConfirm();

  useEffect(() => {
    if (!open) return;
    let active = true;
    mailApi.directory().then((value) => active && setDirectory(value), (error) => toast.error(errorMessage(error, "A címjegyzék nem tölthető be.")));
    return () => {
      active = false;
    };
  }, [open]);

  const problem = useMemo(() => {
    if (to.length === 0) return "Adj meg legalább egy címzettet.";
    if (!subject.trim()) return "Adj tárgyat a levélnek.";
    if (!body.trim()) return "A levél üres.";
    if (sender === "external" && (externalName.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(externalAddress.trim()))) {
      return "Add meg a külső feladó nevét és e-mail címét.";
    }
    return null;
  }, [to, subject, body, sender, externalName, externalAddress]);

  /** Fills the subject and the text from a template (the recipient's data when there is exactly one member). */
  const applyTemplate = async (template: MailTemplate) => {
    if (!directory) return;
    if ((subject.trim() || body.trim())
      && !(await confirm({title: "Lecseréled a levelet?", description: "A sablon felülírja a tárgyat és a szöveget.", confirmLabel: "Csere"}))) return;
    const only = to.length === 1 && to[0].kind === "user" ? directory.members.find((member) => to[0].kind === "user" && member.id === to[0].id) : undefined;
    const office = sender !== "self" && sender !== "external" ? directory.offices.find((item) => item.key === sender) : undefined;
    const values = {
      "címzett": only?.name, "címzett_rang": only?.rank, "címzett_jelvény": only?.badge,
      "feladó": office?.label ?? profile?.full_name, "feladó_rang": office ? "" : profile?.faction_rank ?? "", "dátum": formatMonthDate(),
    };
    setSubject(fillMailTokens(template.subject, values));
    setBody(fillMailTokens(template.body, values));
    if (!only && /\{\{\s*címzett/.test(`${template.subject}${template.body}`)) {
      toast.info("A címzett adatait a sablon egyetlen tagcímzettnél tölti ki: a {{címzett}} jelöléseket írd át.");
    }
  };

  const send = async () => {
    if (problem) return toast.error(problem);
    setSending(true);
    try {
      const threadId = await mailApi.send({
        subject: subject.trim(), body, to: to.map(toRecipient),
        as: sender, externalName: sender === "external" ? externalName.trim() : null, externalAddress: sender === "external" ? externalAddress.trim() : null,
      });
      toast.success("Levél elküldve.");
      setSubject("");
      setBody("");
      setTo([]);
      // Closed first: the page then opens the new thread (its address change wins).
      onOpenChange(false);
      onSent(threadId);
    } catch (error) {
      toast.error(errorMessage(error, "A levél nem ment el."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Új levél</DialogTitle>
          <DialogDescription>A címzettek és a csoportcímek tagjai olvassák, és válaszolhatnak rá.</DialogDescription>
        </DialogHeader>
        {!directory ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-slate-500"/></div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-center">
              <Label className="text-xs text-slate-400">Feladó</Label>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SenderSelect directory={directory} value={sender} onChange={setSender}/>
                {directory.offices.length === 0 && !directory.can_external && <span className="font-mono text-sm text-slate-300">{directory.me.address}</span>}
              </div>
            </div>
            {sender === "external" && (
              <div className="grid grid-cols-1 gap-2 rounded-lg bg-amber-500/[0.05] p-3 ring-1 ring-amber-500/20 sm:grid-cols-2">
                <Input value={externalName} onChange={(event) => setExternalName(event.target.value)} placeholder="Feladó neve (pl. Commander Harvey Cooper)" maxLength={120}/>
                <Input value={externalAddress} onChange={(event) => setExternalAddress(event.target.value)} placeholder="Címe (pl. cmd.cooper@lspd.org)" maxLength={160}
                       className="font-mono"/>
                <p className="text-[11px] text-amber-200/80 sm:col-span-2">Egy kívülről érkezett levelet rögzítesz; a levél alatt látszik, hogy te vetted fel.</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-center">
              <Label className="text-xs text-slate-400">Címzett</Label>
              <RecipientPicker directory={directory} value={to} onChange={setTo}/>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-center">
              <Label htmlFor="mail-subject" className="text-xs text-slate-400">Tárgy</Label>
              <Input id="mail-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} placeholder="pl. Felülvizsgálati kérelem, tájékoztatás."/>
            </div>
            <div className="flex justify-end">
              <TemplatePicker canShare={directory.can_broadcast} onPick={(template) => void applyTemplate(template)}/>
            </div>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} maxLength={20000}
                      placeholder={"Tisztelt …!\n\n…\n\nTisztelettel,"} className="min-h-56 font-[ui-serif,Georgia,serif] text-[15px] leading-relaxed"/>
            <p className="text-[11px] text-slate-500">A saját nevedben írt levél alá az aláírásod kerül; az iroda nevében írtak alá az iroda neve.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Mégse</Button>
          <Button onClick={() => void send()} disabled={!directory || sending}>{sending ? <Loader2 className="animate-spin"/> : <Send/>} Küldés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
