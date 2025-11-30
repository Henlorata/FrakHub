import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Tabs, TabsList, TabsTrigger, TabsContent} from "@/components/ui/tabs";
import {
  User,
  Car,
  Home,
  Plus,
  X,
  History,
  FileText,
  Link as LinkIcon,
  ShieldAlert,
  Fingerprint,
  Database
} from "lucide-react";
import {toast} from "sonner";
import type {Suspect, SuspectVehicle, SuspectProperty, SuspectAssociate} from "@/types/supabase";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Badge} from "@/components/ui/badge";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {useNavigate} from "react-router-dom";
import {canViewCaseDetails, cn} from "@/lib/utils";

interface SuspectDetailDialogProps {
  suspect: Suspect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function SuspectDetailDialog({suspect, open, onOpenChange, onUpdate}: SuspectDetailDialogProps) {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("details");

  // Adatok
  const [formData, setFormData] = React.useState<Partial<Suspect>>({});
  const [vehicles, setVehicles] = React.useState<SuspectVehicle[]>([]);
  const [properties, setProperties] = React.useState<SuspectProperty[]>([]);
  const [associates, setAssociates] = React.useState<SuspectAssociate[]>([]);
  const [criminalRecord, setCriminalRecord] = React.useState<any[]>([]);
  const [allSuspects, setAllSuspects] = React.useState<Suspect[]>([]);

  // Új elemek state
  const [newVehicle, setNewVehicle] = React.useState({plate: "", type: "", color: "", notes: ""});
  const [newProperty, setNewProperty] = React.useState({address: "", type: "house", notes: ""});
  const [newAssociate, setNewAssociate] = React.useState({targetId: "", relation: "", notes: ""});

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
    const {data: vData} = await supabase.from('suspect_vehicles').select('*').eq('suspect_id', suspect.id);
    if (vData) setVehicles(vData);
    const {data: pData} = await supabase.from('suspect_properties').select('*').eq('suspect_id', suspect.id);
    if (pData) setProperties(pData);
    const {data: aData} = await supabase.from('suspect_associates').select('*, associate:associate_id(full_name, alias, mugshot_url)').eq('suspect_id', suspect.id);
    if (aData) setAssociates(aData);
    const {data: cData} = await supabase.from('case_suspects').select('*, case:case_id(id, case_number, title, status, created_at)').eq('suspect_id', suspect.id).order('added_at', {ascending: false});
    if (cData) setCriminalRecord(cData);
    const {data: sData} = await supabase.from('suspects').select('id, full_name').neq('id', suspect.id);
    if (sData) setAllSuspects(sData);
  }

