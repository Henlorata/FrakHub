// FrakHub/src/pages/mcb/components/CaseEvidenceTab.tsx
// (JAVÍTVA: A feltöltési útvonal (filePath) egyszerűsítve)

import * as React from "react";
import {useParams} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {Loader2, Upload, AlertTriangle, Image as ImageIcon, Trash2, Search} from "lucide-react";
import {toast} from "sonner";
import type {CaseEvidence} from "@/types/supabase";

// Lokális típus kiterjesztése az aláírt URL-lel
type EvidenceWithUrl = CaseEvidence & { signedUrl: string };

export function CaseEvidenceTab() {
  const {caseId} = useParams<{ caseId: string }>();
  const {supabase, profile} = useAuth();

  const [evidence, setEvidence] = React.useState<EvidenceWithUrl[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedImage, setSelectedImage] = React.useState<EvidenceWithUrl | null>(null);
  const [isImageOpen, setIsImageOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = React.useState<File | null>(null);
  const [description, setDescription] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Bizonyítékok lekérése (Aláírt URL-ekkel)
  const fetchEvidence = React.useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    const {data, error} = await supabase
      .from("case_evidence")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", {ascending: false});

    if (error) {
      setError(error.message);
      toast.error("Hiba a bizonyítékok lekérésekor", {description: error.message});
      setIsLoading(false);
      return;
    }

    // --- FIGYELEM: Ha a lekérés hibát dob, az RLS SELECT policy is hiányzik! ---
    const evidenceWithUrls = await Promise.all(
      data.map(async (item) => {
        const {data: urlData, error: urlError} = await supabase.storage
          .from("case_evidence")
          .createSignedUrl(item.file_path, 3600); // 1 óráig érvényes

        if (urlError) {
          console.error("Signed URL hiba:", urlError.message, "Path:", item.file_path);
          return {...item, signedUrl: ""};
        }
        return {...item, signedUrl: urlData.signedUrl};
      })
    );

    setEvidence(evidenceWithUrls);
    setIsLoading(false);
  }, [caseId, supabase]);

  React.useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileToUpload(e.target.files[0]);
    }
  };

  // Feltöltés (JAVÍTVA)
  const handleUpload = async () => {
    if (!fileToUpload || !caseId || !profile) {
      toast.error("Nincs fájl kiválasztva vagy akta azonosító hiányzik.");
      return;
    }
    if (!fileToUpload.type.startsWith("image/")) {
      toast.error("Csak képfájlok tölthetők fel.");
      return;
    }
    setIsUploading(true);
    const fileExt = fileToUpload.name.split('.').pop();
    const uniqueFileName = `${Date.now()}.${fileExt}`;

    // --- JAVÍTÁS ITT ---
    // Az elérési út most már csak: {caseId}/{fileName}
    // A profile.id-t eltávolítottuk az útvonalból.
    const filePath = `${caseId}/${uniqueFileName}`;
    // --- JAVÍTÁS VÉGE ---

    const {error: uploadError} = await supabase.storage
      .from("case_evidence")
      .upload(filePath, fileToUpload);

    if (uploadError) {
      toast.error("Hiba a fájl feltöltésekor", {description: uploadError.message});
      setIsUploading(false);
      return;
    }

    // Az adatbázisba mentés változatlan, az tárolja a user_id-t
    const {error: dbError} = await supabase
      .from("case_evidence")
      .insert({
        case_id: caseId,
        user_id: profile.id,
        file_path: filePath, // Itt már az új, egyszerűsített útvonalat mentjük
        file_name: fileToUpload.name,
        file_type: fileToUpload.type,
        description: description || null,
      });

    setIsUploading(false);
    if (dbError) {
      toast.error("Hiba az adatbázis-bejegyzés mentésekor", {description: dbError.message});
      // Sikertelen DB mentés esetén töröljük a feltöltött fájlt
      await supabase.storage.from("case_evidence").remove([filePath]);
    } else {
      toast.success("Bizonyíték sikeresen feltöltve!");
      setFileToUpload(null);
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchEvidence(); // Frissítjük a listát
    }
  };

  // Törlés (Változatlan)
  const handleDelete = async (item: EvidenceWithUrl) => {
    setIsDeleting(item.id);
    const {error: storageError} = await supabase.storage
      .from("case_evidence")
      .remove([item.file_path]);
    if (storageError) {
      toast.error("Hiba a fájl törlésekor a tárolóból", {description: storageError.message});
      setIsDeleting(null);
      return;
    }
    const {error: dbError} = await supabase
      .from("case_evidence")
      .delete()
      .eq("id", item.id);
    setIsDeleting(null);
    if (dbError) {
      toast.error("Hiba az adatbázis-bejegyzés törlésekor", {description: dbError.message});
    } else {
      toast.success("Bizonyíték törölve.");
      fetchEvidence();
    }
  };

  // Kép megnyitása (Változatlan)
  const openImage = (item: EvidenceWithUrl) => {
    setSelectedImage(item);
    setIsImageOpen(true);
  };

  // Tartalom renderelése (Grid) (Változatlan)
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-slate-400"/>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-red-400">
          <AlertTriangle className="h-12 w-12"/>
          <p className="mt-4 text-lg font-semibold">Hiba történt</p>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      );
    }
    if (evidence.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Search className="h-12 w-12"/>
          <p className="mt-4 text-lg font-semibold">Nincsenek bizonyítékok</p>
          <p className="text-sm">Ehhez az aktához még nem töltöttek fel bizonyítékot.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {evidence.map((item) => {
          return (
            <div key={item.id}
                 className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-square">
              {item.signedUrl ? (
                <img
                  src={item.signedUrl}
                  alt={item.description || item.file_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-red-400"/>
                </div>
              )}
              <div
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => item.signedUrl && openImage(item)}
              >
                <ImageIcon className="w-10 h-10 text-white"/>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(item)}
                disabled={isDeleting === item.id}
                title="Bizonyíték törlése"
              >
                {isDeleting === item.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
              </Button>
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-white text-xs font-medium truncate" title={item.file_name}>{item.file_name}</p>
                <p className="text-slate-300 text-xs truncate" title={item.description || ""}>{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- HTML (Változatlan) ---
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
      <div className="lg:col-span-1 lg:sticky lg:top-[5.5rem] space-y-6">
        <Card className="bg-slate-900 border-slate-700 text-white">
          <CardHeader className="p-6">
            <CardTitle>Bizonyíték feltöltése</CardTitle>
            <CardDescription>Csak képfájlok (JPG, PNG, GIF) tölthetők fel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="text-slate-300 file:text-white file:bg-slate-700 file:hover:bg-slate-600 file:rounded-md file:mr-4"
            />
            <Input
              placeholder="Leírás (opcionális)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button onClick={handleUpload} disabled={isUploading || !fileToUpload}>
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
              ) : (
                <Upload className="w-4 h-4 mr-2"/>
              )}
              {isUploading ? "Feltöltés..." : "Feltöltés"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-slate-900 border-slate-700 text-white flex-1 flex flex-col min-h-0">
          <CardHeader className="p-6">
            <CardTitle>Feltöltött Bizonyítékok</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {renderContent()}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
        <DialogContent
          className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-[95vw] h-[95vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle>{selectedImage?.file_name}</DialogTitle>
            <DialogDescription>{selectedImage?.description || "Nincs leírás."}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <img
              src={selectedImage?.signedUrl}
              alt={selectedImage?.description || selectedImage?.file_name || "Bizonyíték"}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <DialogFooter className="pt-6">
            <DialogClose asChild>
              <Button variant="outline">Bezárás</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}