import {useEffect, useState} from "react";
import {toast} from "sonner";
import {Eye, EyeOff, Loader2} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {formatDateTime} from "@/lib/datetime";
import {mailApi, type MailReceipts} from "@/lib/mail";
import {errorMessage} from "@/lib/utils";

/** Who has opened a letter (its writers see it; on letters to all@ the offices too). */
export function ReceiptsDialog({threadId, subject, onClose}: {threadId: string; subject: string; onClose: () => void}) {
  const [data, setData] = useState<MailReceipts | null>(null);

  useEffect(() => {
    let active = true;
    mailApi.receipts(threadId).then((value) => active && setData(value), (error) => {
      toast.error(errorMessage(error, "Az olvasottság nem tölthető be."));
      onClose();
    });
    return () => {
      active = false;
    };
  }, [threadId, onClose]);

  const read = data?.readers.filter((reader) => reader.read_at) ?? [];
  const unread = data?.readers.filter((reader) => !reader.read_at) ?? [];
  const ratio = data && data.total > 0 ? Math.round((data.read / data.total) * 100) : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Olvasottság</DialogTitle>
          <DialogDescription className="wrap-anywhere">{subject}</DialogDescription>
        </DialogHeader>
        {!data ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-slate-500"/></div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-300">{data.read} / {data.total} olvasó megnyitotta</span>
                <span className="font-semibold text-indigo-200 tabular-nums">{ratio}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${ratio}% megnyitotta`}>
                <div className="h-full rounded-full bg-indigo-400 transition-[width] duration-700" style={{width: `${ratio}%`}}/>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([["Megnyitotta", read, Eye, "text-emerald-300"], ["Még nem nyitotta meg", unread, EyeOff, "text-slate-400"]] as const)
                .map(([label, people, Icon, tone]) => (
                  <section key={label} className="min-w-0 space-y-2">
                    <h3 className={`flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase ${tone}`}>
                      <Icon className="size-3.5"/> {label} ({people.length})
                    </h3>
                    {people.length === 0 ? <p className="text-xs text-slate-600">–</p> : (
                      <ul className="space-y-1.5">
                        {people.map((person) => (
                          <li key={person.user_id} className="flex min-w-0 items-center gap-2">
                            <MemberAvatar name={person.full_name} avatarUrl={person.avatar_url} size={26}/>
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-slate-200">{person.full_name}</span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {person.read_at ? formatDateTime(person.read_at) : person.faction_rank}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
