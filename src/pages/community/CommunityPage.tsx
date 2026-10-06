import {useSearchParams} from "react-router";
import {Lightbulb, MessageSquareLock, UsersRound, Vote} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {cn} from "@/lib/utils";
import {PollsTab} from "./PollsTab";
import {IdeasTab} from "./IdeasTab";
import {FeedbackTab} from "./FeedbackTab";

type Tab = "polls" | "ideas" | "feedback";
const TABS: {id: Tab; label: string; icon: typeof Vote}[] = [
  {id: "polls", label: "Szavazások", icon: Vote},
  {id: "ideas", label: "Ötletláda", icon: Lightbulb},
  {id: "feedback", label: "Névtelen visszajelzés", icon: MessageSquareLock},
];

/** The members' voice: polls, the suggestion board and anonymous feedback to the leadership. */
export function CommunityPage() {
  const {profile} = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = TABS.some((entry) => entry.id === requested) ? requested! : "polls";
  if (!profile) return null;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <PageHeader icon={UsersRound} tone="violet" eyebrow="Szavazás · Ötletek · Visszajelzés" title="Közösség"
                  description="Szavazások, ötletek és névtelen visszajelzés: a tagok hangja a vezetőség felé."/>
      <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b" role="tablist" data-tour="community-tabs">
        {TABS.map((entry) => (
          <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id}
                  onClick={() => setParams(entry.id === "polls" ? {} : {tab: entry.id})}
                  className={cn("relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    tab === entry.id ? "text-white" : "text-slate-400 hover:text-slate-200")}>
            <entry.icon className={cn("size-4", tab === entry.id && "text-primary")}/>{entry.label}
            {tab === entry.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary shadow-[0_0_10px_rgb(234_179_8/0.8)]"/>}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade">
        {tab === "polls" ? <PollsTab profile={profile} focusId={params.get("id")}/>
          : tab === "ideas" ? <IdeasTab profile={profile}/>
            : <FeedbackTab profile={profile} initialView={params.get("box") === "mine" ? "mine" : params.get("box") === "inbox" ? "inbox" : null}/>}
      </div>
    </div>
  );
}
