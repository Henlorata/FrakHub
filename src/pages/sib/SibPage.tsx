import {useEffect, useRef, useState, type ReactNode} from "react";
import {Link, useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  ArrowDown, ArrowUp, ExternalLink, Eye, ImagePlus, LayoutTemplate, Loader2, Megaphone, Newspaper, PenSquare, Plus, Save, Trash2,
} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Textarea} from "@/components/ui/textarea";
import {getOptimizedImageUrl, uploadToCloudinary} from "@/lib/cloudinary";
import {formatAgo, formatDateTime} from "@/lib/datetime";
import {articleDate, NEWS_CATEGORIES, siteApi, UNIT_ORDER, type SiteContent, type SiteEditor} from "@/lib/site";
import {cn, errorMessage} from "@/lib/utils";

type Tab = "news" | "page" | "gallery";

/**
 * The Sheriff's Information Bureau's desk: the news (drafts and published), the front page's
 * sections and its gallery. The SIB, the Command and Executive Staff and the Bureau Manager.
 */
export function SibPage() {
  const [params, setParams] = useSearchParams();
  const tab = (["news", "page", "gallery"].includes(params.get("tab") ?? "") ? params.get("tab") : "news") as Tab;
  const [data, setData] = useState<SiteEditor | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = () => siteApi.editor().then((next) => {
    setData(next);
    setFailed(null);
  }, (error) => setFailed(errorMessage(error, "A sajtóiroda nem tölthető be.")));

  useEffect(() => {
    void load();
  }, []);

  if (failed) return <div className="mx-auto max-w-3xl pt-10"><div className="panel"><EmptyState icon={Megaphone} title={failed}/></div></div>;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <PageHeader icon={Megaphone} tone="gold" eyebrow="Sheriff's Information Bureau" title="Sajtóiroda"
                  description="A nyilvános főoldal és a hírek: amit a látogatók és a jelentkezők látnak a departmentről."
                  actions={(
                    <>
                      <Button variant="outline" asChild><a href="/home" target="_blank" rel="noreferrer"><ExternalLink/> Főoldal megnyitása</a></Button>
                      <Button asChild><Link to="/sib/news/new"><Plus/> Új hír</Link></Button>
                    </>
                  )}/>
      <Tabs value={tab} onValueChange={(value) => setParams(value === "news" ? {} : {tab: value})}>
        <TabsList data-tour="sib-tabs">
          <TabsTrigger value="news"><Newspaper className="size-4"/> Hírek</TabsTrigger>
          <TabsTrigger value="page"><LayoutTemplate className="size-4"/> Főoldal</TabsTrigger>
          <TabsTrigger value="gallery"><ImagePlus className="size-4"/> Galéria</TabsTrigger>
        </TabsList>
        <TabsContent value="news" className="mt-5"><NewsList data={data}/></TabsContent>
        <TabsContent value="page" className="mt-5">{data ? <ContentEditor data={data} onSaved={() => void load()}/> : <div className="skeleton h-96 rounded-2xl"/>}</TabsContent>
        <TabsContent value="gallery" className="mt-5">{data ? <GalleryEditor initial={data.content.gallery ?? []} onSaved={() => void load()}/> : <div className="skeleton h-96 rounded-2xl"/>}</TabsContent>
      </Tabs>
    </div>
  );
}

