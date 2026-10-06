import {expect, test} from "@playwright/test";
import {checkLicense, modelMatches, parseDate, parseLicense, plateKey} from "../src/lib/license-ocr/parse";

// What Tesseract really returned for an in-game licence screenshot (accents and some
// letters misread, background noise appended).
const SAMPLE = [
  "i TRAFFIC LICENSE", "Név: BMW M3 680", "Y KM: 3.060km", "Rendsz. -GOBLIN- Poy", "7 Alvézsz: HOWTKIBVIVAL met 8",
  "1k Szin: Elsédleges / aay", "Lejér: 2026.09.20. are", "Killit6: Repair Kit Co.", "Tuning(ok): Hizd ide az egeret",
].map((text) => ({text, confidence: 80}));

const vehicle = {plate: "GOBLIN", model: "BMW M3 G80", registration_expires_on: "2026-08-20"};

test.describe("licence reading", () => {
  test("labels are recognised despite OCR errors and noise", () => {
    const reading = parseLicense(SAMPLE);
    expect(reading).toMatchObject({model: "BMW M3 680", plate: "GOBLIN", expiresOn: "2026-09-20"});
    expect(reading.labels).toBeGreaterThanOrEqual(7);
  });

  test("a matching licence can be applied; anything else needs a review", () => {
    const reading = parseLicense(SAMPLE);
    expect(checkLicense(reading, vehicle, "2026-09-01")).toMatchObject({verdict: "match", expiresOn: "2026-09-20", plate: "GOBLIN"});
    const other = checkLicense(reading, {...vehicle, plate: "SFSD-012"}, "2026-09-01");
    expect(other.verdict).toBe("mismatch");
    expect(other.problems[0]).toContain("nem egyezik a jármű rendszámával (SFSD-012)");
    expect(checkLicense(reading, vehicle, "2026-09-25").verdict).toBe("expired");
    expect(checkLicense(reading, {...vehicle, registration_expires_on: "2026-09-20"}, "2026-09-01").verdict).toBe("unchanged");
    expect(checkLicense(reading, {...vehicle, registration_expires_on: "2026-10-20"}, "2026-09-01").verdict).toBe("stale");
    expect(checkLicense(parseLicense([{text: "szia mindenki", confidence: 90}]), vehicle, "2026-09-01").verdict).toBe("unreadable");
  });

  test("names of the stock match the in-game names, other types do not", () => {
    expect(modelMatches("Dodge Charger", "Dodge Charger SRT 2015")).toBe(true);
    expect(modelMatches("Dodge Durango 2014", "Dodge Durango '14")).toBe(true);
    expect(modelMatches("Chevrolet Tahoe", "Chevrolet Tahoe Unmarked")).toBe(true);
    expect(modelMatches("Chevrolet Corvette", "Chevrolett Corvette")).toBe(true);
    expect(modelMatches("Dodge Demon SRT", "Dodge Charger SRT 2015")).toBe(false);
    expect(modelMatches("Ford Crown Victoria", "Ford Explorer")).toBe(false);
  });

  test("plates and dates survive look-alike characters", () => {
    expect(plateKey("-SFSD-0I2-")).toBe(plateKey("SFSD-012"));
    expect(plateKey("SFSD-013")).not.toBe(plateKey("SFSD-012"));
    expect(parseDate("2026.09.20.")).toBe("2026-09-20");
    expect(parseDate("2O26. 9. 2O")).toBe("2026-09-20");
    expect(parseDate("20.09.2026")).toBe("2026-09-20");
    expect(parseDate("2026.02.30.")).toBeNull();
  });
});
