import {createCachedLoader} from "./cache";
import {supabase} from "./supabaseClient";
import type {Ribbon} from "@/types/supabase";

/** The ribbon catalogue rarely changes: one request per 30 minutes is plenty. */
const catalogue = createCachedLoader(async () => {
  const {data, error} = await supabase.from("ribbons").select("id, name, description, color_hex, image_url").order("name");
  if (error) throw error;
  return (data ?? []) as Ribbon[];
}, 30 * 60 * 1000);

export const getRibbonCatalogue = (force = false) => catalogue.get(force);
export const invalidateRibbonCatalogue = () => catalogue.invalidate();