function NewsList({data}: {data: SiteEditor | null}) {
  if (data === null) return <div className="space-y-2">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-20 rounded-xl"/>)}</div>;
  if (data.posts.length === 0) {
    return (
      <div className="panel"><EmptyState icon={Newspaper} title="Még nincs hír" description="Az első hír a főoldal hírszalagján és a hírek között jelenik meg."
                                          action={<Button size="sm" asChild><Link to="/sib/news/new"><Plus/> Új hír</Link></Button>}/></div>
    );
  }
  return (
    <ul className="space-y-2">
      {data.posts.map((post) => {
        const category = NEWS_CATEGORIES[post.category] ?? NEWS_CATEGORIES.news;
        return (
          <li key={post.id} className="panel flex min-w-0 flex-wrap items-center gap-4 p-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
              {post.cover_url ? <img src={getOptimizedImageUrl(post.cover_url, 160) || post.cover_url} alt="" className="size-full object-cover"/>
                : <category.icon className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2" style={{color: category.accent}}/>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", post.status === "published"
                  ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-white/5 text-slate-300 ring-white/10")}>
                  {post.status === "published" ? "Megjelent" : "Piszkozat"}
                </span>
                <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", category.chip)}><category.icon className="size-3"/> {category.label}</span>
                {post.featured && <span className="rounded-md bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-black">Kiemelt</span>}
              </div>
              <p className="mt-1 truncate font-semibold text-white">{post.title}</p>
              <p className="text-xs text-slate-500">
                {post.status === "published" ? `Megjelent ${articleDate(post.published_at)}` : `Módosítva ${formatAgo(post.updated_at)}`}
                {post.author ? ` · ${post.author}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {post.status === "published" && <Button variant="ghost" size="icon" asChild aria-label="Megnyitás"><a href={`/news/${post.slug}`} target="_blank" rel="noreferrer"><Eye/></a></Button>}
              <Button variant="outline" asChild><Link to={`/sib/news/${post.id}`}><PenSquare/> Szerkesztés</Link></Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// --- The front page's sections ---------------------------------------------------------------

function Section({title, hint, updated, children, onSave, saving}: {
  title: string; hint?: string; updated?: {at: string; by: string | null}; children: ReactNode; onSave: () => void; saving: boolean;
}) {
  return (
    <section className="panel space-y-4 p-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {updated && (
          <span className="text-[11px] text-slate-500" title={formatDateTime(updated.at)}>
            {updated.by ? `Módosította ${updated.by}, ${formatAgo(updated.at)}` : `Módosítva ${formatAgo(updated.at)}`}
          </span>
        )}
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
      </header>
      {children}
    </section>
  );
}

function Field({label, value, onChange, multiline, placeholder, max = 400}: {
  label: string; value: string | undefined; onChange: (value: string) => void; multiline?: boolean; placeholder?: string; max?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      {multiline
        ? <Textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} rows={3} maxLength={max} placeholder={placeholder}/>
        : <Input value={value ?? ""} onChange={(event) => onChange(event.target.value)} maxLength={max} placeholder={placeholder}/>}
    </label>
  );
}

/** A list of rows that can be added, removed and moved. */
function ListEditor<T>({items, onChange, create, render, addLabel}: {
  items: T[]; onChange: (items: T[]) => void; create: () => T; render: (item: T, update: (item: T) => void) => ReactNode; addLabel: string;
}) {
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex min-w-0 items-start gap-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.06]">
          <div className="min-w-0 flex-1">{render(item, (next) => onChange(items.map((current, i) => (i === index ? next : current))))}</div>
          <div className="flex flex-col gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Feljebb" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp/></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Lejjebb" disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown/></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Törlés" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2/></Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...items, create()])}><Plus/> {addLabel}</Button>
    </div>
  );
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function ContentEditor({data, onSaved}: {data: SiteEditor; onSaved: () => void}) {
  const [content, setContent] = useState<SiteContent>(data.content);
  const [saving, setSaving] = useState<keyof SiteContent | null>(null);

  const save = async (key: keyof SiteContent) => {
    setSaving(key);
    try {
      await siteApi.saveContent(key, content[key] ?? null);
      siteApi.forget();
      toast.success("Mentve: a főoldal frissült.");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(null);
    }
  };
  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => setContent((current) => ({...current, [key]: value}));

  const hero = content.hero ?? {};
  const about = content.about ?? {};
  const recruitment = content.recruitment ?? {};
  const sections = content.sections ?? {};
  const contact = content.contact ?? {};

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Section title="Nyitókép" hint="A főoldal első képernyője." updated={data.updated.hero} saving={saving === "hero"} onSave={() => void save("hero")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Felirat a cím fölött" value={hero.eyebrow} onChange={(value) => set("hero", {...hero, eyebrow: value})} max={80}/>
          <Field label="Cím" value={hero.title} onChange={(value) => set("hero", {...hero, title: value})} max={80}/>
          <Field label="Arany sor (mondatonként új sor)" value={hero.highlight} onChange={(value) => set("hero", {...hero, highlight: value})} max={80}/>
          <Field label="Fő gomb" value={hero.primary} onChange={(value) => set("hero", {...hero, primary: value})} max={40}/>
        </div>
        <Field label="Alcím" value={hero.subtitle} onChange={(value) => set("hero", {...hero, subtitle: value})} multiline max={400}/>
      </Section>

      <Section title="Rólunk" updated={data.updated.about} saving={saving === "about"} onSave={() => void save("about")}>
        <Field label="Kiemelt mondat" value={about.lead} onChange={(value) => set("about", {...about, lead: value})} multiline max={400}/>
        <Field label="Szöveg" value={about.text} onChange={(value) => set("about", {...about, text: value})} multiline max={1500}/>
      </Section>

      <Section title="Osztályok" hint="A három osztály kártyája." updated={data.updated.divisions} saving={saving === "divisions"} onSave={() => void save("divisions")}>
        {(["TSB", "SEB", "MCB"] as const).map((code) => {
          const division = content.divisions?.[code] ?? {};
          const update = (next: typeof division) => set("divisions", {...content.divisions, [code]: next});
          return (
            <div key={code} className="space-y-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.06]">
              <p className="text-xs font-semibold tracking-wider text-amber-300 uppercase">{code}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Név" value={division.name} onChange={(value) => update({...division, name: value})} max={80}/>
                <Field label="Alcím" value={division.subtitle} onChange={(value) => update({...division, subtitle: value})} max={60}/>
              </div>
              <Field label="Leírás" value={division.text} onChange={(value) => update({...division, text: value})} multiline max={400}/>
            </div>
          );
        })}
      </Section>

      <Section title="Egységek és irodák" updated={data.updated.units} saving={saving === "units"} onSave={() => void save("units")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {UNIT_ORDER.map((key) => {
            const unit = content.units?.[key] ?? {};
            const update = (next: typeof unit) => set("units", {...content.units, [key]: next});
            return (
              <div key={key} className="space-y-2 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.06]">
                <p className="text-xs font-semibold tracking-wider text-amber-300 uppercase">{key}</p>
                <Field label="Név" value={unit.name} onChange={(value) => update({...unit, name: value})} max={80}/>
                <Field label="Leírás" value={unit.text} onChange={(value) => update({...unit, text: value})} multiline max={300}/>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Toborzás" hint="Feltételek és a felvétel lépései." updated={data.updated.recruitment} saving={saving === "recruitment"} onSave={() => void save("recruitment")}>
        <Field label="Cím" value={recruitment.title} onChange={(value) => set("recruitment", {...recruitment, title: value})} max={80}/>
        <Field label="Szöveg" value={recruitment.text} onChange={(value) => set("recruitment", {...recruitment, text: value})} multiline max={600}/>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">Feltételek</Label>
          <ListEditor items={recruitment.requirements ?? []} onChange={(items) => set("recruitment", {...recruitment, requirements: items})}
                      create={() => ""} addLabel="Új feltétel"
                      render={(item, update) => <Input value={item} onChange={(event) => update(event.target.value)} maxLength={160}/>}/>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-400">A felvétel lépései</Label>
          <ListEditor items={recruitment.steps ?? []} onChange={(items) => set("recruitment", {...recruitment, steps: items})}
                      create={() => ({title: "", text: ""})} addLabel="Új lépés"
                      render={(item, update) => (
                        <div className="grid gap-2">
                          <Input value={item.title} onChange={(event) => update({...item, title: event.target.value})} placeholder="Lépés" maxLength={60}/>
                          <Input value={item.text} onChange={(event) => update({...item, text: event.target.value})} placeholder="Egy mondat róla" maxLength={200}/>
                        </div>
                      )}/>
        </div>
        <Field label="Felvételi vizsga (a nyilvános vizsga linkje vagy azonosítója; üresen nem látszik)" value={recruitment.exam_id ?? ""}
               onChange={(value) => set("recruitment", {...recruitment, exam_id: value.match(UUID)?.[0] ?? (value.trim() ? value.trim() : null)})} max={200}/>
      </Section>

      <Section title="Gyakori kérdések" updated={data.updated.faq} saving={saving === "faq"} onSave={() => void save("faq")}>
        <ListEditor items={content.faq ?? []} onChange={(items) => set("faq", items)} create={() => ({q: "", a: ""})} addLabel="Új kérdés"
                    render={(item, update) => (
                      <div className="grid gap-2">
                        <Input value={item.q} onChange={(event) => update({...item, q: event.target.value})} placeholder="Kérdés" maxLength={160}/>
                        <Textarea value={item.a} onChange={(event) => update({...item, a: event.target.value})} placeholder="Válasz" rows={2} maxLength={800}/>
                      </div>
                    )}/>
      </Section>

      <Section title="Értékek" hint="A három nagy szó és a magyarázatuk." updated={data.updated.values} saving={saving === "values"} onSave={() => void save("values")}>
        <ListEditor items={content.values ?? []} onChange={(items) => set("values", items)} create={() => ({title: "", text: ""})} addLabel="Új érték"
                    render={(item, update) => (
                      <div className="grid gap-2">
                        <Input value={item.title} onChange={(event) => update({...item, title: event.target.value})} placeholder="pl. Integrity" maxLength={24}/>
                        <Input value={item.text} onChange={(event) => update({...item, text: event.target.value})} placeholder="Egy mondat" maxLength={200}/>
                      </div>
                    )}/>
      </Section>

      <Section title="Elérhetőség" hint="A lábléc linkjei (pl. Discord, fórum)." updated={data.updated.contact} saving={saving === "contact"} onSave={() => void save("contact")}>
        <ListEditor items={contact.links ?? []} onChange={(items) => set("contact", {...contact, links: items})} create={() => ({label: "", url: "https://"})} addLabel="Új link"
                    render={(item, update) => (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={item.label} onChange={(event) => update({...item, label: event.target.value})} placeholder="Felirat" maxLength={60}/>
                        <Input value={item.url} onChange={(event) => update({...item, url: event.target.value})} placeholder="https://…" maxLength={300} className="font-mono text-xs"/>
                      </div>
                    )}/>
      </Section>

      <Section title="Megjelenő részek" hint="Ami kikapcsolt, az nem látszik a főoldalon." updated={data.updated.sections} saving={saving === "sections"} onSave={() => void save("sections")}>
        {([["stats", "Számok (tagok, nyomozások, intézkedések, szolgálati órák)"], ["leadership", "A vezetés névsora"], ["values", "Értékek"],
          ["gallery", "Galéria"], ["faq", "Gyakori kérdések"]] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-200">
            {label}
            <Switch checked={sections[key] !== false} onCheckedChange={(value) => set("sections", {...sections, [key]: value})}/>
          </label>
        ))}
      </Section>

      <Section title="A vezetés a főoldalon" hint="Akit kikapcsolsz, az nem szerepel a nyilvános névsorban (a rangja nem változik)."
               updated={data.updated.leadership} saving={saving === "leadership"} onSave={() => void save("leadership")}>
        {data.leaders.length === 0 ? <p className="text-xs text-slate-500">Nincs megjeleníthető vezető.</p> : (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {data.leaders.map((leader) => {
              const hidden = new Set(content.leadership?.hidden ?? []);
              const shown = !hidden.has(leader.id);
              return (
                <li key={leader.id}>
                  <label className={cn("flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]", !shown && "opacity-50")}>
                    {leader.avatar_url ? (
                      <img src={getOptimizedImageUrl(leader.avatar_url, 64) || leader.avatar_url} alt="" className="size-8 shrink-0 rounded-full object-cover"/>
                    ) : (
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/5 text-[11px] font-semibold text-slate-300">
                        {leader.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-100">{leader.full_name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{leader.faction_rank}</span>
                    </span>
                    <Switch checked={shown} aria-label={`${leader.full_name} a főoldalon`} onCheckedChange={(value) => {
                      const next = new Set(hidden);
                      if (value) next.delete(leader.id);
                      else next.add(leader.id);
                      set("leadership", {hidden: [...next]});
                    }}/>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

// --- Gallery -------------------------------------------------------------------------------

function GalleryEditor({initial, onSaved}: {initial: {url: string; caption?: string}[]; onSaved: () => void}) {
  const [items, setItems] = useState(initial);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files].filter((file) => file.type.startsWith("image/"));
    setUploading(list.length);
    for (const file of list) {
      try {
        const url = await uploadToCloudinary(file, "site");
        setItems((current) => [...current, {url, caption: ""}]);
      } catch (error) {
        toast.error(errorMessage(error, "Egy kép feltöltése nem sikerült."));
      } finally {
        setUploading((count) => count - 1);
      }
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await siteApi.saveContent("gallery", items.map((item) => ({url: item.url, caption: item.caption?.trim() || undefined})));
      siteApi.forget();
      toast.success("A galéria mentve.");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => input.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? <Loader2 className="animate-spin"/> : <ImagePlus/>} Képek feltöltése
        </Button>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void upload(event.target.files)}/>
        <p className="text-xs text-slate-500">A képek tömörítve kerülnek fel; a főoldalon méretre szabva jelennek meg.</p>
        <Button className="ml-auto" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
      </div>
      {items.length === 0 ? (
        <div className="panel"><EmptyState icon={ImagePlus} title="Még nincs kép a galériában" description="Akciók, gyűlések, közös pillanatok: a főoldal galériájában jelennek meg."/></div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.url} className="panel overflow-hidden p-0">
              <img src={getOptimizedImageUrl(item.url, 600) || item.url} alt="" className="aspect-[4/3] w-full object-cover"/>
              <div className="flex items-center gap-2 p-3">
                <Input value={item.caption ?? ""} onChange={(event) => setItems(items.map((current, i) => (i === index ? {...current, caption: event.target.value} : current)))}
                       placeholder="Képaláírás (nem kötelező)" maxLength={160}/>
                <Button size="icon-sm" variant="ghost" aria-label="Feljebb" disabled={index === 0}
                        onClick={() => setItems((current) => {
                          const next = [...current];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        })}><ArrowUp/></Button>
                <Button size="icon-sm" variant="ghost" aria-label="Törlés" onClick={() => setItems(items.filter((_, i) => i !== index))}><Trash2/></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
