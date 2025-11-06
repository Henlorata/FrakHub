import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Loader2} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {toast} from "sonner";
import type {Case} from "@/types/supabase";
import type {PartialBlock} from "@blocknote/core";

interface NewCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaseCreated: (newCase: Case) => void;
}

export function NewCaseDialog({open, onOpenChange, onCaseCreated}: NewCaseDialogProps) {
  const {profile, supabase} = useAuth();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async () => {
    if (!profile || !title.trim()) {
      toast.error("Hiba", {description: "Az akta címe kötelező."});
      return;
    }

    setIsLoading(true);

    // --- Ez a helyes, FÜGGŐLEGES elrendezésű séma ---
    const defaultBody: PartialBlock[] = [
      {
        type: "image",
        props: {
          url: "/mcb_logo.png", // Feltételezve, hogy a 'public/mcb_logo.png' létezik
          textAlignment: "center",
        },
      },
      {
        type: "heading",
        props: {
          level: 1, // 'level' a 'props'-on belül
          textAlignment: "center",
        },
        content: [
          {
            type: "text",
            text: "Major Crime's Bureau",
            styles: {},
          },
        ],
      },
      {
        type: "heading",
        props: {
          level: 3, // 'level' a 'props'-on belül
          textAlignment: "center",
        },
        content: [
          {
            type: "text",
            text: "Detective Division",
            styles: {},
          },
        ],
      },
      {
        type: "paragraph",
        props: {
          textAlignment: "center",
        },
        content: [
          {
            type: "text",
            text: "Cím: San Fierro, Downtown 1257",
            styles: { italic: true },
          },
        ],
      },
      {
        type: "divider", // 'horizontalRule' helyett 'divider'
      },
      {
        type: "paragraph",
        content: [], // Üres bekezdés
      },
    ];
    // --- Kód vége ---

    const {data, error} = await supabase
      .from("cases")
      .insert({
        title: title.trim(),
        short_description: description.trim() || null,
        owner_id: profile.id,
        status: "open",
        body: defaultBody,
      })
      .select()
      .single();

    setIsLoading(false);

    if (error) {
      toast.error("Hiba történt az akta létrehozásakor", {
        description: error.message,
      });
    } else {
      toast.success("Akta sikeresen létrehozva", {
        description: `#${data.case_number} - ${data.title}`,
      });
      onCaseCreated(data);
      setTitle("");
      setDescription("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Új Akta Létrehozása</DialogTitle>
          <DialogDescription>
            Add meg az új nyomozati akta alapadatait. A részleteket később
            szerkesztheted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="title">Akta Címe</label>
            <Input
              id="title"
              placeholder="pl. A 'Kígyó' fedőnevű díler"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description">Rövid leírás (Opcionális)</label>
            <Textarea
              id="description"
              placeholder="Rövid összefoglaló az aktáról..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Mégse
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || !title.trim()}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Létrehozás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}