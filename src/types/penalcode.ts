export interface Alpont {
  paragrafus: string;
  megnevezes: string;
  min_birsag: number | null;
  max_birsag: number | null;
  min_fegyhaz: number | string | null;
  max_fegyhaz: number | string | null;
  rovidites: string;
  megjegyzes: string;
}

export interface Tetel {
  paragrafus: string;
  megnevezes: string;
  min_birsag: number | null;
  max_birsag: number | null;
  min_fegyhaz: number | string | null;
  max_fegyhaz: number | string | null;
  rovidites: string | null;
  megjegyzes: string;
  alpontok?: Alpont[];
}

export interface Kategoria {
  kategoria_nev: string;
  tetelek: Tetel[];
}

export interface PenalCodeItem {
  id: string;
  kategoria_nev: string;
  fo_tetel_nev?: string;
  paragrafus: string;
  megnevezes: string;
  min_birsag: number | null;
  max_birsag: number | null;
  min_fegyhaz: number | string | null;
  max_fegyhaz: number | string | null;
  rovidites: string;
  megjegyzes: string;
  isWarning: boolean;
}