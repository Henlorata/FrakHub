import {useNavigate} from "react-router";
import {Sparkles, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {LATEST_RELEASE} from "@/data/changelog";
import {markChangelogSeen, useChangelogUnseen} from "@/lib/changelog";

/** The latest release notes in one line, until the member opens or dismisses them. */
export function WhatsNewStrip() {
  const navigate = useNavigate();
  const unseen = useChangelogUnseen();
  if (!unseen) return null;
  return (
    <section data-tour="whats-new" aria-label="Újdonságok"
             className="panel animate-rise flex min-w-0 items-center gap-3 py-2.5 pr-2 pl-4 ring-1 ring-primary/25 shadow-[0_0_36px_-18px_rgb(234_179_8/0.7)]">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25"><Sparkles className="size-4"/></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">Újdonságok: {LATEST_RELEASE.title}</p>
        <p className="truncate text-xs text-slate-400">{LATEST_RELEASE.summary}</p>
      </div>
      <Button size="sm" onClick={() => {
        markChangelogSeen();
        navigate("/changelog");
      }}>Megnézem</Button>
      <Button size="icon-sm" variant="ghost" aria-label="Elrejtés" onClick={markChangelogSeen} className="text-slate-400"><X/></Button>
    </section>
  );
}
