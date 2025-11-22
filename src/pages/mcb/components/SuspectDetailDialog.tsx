import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Car, Home, Plus, X, History, FileText, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import type { Suspect, SuspectVehicle, SuspectProperty, SuspectAssociate } from "@/types/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import {canViewCaseDetails, cn} from "@/lib/utils.ts"; // Ha át akarunk ugrani az aktára

interface SuspectDetailDialogProps {
  suspect: Suspect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function SuspectDetailDialog({ suspect, open, onOpenChange, onUpdate }: SuspectDetailDialogProps) {
  const { supabase, profile } = useAuth();
  const navigate = useNavigate(); // Navigációhoz
  const [loading, setLoading] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("details");

  // Adatok
  const [formData, setFormData] = React.useState<Partial<Suspect>>({});
  const [vehicles, setVehicles] = React.useState<SuspectVehicle[]>([]);
  const [properties, setProperties] = React.useState<SuspectProperty[]>([]);

  // ÚJ ADATOK
  const [associates, setAssociates] = React.useState<SuspectAssociate[]>([]);
  const [criminalRecord, setCriminalRecord] = React.useState<any[]>([]); // Akták
  const [allSuspects, setAllSuspects] = React.useState<Suspect[]>([]); // Kereséshez

  // Új elemek state
  const [newVehicle, setNewVehicle] = React.useState({ plate: "", type: "", color: "", notes: "" });
  const [newProperty, setNewProperty] = React.useState({ address: "", type: "house", notes: "" });
  const [newAssociate, setNewAssociate] = React.useState({ targetId: "", relation: "", notes: "" });

  const canEdit = profile?.system_role === 'admin' || profile?.system_role === 'supervisor' || profile?.division === 'MCB';

  React.useEffect(() => {
    if (suspect && open) {
      setFormData({
        full_name: suspect.full_name,
        alias: suspect.alias,
        gender: suspect.gender,
        status: suspect.status,
        gang_affiliation: suspect.gang_affiliation,
        description: suspect.description,
        mugshot_url: suspect.mugshot_url
      });
      setIsEditing(false);
      fetchRelatedData();
    }
  }, [suspect, open]);

  const fetchRelatedData = async () => {
    if (!suspect) return;

    // 1. Járművek & Ingatlanok
    const { data: vData } = await supabase.from('suspect_vehicles').select('*').eq('suspect_id', suspect.id);
    if (vData) setVehicles(vData);

    const { data: pData } = await supabase.from('suspect_properties').select('*').eq('suspect_id', suspect.id);
    if (pData) setProperties(pData);

    // 2. Kapcsolatok (Associates) - Joinoljuk a társ adatait
    const { data: aData } = await supabase
      .from('suspect_associates')
      .select('*, associate:associate_id(full_name, alias, mugshot_url)')
      .eq('suspect_id', suspect.id);
    if (aData) setAssociates(aData);

    // 3. Előélet (Akták) - Keressük a case_suspects táblában
    const { data: cData } = await supabase
      .from('case_suspects')
      .select('*, case:case_id(id, case_number, title, status, created_at)')
      .eq('suspect_id', suspect.id)
      .order('added_at', { ascending: false });
    if (cData) setCriminalRecord(cData);

    // 4. Összes gyanúsított betöltése (a kapcsolathoz hozzáadáshoz)
    // Csak a nevük és ID-jük kell
    const { data: sData } = await supabase.from('suspects').select('id, full_name').neq('id', suspect.id);
    if (sData) setAllSuspects(sData);
  }

  const handleSave = async () => {
    if (!suspect) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('suspects').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', suspect.id);
      if (error) throw error;
      toast.success("Adatok frissítve.");
      onUpdate();
      setIsEditing(false);
    } catch (error: any) {
      toast.error("Hiba a mentéskor.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!suspect || !confirm("Biztosan TÖRÖLNI akarod ezt a személyt?")) return;
    setLoading(true);
    try {
      await supabase.from('suspects').delete().eq('id', suspect.id);
      toast.success("Személy törölve.");
      onUpdate();
      onOpenChange(false);
    } catch { toast.error("Hiba történt."); }
    finally { setLoading(false); }
  };

  // --- JÁRMŰVEK KEZELÉSE ---
  const addVehicle = async () => {
    if (!newVehicle.plate || !newVehicle.type) return toast.error("Rendszám és Típus kötelező!");
    const { error } = await supabase.from('suspect_vehicles').insert({ suspect_id: suspect!.id, plate_number: newVehicle.plate, vehicle_type: newVehicle.type, color: newVehicle.color, notes: newVehicle.notes });
    if (!error) { toast.success("Jármű hozzáadva."); setNewVehicle({ plate: "", type: "", color: "", notes: "" }); fetchRelatedData(); }
  };
  const deleteVehicle = async (id: string) => { await supabase.from('suspect_vehicles').delete().eq('id', id); fetchRelatedData(); };

  // --- INGATLANOK KEZELÉSE ---
  const addProperty = async () => {
    if (!newProperty.address) return toast.error("Cím kötelező!");
    const { error } = await supabase.from('suspect_properties').insert({ suspect_id: suspect!.id, address: newProperty.address, property_type: newProperty.type as any, notes: newProperty.notes });
    if (!error) { toast.success("Ingatlan hozzáadva."); setNewProperty({ address: "", type: "house", notes: "" }); fetchRelatedData(); }
  };
  const deleteProperty = async (id: string) => { await supabase.from('suspect_properties').delete().eq('id', id); fetchRelatedData(); };

  // --- KAPCSOLATOK KEZELÉSE ---
  const addAssociate = async () => {
    if (!newAssociate.targetId || !newAssociate.relation) return toast.error("Válassz személyt és kapcsolatot!");

    // Kétirányú kapcsolat? Egyelőre csak egyirányút hozunk létre, de logikus lenne mindkettő.
    // Most az egyszerűség kedvéért csak A -> B kapcsolatot rögzítünk.
    const { error } = await supabase.from('suspect_associates').insert({
      suspect_id: suspect!.id,
      associate_id: newAssociate.targetId,
      relationship: newAssociate.relation,
      notes: newAssociate.notes
    });

    if (!error) {
      toast.success("Kapcsolat rögzítve.");
      setNewAssociate({ targetId: "", relation: "", notes: "" });
      fetchRelatedData();
    } else {
      toast.error("Hiba (lehet, hogy már létezik ez a kapcsolat?)");
    }
  };
  const deleteAssociate = async (id: string) => { await supabase.from('suspect_associates').delete().eq('id', id); fetchRelatedData(); };


  if (!suspect) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 bg-slate-950/50 shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 overflow-hidden">
                {formData.mugshot_url ? <img src={formData.mugshot_url} className="w-full h-full object-cover"/> : <User className="w-6 h-6 text-slate-400"/>}
              </div>
              <div>
                <h3 className="text-xl font-bold">{formData.full_name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{formData.alias ? `"${formData.alias}"` : "Nincs alias"}</span>
                  {/* Státusz címke */}
                  <Badge variant="outline" className={
                    formData.status === 'wanted' ? 'text-red-500 border-red-900 bg-red-950/30' :
                      formData.status === 'jailed' ? 'text-orange-500 border-orange-900' : 'text-slate-500'
                  }>
                    {formData.status === 'wanted' ? 'KÖRÖZÖTT' : formData.status === 'jailed' ? 'BÖRTÖNBEN' : formData.status === 'deceased' ? 'ELHUNYT' : 'SZABADLÁBON'}
                  </Badge>
                </div>
              </div>
            </div>
            {!isEditing && canEdit && activeTab === 'details' && (
              <Button variant="outline" size="sm" className="border-yellow-600/50 text-yellow-500 hover:bg-yellow-900/20" onClick={() => setIsEditing(true)}>
                Szerkesztés
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 bg-slate-950 border-b border-slate-800">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-transparent p-0 h-auto gap-6">
                <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 rounded-none px-0 py-3">Adatok</TabsTrigger>
                <TabsTrigger value="record" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 rounded-none px-0 py-3">Előélet</TabsTrigger>
                <TabsTrigger value="associates" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 rounded-none px-0 py-3">Kapcsolatok</TabsTrigger>
                <TabsTrigger value="assets" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-yellow-500 rounded-none px-0 py-3">Vagyon</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1 p-6">
            <Tabs value={activeTab} className="w-full space-y-6">

              {/* --- 1. ADATOK --- */}
              <TabsContent value="details" className="space-y-4 m-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Teljes Név</Label>
                    <Input disabled={!isEditing} value={formData.full_name || ""} onChange={e => setFormData({...formData, full_name: e.target.value})} className="bg-slate-950 border-slate-800 disabled:opacity-80"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Alias</Label>
                    <Input disabled={!isEditing} value={formData.alias || ""} onChange={e => setFormData({...formData, alias: e.target.value})} className="bg-slate-950 border-slate-800 disabled:opacity-80"/>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Státusz</Label>
                    <Select disabled={!isEditing} value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 disabled:opacity-80"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="free">Szabadlábon</SelectItem>
                        <SelectItem value="wanted">Körözött</SelectItem>
                        <SelectItem value="jailed">Börtönben</SelectItem>
                        <SelectItem value="deceased">Elhunyt</SelectItem>
                        <SelectItem value="unknown">Ismeretlen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nem</Label>
                    <Select disabled={!isEditing} value={formData.gender || "male"} onValueChange={(val) => setFormData({...formData, gender: val})}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 disabled:opacity-80"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="male">Férfi</SelectItem>
                        <SelectItem value="female">Nő</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Banda / Szervezet</Label>
                  <Input disabled={!isEditing} value={formData.gang_affiliation || ""} onChange={e => setFormData({...formData, gang_affiliation: e.target.value})} className="bg-slate-950 border-slate-800 disabled:opacity-80"/>
                </div>

                <div className="space-y-2">
                  <Label>Leírás / Ismertetőjelek</Label>
                  <Textarea disabled={!isEditing} value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border-slate-800 h-32 resize-none disabled:opacity-80"/>
                </div>
              </TabsContent>

              {/* --- 2. ELŐÉLET (Rekordok) --- */}
              <TabsContent value="record" className="space-y-4 m-0">
                {criminalRecord.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    <History className="w-10 h-10 mb-3 opacity-20" />
                    <p>Nincs rögzített ügye a rendszerben.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criminalRecord.map((record) => {
                      // Ellenőrizzük a hozzáférést
                      // Megjegyzés: Itt nem tudjuk, hogy collaborator-e, mert a criminalRecord query nem hozza le a case_collaborators-t.
                      // Ezért itt egy "szigorúbb" ellenőrzést futtatunk a UI-hoz:
                      // Ha Inv I/II és nem tulajdonos -> Lehet, hogy collab, de nem tudjuk -> Engedjük kattintani, de a DetailPage majd kidobja ha nem.
                      // VAGY: Ha HighCommand/InvIII -> Biztos zöld út.

                      const hasClearAccess = canViewCaseDetails(profile, record.case as any, false);
                      // A 'false' a collab paraméter, mert nem tudjuk.
                      // Ezért Inv I/II-nél false-t adhat vissza akkor is, ha collab.
                      // De sebaj, a kattintást engedélyezzük, max hibaüzenetet kap.

                      return (
                        <div key={record.id}
                             className={cn(
                               "p-3 rounded-lg bg-slate-950/50 border border-slate-800 flex items-center justify-between transition-colors",
                               "hover:border-slate-600 cursor-pointer"
                             )}
                             onClick={() => {
                               // Navigálás
                               onOpenChange(false);
                               navigate(`/mcb/case/${record.case_id}`);
                             }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-500">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                #{record.case?.case_number} {record.case?.title}
                                {/* Ha gyanús, hogy nem fér hozzá (pl. lezárt és nem ő a tulaj), jelezzük */}
                                {record.case?.status !== 'open' && <Lock className="w-3 h-3 text-red-500"/>}
                              </h4>
                              <div className="flex gap-2 text-xs text-slate-400 mt-0.5">
                                <span className="uppercase font-semibold text-yellow-600">{record.involvement_type}</span>
                                <span>•</span>
                                <span>{new Date(record.added_at).toLocaleDateString('hu-HU')}</span>
                              </div>
                              {record.notes && <p className="text-xs text-slate-500 mt-1 italic">"{record.notes}"</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                            Ugrás <LinkIcon className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      )})}
                  </div>
                )}
              </TabsContent>

              {/* --- 3. KAPCSOLATOK --- */}
              <TabsContent value="associates" className="space-y-4 m-0">
                {/* Hozzáadás */}
                {canEdit && (
                  <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex gap-2">
                      <Select value={newAssociate.targetId} onValueChange={val => setNewAssociate({...newAssociate, targetId: val})}>
                        <SelectTrigger className="h-9 bg-slate-900 border-slate-700 flex-1"><SelectValue placeholder="Válassz személyt..." /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 max-h-[200px]">
                          {allSuspects.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Kapcsolat (pl. Testvér)" value={newAssociate.relation} onChange={e => setNewAssociate({...newAssociate, relation: e.target.value})} className="h-9 bg-slate-900 border-slate-700 w-1/3"/>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Megjegyzés..." value={newAssociate.notes} onChange={e => setNewAssociate({...newAssociate, notes: e.target.value})} className="h-9 bg-slate-900 border-slate-700 flex-1"/>
                      <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={addAssociate}><Plus className="w-4 h-4 mr-1"/> Hozzáadás</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {associates.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">Nincsenek ismert kapcsolatok.</p>
                  ) : (
                    associates.map(assoc => (
                      <div key={assoc.id} className="flex items-center gap-3 p-3 rounded bg-slate-950/30 border border-slate-800/60">
                        <Avatar className="h-10 w-10 border border-slate-700">
                          <AvatarImage src={assoc.associate?.mugshot_url || undefined} />
                          <AvatarFallback className="text-xs bg-slate-900">{assoc.associate?.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">{assoc.associate?.full_name}</p>
                          <p className="text-xs text-yellow-500 font-medium uppercase tracking-wide">{assoc.relationship}</p>
                          {assoc.notes && <p className="text-xs text-slate-500 mt-0.5">{assoc.notes}</p>}
                        </div>
                        {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-500" onClick={() => deleteAssociate(assoc.id)}><X className="w-4 h-4"/></Button>}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* --- 4. VAGYON (Jármű/Ingatlan egyben) --- */}
              <TabsContent value="assets" className="space-y-6 m-0">
                {/* JÁRMŰVEK */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2"><Car className="w-4 h-4"/> Járművek</h3>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Input placeholder="Rendszám" value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})} className="h-8 text-xs w-24 bg-slate-950 border-slate-800"/>
                      <Input placeholder="Típus" value={newVehicle.type} onChange={e => setNewVehicle({...newVehicle, type: e.target.value})} className="h-8 text-xs flex-1 bg-slate-950 border-slate-800"/>
                      <Input placeholder="Szín" value={newVehicle.color} onChange={e => setNewVehicle({...newVehicle, color: e.target.value})} className="h-8 text-xs w-24 bg-slate-950 border-slate-800"/>
                      <Button size="sm" className="h-8 w-8 p-0 bg-slate-800 hover:bg-slate-700" onClick={addVehicle}><Plus className="w-4 h-4"/></Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {vehicles.map(v => (
                      <div key={v.id} className="flex justify-between items-center p-2 rounded bg-slate-950/30 border border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-yellow-500 border-yellow-900/30">{v.plate_number}</Badge>
                            <span className="text-sm font-medium">{v.vehicle_type}</span>
                            <span className="text-xs text-slate-500">{v.color}</span>
                          </div>
                        </div>
                        {canEdit && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-500" onClick={() => deleteVehicle(v.id)}><X className="w-3 h-3"/></Button>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* INGATLANOK */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2"><Home className="w-4 h-4"/> Ingatlanok</h3>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Input placeholder="Cím" value={newProperty.address} onChange={e => setNewProperty({...newProperty, address: e.target.value})} className="h-8 text-xs flex-1 bg-slate-950 border-slate-800"/>
                      <Select value={newProperty.type} onValueChange={val => setNewProperty({...newProperty, type: val})}>
                        <SelectTrigger className="w-28 h-8 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                          <SelectItem value="house">Ház</SelectItem>
                          <SelectItem value="garage">Garázs</SelectItem>
                          <SelectItem value="business">Üzlet</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-8 w-8 p-0 bg-slate-800 hover:bg-slate-700" onClick={addProperty}><Plus className="w-4 h-4"/></Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {properties.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-2 rounded bg-slate-950/30 border border-slate-800">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] h-5">{p.property_type === 'house' ? 'Ház' : p.property_type === 'garage' ? 'Garázs' : 'Üzlet'}</Badge>
                          <span className="text-sm">{p.address}</span>
                        </div>
                        {canEdit && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-500" onClick={() => deleteProperty(p.id)}><X className="w-3 h-3"/></Button>}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

            </Tabs>
          </ScrollArea>
        </div>

        {activeTab === 'details' && isEditing && (
          <DialogFooter className="p-6 pt-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center shrink-0">
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>Törlés</Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Mégse</Button>
              <Button type="button" onClick={handleSave} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 text-black">Mentés</Button>
            </div>
          </DialogFooter>
        )}

        {/* Bezárás gomb ha nem szerkesztünk (vagy nem a details fülön vagyunk) */}
        {(!isEditing || activeTab !== 'details') && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700">Bezárás</Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}