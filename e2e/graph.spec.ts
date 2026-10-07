import {expect, test} from "@playwright/test";
import {login, mockSupabase} from "./support/mock-supabase";

const GRAPH = {
  center: "person:p1", truncated: false,
  nodes: [
    {key: "person:p1", kind: "person", id: "p1", label: "Tony Montana", alias: "Scarface", status: "wanted"},
    {key: "person:p2", kind: "person", id: "p2", label: "Manny Ribera", status: "free"},
    {key: "plate:5F4821", kind: "plate", label: "SF-4821", title: "Sultan · fekete"},
    {key: "org:o1", kind: "org", id: "o1", label: "Montana Kartell", color: "#dc2626"},
  ],
  edges: [
    {source: "person:p1", target: "person:p2", label: "jobbkéz"},
    {source: "person:p1", target: "plate:5F4821", label: "Sultan"},
    {source: "person:p2", target: "plate:5F4821", label: "Sultan"},
    {source: "org:o1", target: "person:p1", label: "leader"},
  ],
};

test("investigators walk the relationship graph", async ({page}) => {
  const mock = await mockSupabase(page, {
    rpc: {get_relationship_graph: GRAPH, search_graph_nodes: [{key: "person:p2", kind: "person", label: "Manny Ribera", title: null}]},
  });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/mcb/graph?node=person%3Ap1");

  await expect(page.getByRole("button", {name: "Személy: Tony Montana (körözött)"})).toBeVisible();
  // The centre is selected: its links are listed in Hungarian (the role in the organisation, too).
  const panel = page.locator("aside");
  await expect(panel.getByText("Kapcsolatok (3)")).toBeVisible();
  await expect(panel.getByText("Vezető")).toBeVisible();

  await page.getByRole("button", {name: "Jármű: SF-4821"}).click();
  await expect(panel.getByText("Kapcsolatok (2)")).toBeVisible();
  expect(mock.requests.find((request) => request.name === "get_relationship_graph")?.body).toEqual({_key: "person:p1", _depth: 2});

  await page.getByRole("button", {name: "Lista"}).click();
  await expect(page.getByRole("row", {name: /^Montana Kartell/})).toBeVisible();

  await page.getByLabel("Kezdőpont keresése").fill("manny");
  await page.getByRole("list", {name: "Találatok"}).getByRole("button", {name: /Manny Ribera/}).click();
  await expect(page).toHaveURL(/node=person%3Ap2/);
  await expect.poll(() => mock.requests.filter((request) => request.name === "search_graph_nodes").map((request) => request.body?._query)).toContain("manny");
});
