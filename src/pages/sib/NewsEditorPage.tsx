import {lazy, Suspense, useCallback, useEffect, useRef, useState} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {toast} from "sonner";
import {ArrowLeft, Eye, ImagePlus, Loader2, Megaphone, Save, Send, Trash2, Undo2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {useConfirm} from "@/components/ConfirmDialog";
import {getOptimizedImageUrl, uploadToCloudinary} from "@/lib/cloudinary";
import {countInlineImages, uploadInlineImages} from "@/lib/inline-images";
import {NEWS_CATEGORIES, siteApi, type NewsCategory} from "@/lib/site";
import {cn, errorMessage} from "@/lib/utils";

const NewsDocumentEditor = lazy(() => import("./NewsDocumentEditor"));

interface Draft {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  body: unknown[];
  cover_url: string | null;
  category: NewsCategory;
  featured: boolean;
  author_display: string;
  status: "draft" | "published";
}

const EMPTY: Draft = {id: null, slug: "", title: "", excerpt: "", body: [], cover_url: null, category: "news", featured: false, author_display: "", status: "draft"};

/** One article on the SIB's desk: text with pictures, cover, category, then publishing. */
export function NewsEditorPage() {
  const {postId = "new"} = useParams<{postId: string}>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(postId === "new" ? EMPTY : null);
  const [initialBody, setInitialBody] = useState<unknown[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | "cover" | "delete" | null>(null);
  const [notify, setNotify] = useState(true);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (postId === "new") return;
    let active = true;
    siteApi.post(postId).then((post) => {
      if (!active) return;
      if (!post) {
        toast.error("A hír nem található.");
        navigate("/sib", {replace: true});
        return;
      }
      setDraft({
        id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt ?? "", body: post.body ?? [], cover_url: post.cover_url,
        category: post.category, featured: post.featured, author_display: post.author_display_raw ?? "", status: post.status,
      });
      setInitialBody(post.body ?? []);
    }, (error) => toast.error(errorMessage(error, "A hír nem tölthető be.")));
    return () => {
      active = false;
    };
  }, [postId, navigate]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (next: Partial<Draft>) => {
    setDraft((current) => (current ? {...current, ...next} : current));
    setDirty(true);
  };
  const onBody = useCallback((body: unknown[]) => {
    setDraft((current) => (current ? {...current, body} : current));
    setDirty(true);
  }, []);

  const save = async (): Promise<Draft | null> => {
    if (!draft) return null;
    if (draft.title.trim().length < 3) {
      toast.error("Adj címet a hírnek (legalább 3 karakter).");
      return null;
    }
    let body = draft.body;
    if (countInlineImages(body) > 0) body = (await uploadInlineImages(body, "news")).content;
    const saved = await siteApi.savePost({
      id: draft.id, title: draft.title.trim(), excerpt: draft.excerpt.trim() || null, body, cover_url: draft.cover_url, category: draft.category,
      featured: draft.featured, author_display: draft.author_display.trim() || null, slug: draft.slug.trim() || null,
    });
    const next = {...draft, id: saved.id, slug: saved.slug, body};
    setDraft(next);
    setDirty(false);
    siteApi.forget();
    if (!draft.id) navigate(`/sib/news/${saved.id}`, {replace: true});
    return next;
  };

  const run = async (kind: "save" | "publish", action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error, "A művelet nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const publish = (on: boolean) => run("publish", async () => {
    const saved = await save();
    if (!saved?.id) return;
    await siteApi.publish(saved.id, on, on && notify);
    setDraft({...saved, status: on ? "published" : "draft"});
    siteApi.forget();
    toast.success(on ? "A hír megjelent a nyilvános oldalon." : "A hír visszakerült a piszkozatok közé.");
  });

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setBusy("cover");
    try {
      const url = await uploadToCloudinary(file, "news");
      patch({cover_url: url});
    } catch (error) {
      toast.error(errorMessage(error, "A kép feltöltése nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    if (!(await confirm({title: "Törlöd a hírt?", description: "A cikk végleg törlődik, a nyilvános oldalról is eltűnik.", confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    setBusy("delete");
    try {
      await siteApi.remove(draft.id);
      siteApi.forget();
      toast.success("Hír törölve.");
      navigate("/sib");
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
      setBusy(null);
    }
  };

  if (!draft) return <div className="flex justify-center py-24"><Loader2 className="size-8 animate-spin text-slate-500"/></div>;

  const category = NEWS_CATEGORIES[draft.category];
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" asChild><Link to="/sib"><ArrowLeft/> Sajtóiroda</Link></Button>
        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1", draft.status === "published"
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-white/5 text-slate-300 ring-white/10")}>
          {draft.status === "published" ? "Megjelent" : "Piszkozat"}
        </span>
        {dirty && <span className="text-xs text-amber-300">Mentetlen módosítás</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {draft.id && (
            <Button variant="outline" asChild><a href={`/news/${draft.slug}`} target="_blank" rel="noreferrer"><Eye/> Előnézet</a></Button>
          )}
          <Button variant="outline" disabled={!!busy} onClick={() => void run("save", async () => {
            if (await save()) toast.success("Mentve.");
          })}>{busy === "save" ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
          {draft.status === "published" ? (
            <Button variant="outline" disabled={!!busy} onClick={() => void publish(false)}><Undo2/> Visszavonás</Button>
          ) : (
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={!!busy} onClick={() => void publish(true)}>
              {busy === "publish" ? <Loader2 className="animate-spin"/> : <Send/>} Közzététel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <input value={draft.title} onChange={(event) => patch({title: event.target.value})} maxLength={160} placeholder="A hír címe"
                 aria-label="Cím"
                 className="w-full bg-transparent text-3xl font-bold tracking-tight text-white outline-none placeholder:text-slate-600 sm:text-4xl"/>
          <Textarea value={draft.excerpt} onChange={(event) => patch({excerpt: event.target.value})} maxLength={400} rows={2}
                    placeholder="Bevezető: egy-két mondat, ez látszik a kártyákon és a cikk tetején." className="text-base"/>
          <Suspense fallback={<div className="skeleton h-[460px] rounded-xl"/>}>
            <NewsDocumentEditor key={draft.id ?? "new"} initial={initialBody} onChange={onBody}/>
          </Suspense>
        </section>

        <aside className="space-y-4">
          <div className="panel space-y-3 p-4">
            <Label className="text-xs text-slate-400">Borítókép</Label>
            {draft.cover_url ? (
              <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10">
                <img src={getOptimizedImageUrl(draft.cover_url, 720) || draft.cover_url} alt="" className="aspect-[16/9] w-full object-cover"/>
                <button type="button" aria-label="Borítókép eltávolítása" onClick={() => patch({cover_url: null})}
                        className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/20 hover:bg-black/90"><X className="size-4"/></button>
              </div>
            ) : (
              <button type="button" onClick={() => coverInput.current?.click()} disabled={busy === "cover"}
                      className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 text-sm text-slate-400 transition hover:border-amber-400/50 hover:text-slate-200">
                {busy === "cover" ? <Loader2 className="size-6 animate-spin"/> : <ImagePlus className="size-6 text-amber-300"/>}
                Kép feltöltése
              </button>
            )}
            <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadCover(event.target.files?.[0])}/>
            <p className="text-[11px] text-slate-500">Fekvő kép a legszebb (16:9). Kép nélkül a kategória rajzolt borítója jelenik meg.</p>
          </div>

          <div className="panel space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Kategória</Label>
              <Select value={draft.category} onValueChange={(value) => patch({category: value as NewsCategory})}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {(Object.keys(NEWS_CATEGORIES) as NewsCategory[]).map((key) => {
                    const meta = NEWS_CATEGORIES[key];
                    return <SelectItem key={key} value={key}><meta.icon className="size-3.5"/> {meta.label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              <span>Kiemelt hír<span className="block text-[11px] text-slate-500">A főoldal első helyére kerül.</span></span>
              <Switch checked={draft.featured} onCheckedChange={(value) => patch({featured: value})}/>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="news-author" className="text-xs text-slate-400">Aláírás a cikk alatt</Label>
              <Input id="news-author" value={draft.author_display} onChange={(event) => patch({author_display: event.target.value})} maxLength={120}
                     placeholder="Sheriff's Information Bureau"/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="news-slug" className="text-xs text-slate-400">Cím a böngészőben</Label>
              <div className="flex items-center gap-1 rounded-md border border-input px-2 font-mono text-xs text-slate-500">
                /news/<input id="news-slug" value={draft.slug} onChange={(event) => patch({slug: event.target.value})} maxLength={90}
                             placeholder="a címből készül" className="h-9 min-w-0 flex-1 bg-transparent text-slate-200 outline-none"/>
              </div>
            </div>
          </div>

          {draft.status !== "published" && (
            <label className="panel flex items-start gap-3 p-4 text-sm text-slate-200">
              <Switch checked={notify} onCheckedChange={setNotify} className="mt-0.5"/>
              <span><Megaphone className="mr-1 inline size-3.5 text-amber-300"/> Értesítés a tagoknak közzétételkor
                <span className="block text-[11px] text-slate-500">Mindenki kap egy értesítést a hírről (hirdetmény kategória).</span></span>
            </label>
          )}

          <div className={cn("rounded-xl p-4 text-xs ring-1", category.chip)}>
            <p className="flex items-center gap-1.5 font-semibold"><category.icon className="size-3.5"/> {category.label}</p>
            <p className="mt-1 opacity-80">A kategória színe a kártyákon, a hírszalagon és a cikk tetején jelenik meg.</p>
          </div>

          {draft.id && (
            <Button variant="ghost" className="w-full text-red-300 hover:text-red-200" disabled={!!busy} onClick={() => void remove()}>
              {busy === "delete" ? <Loader2 className="animate-spin"/> : <Trash2/>} Hír törlése
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
