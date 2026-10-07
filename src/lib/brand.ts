import mcbSeal from "@/assets/brand/mcb.webp";
import mcbGangs from "@/assets/brand/mcb-gangs.webp";
import sebBadge from "@/assets/brand/seb.webp";

/**
 * Division emblems, bundled with the app: the build gives them hashed names that the CDN serves
 * with a one-year cache (vercel.json), so a member downloads each one once. Documents store only
 * a key (LETTERHEAD_LOGOS), never the file.
 */
export const BRAND_IMAGES = {mcb: mcbSeal, mcbGangs, seb: sebBadge} as const;
