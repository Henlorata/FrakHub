import {useEffect, useRef, useState} from "react";
import {useNavigationType} from "react-router";
import {siteApi, type PublicSite, type SiteContent} from "@/lib/site";
import {Hero} from "./Hero";
import {PublicShell, scrollToSection} from "./PublicChrome";
import {About, Divisions, Faq, FinalCall, Gallery, Leadership, NewsSection, NewsTicker, Recruitment, StatsBand, Units, Values} from "./sections";

/** Where the visitor was on the page (back from an article: the same place again). */
const SCROLL_KEY = "frakhub.home.scroll";

/** The copy the page shows when the database cannot be reached (the same as the seeded defaults). */
const FALLBACK: SiteContent = {
  about: {
    title: "Rólunk",
    lead: "A San Fierro Sheriff's Department a megye rendjének őre: az utcákon, az autópályákon, a levegőben és a nyomozószobákban.",
    text: "Osztályaink és egységeink együtt dolgoznak: a járőrszolgálat az első vonal, a Special Enforcement Bureau a legnehezebb helyzetek egysége, a Major Crimes Bureau pedig a súlyos bűnügyek nyomozója.",
  },
  values: [
    {title: "Integrity", text: "Becsület a szolgálatban és azon kívül."},
    {title: "Service", text: "A megye lakóiért dolgozunk."},
    {title: "Protection", text: "Védjük a polgárokat, egymást és a jogrendet."},
  ],
  divisions: {
    TSB: {name: "TSB", subtitle: "Általános állomány", text: "Járőrszolgálat, az állomány gerince. Innen indul mindenki."},
    SEB: {name: "Special Enforcement Bureau", subtitle: "Különleges egység", text: "Taktikai beavatkozás, behatolás, túszhelyzetek."},
    MCB: {name: "Major Crimes Bureau", subtitle: "Nyomozó részleg", text: "Súlyos bűncselekmények, szervezett bűnözés, körözések."},
  },
  units: {
    SAHP: {name: "Highway Patrol", text: "Forgalomirányítás és üldözés."},
    AB: {name: "Aero Bureau", text: "Helikopteres járőrözés."},
    MU: {name: "Medical Unit", text: "Elsősegély és mentés."},
    GW: {name: "Game Warden", text: "Vadvédelem, vízi és terepi szolgálat."},
    FAB: {name: "Financial Administration Bureau", text: "Pénzügyi adminisztráció."},
    SIB: {name: "Sheriff's Information Bureau", text: "Kommunikáció és sajtó."},
    TB: {name: "Training Bureau", text: "Oktatás és vizsgáztatás."},
  },
  recruitment: {title: "Csatlakozz hozzánk", text: "Keressük azokat, akik komolyan veszik a szolgálatot.", requirements: [], steps: []},
  faq: [],
  gallery: [],
  sections: {},
};

/**
 * The public front page of the San Fierro Sheriff's Department: who we are, the divisions and
 * units, the news of the Sheriff's Information Bureau, the leadership and the way in. One read
 * (get_public_site), kept for five minutes.
 */
export function HomePage() {
  // Back from an article the page is drawn at once from the copy read a moment ago.
  const [site, setSite] = useState<PublicSite | null>(() => siteApi.cached());
  const navigationType = useNavigationType();
  const restored = useRef(false);

  useEffect(() => {
    let active = true;
    siteApi.site().then((data) => active && setSite(data), () => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.title = "San Fierro Sheriff's Department";
    return () => {
      document.title = "SFSD Intranet";
    };
  }, []);

  useEffect(() => () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({y: Math.round(window.scrollY), at: Date.now()}));
    } catch {
      // Storage disabled: the page opens at the top.
    }
  }, []);

  // Back (or reloaded) within half an hour: the place the visitor left.
  useEffect(() => {
    if (restored.current || !site || navigationType !== "POP" || window.location.hash) return;
    restored.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null") as {y: number; at: number} | null;
      if (saved && saved.y > 0 && Date.now() - saved.at < 30 * 60_000) window.scrollTo({top: saved.y, behavior: "instant"});
    } catch {
      // Unreadable: stay at the top.
    }
  }, [site, navigationType]);

  // Arriving with a section in the address (/#hirek): go there once the page is drawn.
  useEffect(() => {
    if (!site || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    const timer = window.setTimeout(() => scrollToSection(id), 120);
    return () => window.clearTimeout(timer);
  }, [site]);

  const content: SiteContent = {...FALLBACK, ...(site?.content ?? {})};
  const sections = content.sections ?? {};
  const open = site?.recruitment.open ?? false;

  return (
    <PublicShell onHome alertLevel={site?.alert_level} links={content.contact?.links}>
      <Hero site={site} ticker={site?.news.length ? <NewsTicker news={site.news}/> : null}/>
      <StatsBand stats={sections.stats === false ? null : site?.stats ?? null}/>
      <About content={content}/>
      <Divisions site={site ? {...site, content} : {content, news: [], stats: null, leadership: null, recruitment: {open}, alert_level: null}}/>
      <Units content={content}/>
      <NewsSection news={site?.news ?? []}/>
      {sections.values !== false && <Values values={content.values ?? []}/>}
      {sections.leadership !== false && <Leadership leaders={site?.leadership ?? null}/>}
      <Recruitment content={content} open={open}/>
      {sections.gallery !== false && <Gallery items={content.gallery ?? []}/>}
      {sections.faq !== false && <Faq items={content.faq ?? []}/>}
      <FinalCall open={open}/>
    </PublicShell>
  );
}
