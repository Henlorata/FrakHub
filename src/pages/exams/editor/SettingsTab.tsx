import type {CSSProperties, ReactNode} from "react";
import {Clock, Globe, Lock, Percent, Share2, Shuffle, Sparkles, Target, Trash2, Users, Zap} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Slider} from "@/components/ui/slider";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {FACTION_RANKS, type Profile} from "@/types/supabase";
import {cn} from "@/lib/utils";
import {allowedDivisions, allowedTypes, type DraftSettings} from "./editor-model";

const COOLDOWNS = [0, 1, 12, 24, 72, 168];
const cooldownLabel = (hours: number) => (hours === 0 ? "Nincs várakozás" : hours < 24 ? `${hours} óra` : `${hours / 24} nap`);

interface SettingsTabProps {
  settings: DraftSettings;
  profile: Profile;
  onChange: (patch: Partial<DraftSettings>) => void;
  canDelete: boolean;
  onDelete: () => void;
}

/** Exam settings in four groups: basics, audience, timing and grading, fair play. */
export function SettingsTab({settings, profile, onChange, canDelete, onDelete}: SettingsTabProps) {
  const types = allowedTypes(profile);
  const divisions = allowedDivisions(profile);
  if (settings.division && !divisions.includes(settings.division)) divisions.push(settings.division);
  const number = (value: string, min: number, max: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? min : Math.max(min, Math.min(max, parsed));
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Card index={0} icon={Sparkles} title="Alapadatok" className="xl:col-span-2">
        <label className="block space-y-1.5">
          <span className="text-xs text-slate-400">Cím</span>
          <Input value={settings.title} maxLength={120} onChange={(event) => onChange({title: event.target.value})}
                 placeholder="Például: SEB alapvizsga" className="h-11 text-base font-medium"/>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-slate-400">Leírás a vizsgázóknak</span>
          <Textarea value={settings.description} maxLength={4000} onChange={(event) => onChange({description: event.target.value})}
                    placeholder="Miből készüljön, mire figyeljen…" className="min-h-28"/>
        </label>
      </Card>

      <Card index={1} icon={Users} title="Kinek szól?">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Típus">
            <Select value={settings.type} onValueChange={(value) => onChange({type: value as DraftSettings["type"]})}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>{types.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Osztály / alegység">
            <Select value={settings.division ?? "none"} onValueChange={(value) => onChange({division: value === "none" ? null : value})}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Válassz…"/></SelectTrigger>
              <SelectContent>
                {profile.is_bureau_manager && <SelectItem value="none">Nincs (általános)</SelectItem>}
                {divisions.map((division) => <SelectItem key={division} value={division}>{division}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Legalább ez a rendfokozat">
            <Select value={settings.required_rank ?? "none"} onValueChange={(value) => onChange({required_rank: value === "none" ? null : value})}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bárki</SelectItem>
                {FACTION_RANKS.map((rank) => <SelectItem key={rank} value={rank}>{rank}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Napok a jelenlegi rendfokozatban">
            <Input type="number" min={0} max={365} value={settings.min_days_in_rank}
                   onChange={(event) => onChange({min_days_in_rank: number(event.target.value, 0, 365)})}/>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle icon={Lock} title="Meghívásos" hint="Csak akik hozzáférést kapnak" checked={settings.is_invitation_only}
                  onChange={(value) => onChange({is_invitation_only: value})}/>
          <Toggle icon={Globe} title="Nyilvános" hint="Vendégek is kitölthetik (felvételi)" checked={settings.is_public}
                  onChange={(value) => onChange({is_public: value})}/>
          <Toggle icon={Share2} title="Link megosztása" hint="A javítók kimásolhatják a linket" checked={settings.allow_sharing}
                  onChange={(value) => onChange({allow_sharing: value})}/>
          <Toggle icon={Target} title="Aktív" hint="Most is kitölthető" checked={settings.is_active}
                  onChange={(value) => onChange({is_active: value})}/>
        </div>
      </Card>

      <Card index={2} icon={Clock} title="Idő és értékelés">
        <Field label="Időkorlát (perc)">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" min={1} max={240} value={settings.time_limit_minutes} className="w-24"
                   onChange={(event) => onChange({time_limit_minutes: number(event.target.value, 1, 240)})}/>
            {[15, 30, 45, 60, 90].map((minutes) => (
              <button key={minutes} type="button" onClick={() => onChange({time_limit_minutes: minutes})}
                      className={cn("rounded-lg px-2.5 py-1 text-xs ring-1 transition-colors",
                        settings.time_limit_minutes === minutes ? "bg-primary/15 text-primary ring-primary/40" : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                {minutes}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`Sikeres határ: ${settings.passing_percentage}%`}>
          <div className="flex items-center gap-3">
            <Percent className="size-4 text-slate-500"/>
            <Slider min={1} max={100} step={1} value={[settings.passing_percentage]}
                    onValueChange={([value]) => onChange({passing_percentage: value})} className="flex-1"/>
          </div>
        </Field>
        <Field label="Várakozás bukás után (alapértelmezés, a javító módosíthatja)">
          <Select value={String(settings.retry_cooldown_hours)} onValueChange={(value) => onChange({retry_cooldown_hours: Number(value)})}>
            <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
            <SelectContent>
              {[...new Set([...COOLDOWNS, settings.retry_cooldown_hours])].sort((a, b) => a - b).map((hours) => (
                <SelectItem key={hours} value={String(hours)}>{cooldownLabel(hours)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Toggle icon={Zap} title="Azonnali eredmény" checked={settings.auto_grade} onChange={(value) => onChange({auto_grade: value})}
                hint="Ha nincs pontozott kifejtős kérdés, a lap leadáskor rögtön értékelődik (a sikeres határ szerint)."/>
      </Card>

      <Card index={3} icon={Shuffle} title="Tisztességes vizsga" className="xl:col-span-2">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Toggle icon={Shuffle} title="Kérdések keverése" hint="Oldalanként más sorrend minden vizsgázónak" checked={settings.shuffle_questions}
                  onChange={(value) => onChange({shuffle_questions: value})}/>
          <Toggle icon={Shuffle} title="Válaszok keverése" hint="A válaszlehetőségek sorrendje is változik" checked={settings.shuffle_options}
                  onChange={(value) => onChange({shuffle_options: value})}/>
          <Toggle icon={Lock} title="Másolás és beillesztés tiltása" hint="A próbálkozás a naplóba kerül" checked={settings.block_clipboard}
                  onChange={(value) => onChange({block_clipboard: value})}/>
        </div>
        <p className="text-xs text-slate-400">
          Kérdésbank: a Kérdések fülön oldalanként megadhatod, hány kérdést kapjon a vizsgázó az oldal kérdései közül. Így két vizsgázó
          ritkán kap egyforma lapot. A javító minden lapon látja, mennyi időre hagyta el a vizsgázó az oldalt, és mennyi szöveget illesztett be.
        </p>
      </Card>

      {canDelete && (
        <div className="flex justify-end xl:col-span-2">
          <Button variant="ghost" className="text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={onDelete}><Trash2/> Vizsga törlése</Button>
        </div>
      )}
    </div>
  );
}

function Card({icon: Icon, title, children, className, index}: {icon: typeof Clock; title: string; children: ReactNode; className?: string; index: number}) {
  return (
    <section style={{"--i": index} as CSSProperties} className={cn("panel animate-rise space-y-4 p-5", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="size-4 text-yellow-400"/> {title}</h2>
      {children}
    </section>
  );
}

function Field({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function Toggle({icon: Icon, title, hint, checked, onChange}: {icon: typeof Clock; title: string; hint: string; checked: boolean; onChange: (value: boolean) => void}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition-colors",
      checked ? "bg-primary/[0.07] ring-primary/30" : "bg-white/[0.02] ring-white/5 hover:ring-white/15")}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", checked ? "text-primary" : "text-slate-500")}/>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-100">{title}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange}/>
    </label>
  );
}