  const handleSave = async () => {
    if (!suspect) return;
    setLoading(true);
    try {
      const {error} = await supabase.from('suspects').update({
        ...formData,
        updated_at: new Date().toISOString()
      }).eq('id', suspect.id);
      if (error) throw error;
      toast.success("Profil frissítve.");
      onUpdate();
      setIsEditing(false);
    } catch (error: any) {
      toast.error("Hiba a mentéskor.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!suspect || !confirm("Végleges törlés?")) return;
    setLoading(true);
    try {
      await supabase.from('suspects').delete().eq('id', suspect.id);
      toast.success("Adatlap törölve.");
      onUpdate();
      onOpenChange(false);
    } catch {
      toast.error("Hiba történt.");
    } finally {
      setLoading(false);
    }
  };

  // Sub-items handlers
  const addVehicle = async () => {
    if (!newVehicle.plate) return toast.error("Rendszám hiányzik!");
    const {error} = await supabase.from('suspect_vehicles').insert({
      suspect_id: suspect!.id,
      plate_number: newVehicle.plate,
      vehicle_type: newVehicle.type,
      color: newVehicle.color,
      notes: newVehicle.notes
    });
    if (!error) {
      toast.success("Jármű rögzítve.");
      setNewVehicle({plate: "", type: "", color: "", notes: ""});
      fetchRelatedData();
    }
  };
  const deleteVehicle = async (id: string) => {
    await supabase.from('suspect_vehicles').delete().eq('id', id);
    fetchRelatedData();
  };

  const addProperty = async () => {
    if (!newProperty.address) return toast.error("Cím hiányzik!");
    const {error} = await supabase.from('suspect_properties').insert({
      suspect_id: suspect!.id,
      address: newProperty.address,
      property_type: newProperty.type as any,
      notes: newProperty.notes
    });
    if (!error) {
      toast.success("Ingatlan rögzítve.");
      setNewProperty({address: "", type: "house", notes: ""});
      fetchRelatedData();
    }
  };
  const deleteProperty = async (id: string) => {
    await supabase.from('suspect_properties').delete().eq('id', id);
    fetchRelatedData();
  };

  const addAssociate = async () => {
    if (!newAssociate.targetId) return toast.error("Személy hiányzik!");
    const {error} = await supabase.from('suspect_associates').insert({
      suspect_id: suspect!.id,
      associate_id: newAssociate.targetId,
      relationship: newAssociate.relation,
      notes: newAssociate.notes
    });
    if (!error) {
      toast.success("Kapcsolat rögzítve.");
      setNewAssociate({targetId: "", relation: "", notes: ""});
      fetchRelatedData();
    }
  };
  const deleteAssociate = async (id: string) => {
    await supabase.from('suspect_associates').delete().eq('id', id);
    fetchRelatedData();
  };

  if (!suspect) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#050a14] border border-slate-800 text-white sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">

        {/* --- HEADER STRIP --- */}
        <div
          className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shrink-0 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '10px 10px'
          }}></div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-slate-950 border border-slate-700 rounded flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-500"/>
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter font-mono">CRIMINAL RECORD
                #{suspect.id.slice(0, 8)}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn("font-mono border-opacity-50",
                  formData.status === 'wanted' ? 'text-red-500 border-red-500 bg-red-500/10 animate-pulse' :
                    formData.status === 'jailed' ? 'text-orange-500 border-orange-500 bg-orange-500/10' : 'text-green-500 border-green-500 bg-green-500/10')}>
                  {formData.status === 'wanted' ? 'KÖRÖZÖTT' : formData.status === 'jailed' ? 'BÖRTÖNBEN' : formData.status === 'deceased' ? 'ELHUNYT' : 'SZABADLÁBON'}
                </Badge>
                <span
                  className="text-[10px] text-slate-500 font-mono uppercase">Last Update: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {!isEditing && canEdit && activeTab === 'details' && (
            <Button variant="outline" size="sm" className="relative z-10 border-slate-700 hover:bg-slate-800"
                    onClick={() => setIsEditing(true)}>Adatok Szerkesztése</Button>
          )}
        </div>

        <div className="flex flex-1 min-h-0">
          {/* --- LEFT SIDEBAR (Mugshot & Nav) --- */}
          <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-6 pb-4 flex flex-col items-center border-b border-slate-900">
              <div className="relative w-32 h-32 mb-4 group">
                <div
                  className="absolute inset-0 border-2 border-slate-700 rounded-lg group-hover:border-slate-500 transition-colors"></div>
                {/* Corner Markers */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white opacity-50"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white opacity-50"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white opacity-50"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white opacity-50"></div>

                <Avatar className="w-full h-full rounded-lg">
                  <AvatarImage src={formData.mugshot_url} className="object-cover"/>
                  <AvatarFallback className="bg-slate-900 text-slate-600 rounded-lg"><User
                    className="w-12 h-12"/></AvatarFallback>
                </Avatar>
              </div>
              <h2 className="text-lg font-bold text-center leading-tight">{formData.full_name}</h2>
              {formData.alias && <p className="text-xs text-slate-500 italic mt-1">"{formData.alias}"</p>}
            </div>

            <div className="flex-1 py-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="w-full">
                <TabsList className="flex flex-col h-auto bg-transparent w-full gap-1 px-2">
                  <TabsTrigger value="details"
                               className="w-full justify-start px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-l-2 border-red-500 transition-all rounded-none text-slate-500"><Fingerprint
                    className="w-4 h-4 mr-2"/> Személyes Adatok</TabsTrigger>
                  <TabsTrigger value="record"
                               className="w-full justify-start px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-l-2 border-red-500 transition-all rounded-none text-slate-500"><History
                    className="w-4 h-4 mr-2"/> Előélet & Akták</TabsTrigger>
                  <TabsTrigger value="associates"
                               className="w-full justify-start px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-l-2 border-red-500 transition-all rounded-none text-slate-500"><User
                    className="w-4 h-4 mr-2"/> Kapcsolatok</TabsTrigger>
                  <TabsTrigger value="assets"
                               className="w-full justify-start px-4 py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-l-2 border-red-500 transition-all rounded-none text-slate-500"><Database
                    className="w-4 h-4 mr-2"/> Vagyon & Tulajdon</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* --- MAIN CONTENT AREA --- */}
          <div className="flex-1 bg-slate-900/50 flex flex-col min-w-0">
            <ScrollArea className="flex-1 p-6">
              <Tabs value={activeTab} className="w-full">

                {/* 1. DETAIL VIEW */}
                <TabsContent value="details" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Teljes Név</Label>
                      <Input disabled={!isEditing} value={formData.full_name || ""}
                             onChange={e => setFormData({...formData, full_name: e.target.value})}
                             className="bg-slate-950 border-slate-800 h-9 font-mono"/>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Alias / Becenév</Label>
                      <Input disabled={!isEditing} value={formData.alias || ""}
                             onChange={e => setFormData({...formData, alias: e.target.value})}
                             className="bg-slate-950 border-slate-800 h-9 font-mono"/>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Státusz</Label>
                      <Select disabled={!isEditing} value={formData.status}
                              onValueChange={(val: any) => setFormData({...formData, status: val})}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 h-9"><SelectValue/></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="free">Szabadlábon</SelectItem>
                          <SelectItem value="wanted">Körözött</SelectItem>
                          <SelectItem value="jailed">Börtönben</SelectItem>
                          <SelectItem value="deceased">Elhunyt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Nem</Label>
                      <Select disabled={!isEditing} value={formData.gender || "male"}
                              onValueChange={(val) => setFormData({...formData, gender: val})}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 h-9"><SelectValue/></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="male">Férfi</SelectItem>
                          <SelectItem value="female">Nő</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Bűnszervezet / Banda</Label>
                      <Input disabled={!isEditing} value={formData.gang_affiliation || ""}
                             onChange={e => setFormData({...formData, gang_affiliation: e.target.value})}
                             className="bg-slate-950 border-slate-800 h-9 font-mono"/>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Személyleírás /
                        Ismertetőjelek</Label>
                      <Textarea disabled={!isEditing} value={formData.description || ""}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                className="bg-slate-950 border-slate-800 min-h-[120px] font-mono text-sm leading-relaxed break-all"/>
                    </div>
                  </div>
                </TabsContent>

                {/* 2. CRIMINAL RECORD */}
                <TabsContent value="record" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  {criminalRecord.length === 0 ?
                    <div className="text-center py-10 text-slate-500 text-sm font-mono">NO RECORDS FOUND</div> :
                    criminalRecord.map(rec => (
                      <div key={rec.id} onClick={() => {
                        onOpenChange(false);
                        navigate(`/mcb/case/${rec.case_id}`);
                      }}
                           className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800 rounded hover:border-slate-600 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center border border-slate-800 group-hover:border-slate-600">
                            <FileText className="w-5 h-5 text-slate-500 group-hover:text-white"/>
                          </div>
                          <div>
                            <h4
                              className="font-bold text-slate-200 text-sm group-hover:text-white">#{rec.case?.case_number} {rec.case?.title}</h4>
                            <div className="flex gap-2 text-[10px] uppercase font-bold text-slate-500 mt-0.5">
                              <span className="text-yellow-600">{rec.involvement_type}</span>
                              <span>•</span>
                              <span>{new Date(rec.added_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <LinkIcon className="w-4 h-4 text-slate-600 group-hover:text-blue-400"/>
                      </div>
                    ))
                  }
                </TabsContent>

                {/* 3. ASSOCIATES */}
                <TabsContent value="associates" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  {canEdit && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded flex gap-2 mb-4">
                      <Select value={newAssociate.targetId}
                              onValueChange={val => setNewAssociate({...newAssociate, targetId: val})}>
                        <SelectTrigger className="h-8 bg-slate-900 border-slate-700 flex-1"><SelectValue
                          placeholder="Személy..."/></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800"><ScrollArea
                          className="h-40">{allSuspects.map(s => <SelectItem key={s.id}
                                                                             value={s.id}>{s.full_name}</SelectItem>)}</ScrollArea></SelectContent>
                      </Select>
                      <Input placeholder="Kapcsolat..." value={newAssociate.relation}
                             onChange={e => setNewAssociate({...newAssociate, relation: e.target.value})}
                             className="h-8 bg-slate-900 border-slate-700 w-1/3"/>
                      <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-500" onClick={addAssociate}><Plus
                        className="w-4 h-4"/></Button>
                    </div>
                  )}
                  {associates.map(assoc => (
                    <div key={assoc.id}
                         className="flex items-center gap-3 p-3 bg-slate-950/30 border border-slate-800 rounded">
                      <Avatar className="h-10 w-10 border border-slate-700"><AvatarImage
                        src={assoc.associate?.mugshot_url}/><AvatarFallback
                        className="bg-slate-900">{assoc.associate?.full_name.charAt(0)}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-200">{assoc.associate?.full_name}</p>
                        <p
                          className="text-[10px] text-yellow-500 uppercase font-bold tracking-wider">{assoc.relationship}</p>
                      </div>
                      {canEdit &&
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-500"
                                onClick={() => deleteAssociate(assoc.id)}><X className="w-4 h-4"/></Button>}
                    </div>
                  ))}
                </TabsContent>

                {/* 4. ASSETS */}
                <TabsContent value="assets" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-3">
                    <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider flex items-center gap-2">
                      <Car className="w-3 h-3"/> Járművek</h3>
                    {canEdit && <div className="flex gap-2 mb-2"><Input placeholder="Rendszám" value={newVehicle.plate}
                                                                        onChange={e => setNewVehicle({
                                                                          ...newVehicle,
                                                                          plate: e.target.value
                                                                        })}
                                                                        className="h-8 bg-slate-950 border-slate-800 w-24 text-xs"/><Input
                      placeholder="Típus" value={newVehicle.type}
                      onChange={e => setNewVehicle({...newVehicle, type: e.target.value})}
                      className="h-8 bg-slate-900 border-slate-700 flex-1 text-xs"/><Button size="sm"
                                                                                            className="h-8 w-8 p-0"
                                                                                            onClick={addVehicle}><Plus
                      className="w-4 h-4"/></Button></div>}
                    {vehicles.map(v => (
                      <div key={v.id}
                           className="flex justify-between items-center p-2 bg-slate-950/30 border border-slate-800 rounded">
                        <div className="flex items-center gap-3"><Badge variant="outline"
                                                                        className="font-mono text-yellow-500 border-yellow-900/50 bg-yellow-900/10">{v.plate_number}</Badge><span
                          className="text-sm text-slate-300">{v.vehicle_type}</span></div>
                        {canEdit &&
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-500"
                                  onClick={() => deleteVehicle(v.id)}><X className="w-3 h-3"/></Button>}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider flex items-center gap-2">
                      <Home className="w-3 h-3"/> Ingatlanok</h3>
                    {canEdit && <div className="flex gap-2 mb-2"><Input placeholder="Cím..." value={newProperty.address}
                                                                        onChange={e => setNewProperty({
                                                                          ...newProperty,
                                                                          address: e.target.value
                                                                        })}
                                                                        className="h-8 bg-slate-950 border-slate-800 flex-1 text-xs"/><Button
                      size="sm" className="h-8 w-8 p-0" onClick={addProperty}><Plus className="w-4 h-4"/></Button>
                    </div>}
                    {properties.map(p => (
                      <div key={p.id}
                           className="flex justify-between items-center p-2 bg-slate-950/30 border border-slate-800 rounded">
                        <div className="flex items-center gap-2"><Badge variant="secondary"
                                                                        className="text-[10px] h-5">{p.property_type}</Badge><span
                          className="text-sm text-slate-300">{p.address}</span></div>
                        {canEdit &&
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-500"
                                  onClick={() => deleteProperty(p.id)}><X className="w-3 h-3"/></Button>}
                      </div>
                    ))}
                  </div>
                </TabsContent>

              </Tabs>
            </ScrollArea>
          </div>
        </div>

        {/* --- FOOTER (Only when editing details) --- */}
        {activeTab === 'details' && isEditing && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between shrink-0">
            <Button variant="destructive" onClick={handleDelete}
                    className="bg-red-950 text-red-500 hover:bg-red-900 border border-red-900">ADATLAP TÖRLÉSE</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Mégse</Button>
              <Button onClick={handleSave} disabled={loading}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold">VÁLTOZÁSOK MENTÉSE</Button>
            </div>
          </div>
        )}

        {(!isEditing || activeTab !== 'details') && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}
                    className="border-slate-700 text-slate-400 hover:text-white">BEZÁRÁS</Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}