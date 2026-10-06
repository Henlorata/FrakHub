import {expect, test} from "@playwright/test";
import {cleanDocumentNumber, cleanName, findLabels, fullName, parseCitizen, vote, type OcrWordLike} from "../src/lib/citizen-ocr/parse";

/**
 * Word boxes laid out like Tesseract returns them for a 1080p screenshot of the in-game tablet's
 * "Polgárok" page (made-up person; accents misread as in real passes).
 */
const word = (text: string, x0: number, y0: number, x1: number, y1 = y0 + 13, confidence = 90): OcrWordLike =>
  ({text, confidence, bbox: {x0, y0, x1, y1}});

const PAGE: OcrWordLike[] = [
  word("Polgarok", 721, 305, 800, 322),
  word("Q", 732, 341, 745, 355), word("John", 758, 341, 788, 355), word("Doe", 792, 341, 818, 355),
  word("Informaciok", 811, 380, 898, 395),
  word("Keresztnév", 871, 409, 937), word("John", 948, 409, 978),
  word("Vezetéknév", 1163, 409, 1228), word("Doe", 1242, 409, 1266),
  word("Jogositvany", 866, 439, 936), word("C4F-1A2-9B0", 948, 439, 1024),
  word("Személyi", 1179, 439, 1229), word("7E-0D1-A3", 1242, 439, 1302),
  word("Egészségiigyi", 749, 491, 826), word("sorszama", 830, 491, 886), word("5B2-E8-F14", 899, 491, 966),
  word("Jogositvany", 1118, 491, 1185), word("eltiltas", 1189, 491, 1229), word("N/A", 1242, 491, 1265),
  word("Munkahely", 961, 521, 1023), word("kamionos,", 1035, 521, 1093), word("San", 1097, 521, 1119), word("Fierro", 1123, 521, 1158),
  // The status bar at the bottom of the game window: not the person's data.
  word("John", 1402, 1066, 1430), word("Doe", 1434, 1066, 1458), word("(AccountID:", 1462, 1066, 1530), word("123456)", 1534, 1066, 1580),
];

const EXPECTED = {firstName: "John", lastName: "Doe", license: "C4F-1A2-9B0", idCard: "7E-0D1-A3", medical: "5B2-E8-F14"};

test.describe("citizen record reading", () => {
  test("every field is read next to its label", () => {
    expect(parseCitizen(PAGE).values).toEqual(EXPECTED);
  });

  test("the position does not matter: a cropped, shifted picture reads the same", () => {
    const shifted = PAGE.map((item) => ({...item, bbox: {x0: item.bbox.x0 - 700, y0: item.bbox.y0 - 370, x1: item.bbox.x1 - 700, y1: item.bbox.y1 - 370}}));
    expect(parseCitizen(shifted).values).toEqual(EXPECTED);
  });

  test("labels cut off the picture leave their fields empty", () => {
    // Only the right column: "Keresztnév", "Jogosítvány" and "Egészségügyi sorszáma" are outside.
    const right = PAGE.filter((item) => item.bbox.x0 >= 1100 && item.bbox.y0 < 600);
    const reading = parseCitizen(right);
    expect(reading.values).toEqual({lastName: "Doe", idCard: "7E-0D1-A3"});
    // "Jogosítvány eltiltás" is not the licence.
    expect(reading.labels.map((label) => label.field).sort()).toEqual(["idCard", "lastName"]);
  });

  test("a misread 'eltiltás' still marks the licence ban row", () => {
    const misread = PAGE.filter((item) => item.bbox.x0 >= 1100 && item.bbox.y0 < 600)
      .map((item) => (item.text === "eltiltas" ? {...item, text: "eltitds"} : item));
    expect(findLabels(misread).some((label) => label.field === "license")).toBe(false);
  });

  test("the medical number also reads when only 'sorszáma' is on the picture", () => {
    const cut = PAGE.filter((item) => item.text !== "Egészségiigyi");
    expect(parseCitizen(cut).values.medical).toBe("5B2-E8-F14");
  });

  test("document numbers: three groups of hexadecimal digits, look-alikes folded", () => {
    expect(cleanDocumentNumber("bed-c62 -f95")).toBe("BED-C62-F95");
    expect(cleanDocumentNumber("BED—C62—F95")).toBe("BED-C62-F95");
    expect(cleanDocumentNumber("C4F-IA2-9BO")).toBe("C4F-1A2-9B0");
    expect(cleanDocumentNumber("BEDC62-F95")).toBe("BED-C62-F95");
    expect(cleanDocumentNumber("A2-A3C-477")).toBe("A2-A3C-477");
    expect(cleanDocumentNumber("N/A")).toBeNull();
    expect(cleanDocumentNumber("A2A3C477")).toBeNull();
    expect(cleanDocumentNumber("ABCD-12-3")).toBeNull();
    expect(cleanDocumentNumber("")).toBeNull();
  });

  test("names keep letters only; misreadings are rejected, not guessed", () => {
    expect(cleanName("Adolf")).toBe("Adolf");
    expect(cleanName("De La Cruz")).toBe("De La Cruz");
    expect(cleanName("O'Neil |")).toBe("O'Neil");
    expect(cleanName("Garc1a")).toBeNull();
    expect(cleanName("Adolf l")).toBeNull();
    expect(cleanName("Keresztnév")).toBeNull();
    expect(fullName("Adolf", "Garcia")).toBe("Adolf Garcia");
    expect(fullName(null, "Garcia")).toBe("Garcia");
  });

  test("readings vote; disagreement is reported", () => {
    expect(vote(["BED-C62-F35", "BED-C62-F95", "BED-C62-F95"])).toEqual({value: "BED-C62-F95", certain: false});
    expect(vote(["A2-A3C-477", null, "A2-A3C-477"])).toEqual({value: "A2-A3C-477", certain: true});
    expect(vote(["X", "Y"])).toEqual({value: "X", certain: false});
    expect(vote([null, undefined])).toEqual({value: null, certain: false});
  });
});
