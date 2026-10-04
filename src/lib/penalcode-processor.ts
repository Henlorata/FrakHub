import penalCodeData from "../data/penalcode.json";
import type {
  Kategoria,
  KategoriaData,
  PenalCodeItem,
  PenalCodeGroup,
  Tetel,
  Alpont,
  WarningType,
} from "@/types/penalcode";

const LICENSE_BAN_KEYWORDS = [
  "eltiltható",
  "eltiltani",
  "vezetéstől",
  "max 30 nap",
];

const LICENSE_REGISTRATION_REVOKE_KEYWORDS = [
  "jogosítvány és forgalmi",
];

const FIREARM_WARNING_KEYWORDS = [
  "fegyver",
  "lőfegyver",
  "fegyvertár"
];

const checkWarning = (note: string | null | undefined, name: string): WarningType => {
  if (!note && !name) return "none";
  const lowerNote = (note || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();
  const combinedText = `${lowerNote} ${lowerName}`;

  // 1. Jogosítvány ÉS Forgalmi
  if (LICENSE_REGISTRATION_REVOKE_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
    return "license_registration_revoke";
  }

  // 2. Fegyver
  if (FIREARM_WARNING_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
    return "firearm_revoke";
  }

  // 3. Csak Jogosítvány (általános)
  if (LICENSE_BAN_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
    return "license_ban";
  }

  return "none";
};

/**
 * Stable item id derived from the paragraph numbers and the abbreviation (unique in
 * penalcode.json). The previous ids were sequential ("item-12"), so every edit of the
 * penal code silently re-pointed saved favorites and templates to other offences.
 */
const stableItemId = (...parts: (string | null | undefined)[]) => `item:${parts.filter(Boolean).join("|")}`;

/** Old sequential id -> stable id, for migrating favorites/templates saved before the change. */
export const LEGACY_ITEM_IDS = new Map<string, string>();

export const prepareData = (): KategoriaData[] => {
  const allKategorias: KategoriaData[] = [];
  let idCounter = 0;

  (penalCodeData as Kategoria[]).forEach((kategoria) => {
    const kategoriaData: KategoriaData = {
      kategoria_nev: kategoria.kategoria_nev,
      items: [],
    };

    kategoria.tetelek.forEach((tetel: Tetel) => {
      if (tetel.alpontok && tetel.alpontok.length > 0) {
        const group: PenalCodeGroup = {
          id: `group-${tetel.paragrafus.replace(/\s/g, "")}`,
          kategoria_nev: kategoria.kategoria_nev,
          paragrafus: tetel.paragrafus,
          megnevezes: tetel.megnevezes,
          megjegyzes: tetel.megjegyzes || "",
          alpontok: [],
        };

        const foMegjegyzes = tetel.megjegyzes || "";

        group.alpontok = tetel.alpontok.map((alpont: Alpont) => {
          const alpontMegjegyzes = alpont.megjegyzes || "";
          const fullNote = `${foMegjegyzes} ${alpontMegjegyzes}`.trim();
          idCounter++;
          const warningType = checkWarning(fullNote, alpont.megnevezes);
          const id = stableItemId(tetel.paragrafus, alpont.paragrafus, alpont.rovidites);
          LEGACY_ITEM_IDS.set(`item-${idCounter}`, id);

          return {
            ...alpont,
            id,
            kategoria_nev: kategoria.kategoria_nev,
            fo_tetel_nev: tetel.megnevezes,
            fo_tetel_paragrafus: tetel.paragrafus,
            megjegyzes: fullNote,
            isWarning: warningType !== "none",
            warningType: warningType,
          };
        });

        kategoriaData.items.push(group);
      } else if (tetel.rovidites) {
        idCounter++;
        const warningType = checkWarning(tetel.megjegyzes, tetel.megnevezes);
        const id = stableItemId(tetel.paragrafus, tetel.rovidites);
        LEGACY_ITEM_IDS.set(`item-${idCounter}`, id);
        const item: PenalCodeItem = {
          id,
          kategoria_nev: kategoria.kategoria_nev,
          paragrafus: tetel.paragrafus,
          megnevezes: tetel.megnevezes,
          min_birsag: tetel.min_birsag,
          max_birsag: tetel.max_birsag,
          min_fegyhaz: tetel.min_fegyhaz,
          max_fegyhaz: tetel.max_fegyhaz,
          rovidites: tetel.rovidites,
          megjegyzes: tetel.megjegyzes || "",
          isWarning: warningType !== "none",
          warningType: warningType,
        };
        kategoriaData.items.push(item);
      }
    });

    allKategorias.push(kategoriaData);
  });
  return allKategorias;
};

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "---";
  return `$${value.toLocaleString("hu-HU")}`;
};

export const formatJailTime = (
  value: number | string | null | undefined,
): string => {
  if (value === null || value === undefined) return "---";
  if (typeof value === "string") return value;
  return `${value} perc`;
};