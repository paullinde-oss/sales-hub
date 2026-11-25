// Costs & Margins maths — run with: npm test   (made-up numbers only — real costs never go in the code)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/margins/model.js";

const settings = {
  company: { years: [{ year: "A", revenue: 1000, ga: 300 }, { year: "B", revenue: 3000, ga: 1300 }], rate: null },
  brooks: { ga: 1000, blanketShare: 75, blanketTarget: 100, blanketRate: null, wattleTarget: 50, wattleRate: null },
  tiers: { exclusive: 50, manufactured: 30, commodity: 20 }, usdRate: 1.5,
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);
const prices = { "AA1": 100, "BB2": 40 };
const priceOf = (sku, mkt) => prices[M.skuKey(sku)] != null ? (mkt === "us" ? prices[M.skuKey(sku)] * 0.8 * 1.5 : prices[M.skuKey(sku)]) : null;

test("company rate = total G&A ÷ total revenue (weighted), rounded when no rate is set", () => {
  const R = M.rates(settings);
  near(R.companyCalc, 40); assert.equal(R.companyPct, 40);
  assert.equal(M.rates({ ...settings, company: { ...settings.company, rate: 35 } }).companyPct, 35);
});
test("Brooks rates: share of G&A ÷ target volume, tipping point = pool ÷ rate used", () => {
  const R = M.rates(settings);
  near(R.blanketCalc, 7.5); near(R.wattleCalc, 5); near(R.blanketTipping, 100);
  const R2 = M.rates({ ...settings, brooks: { ...settings.brooks, blanketRate: 8 } });
  assert.equal(R2.blanketRate, 8); near(R2.blanketTipping, 93.75);
});
test("company method: overhead = % of materials + labour; margin on price", () => {
  const R = M.rates({ ...settings, company: { ...settings.company, rate: 36 } });
  const r = M.computeSku({ method: "company", tier: "manufactured" }, { sku: "AA1", materials: 40, labour: 10 }, { rates: R, priceOf });
  near(r.ml, 50); near(r.overhead, 18); near(r.cost, 68); near(r.margin, 32); assert.equal(r.status, "close"); assert.equal(r.target, 30);
});
test("blanket method: same $ per roll whatever the materials cost", () => {
  const R = M.rates({ ...settings, brooks: { ...settings.brooks, blanketRate: 8 } });
  const cheap = M.computeSku({ method: "blanket" }, { sku: "AA1", materials: 10, labour: 5 }, { rates: R, priceOf });
  const dear = M.computeSku({ method: "blanket" }, { sku: "AA1", materials: 60, labour: 5 }, { rates: R, priceOf });
  assert.equal(cheap.overhead, 8); assert.equal(dear.overhead, 8);
});
test("extra $ (shipping in) is part of the fully loaded cost", () => {
  const R = M.rates(settings);
  const r = M.computeSku({ method: "none" }, { sku: "BB2", materials: 20, labour: 2, extra: 3 }, { rates: R, priceOf });
  near(r.cost, 25); near(r.margin, 37.5);
});
test("status: losing money / under target / no cost / no price", () => {
  const R = M.rates(settings);
  assert.equal(M.computeSku({ method: "none" }, { sku: "BB2", materials: 50 }, { rates: R, priceOf }).status, "loss");
  assert.equal(M.computeSku({ method: "none", tier: "exclusive" }, { sku: "AA1", materials: 60 }, { rates: R, priceOf }).status, "under");
  assert.equal(M.computeSku({ method: "none" }, { sku: "AA1" }, { rates: R, priceOf }).status, "nocost");
  assert.equal(M.computeSku({ method: "none" }, { sku: "ZZ9", materials: 5 }, { rates: R, priceOf }).status, "noprice");
});
test("typed price is used only when the SKU isn't on the price list", () => {
  const R = M.rates(settings);
  near(M.computeSku({ method: "none" }, { sku: "ZZ9", materials: 5, manualPrice: { price: 10 } }, { rates: R, priceOf }).margin, 50);
  near(M.computeSku({ method: "none" }, { sku: "AA1", materials: 5, manualPrice: { price: 10 } }, { rates: R, priceOf }).price, 100);
});
test("itemised materials with shared prices; line labour default", () => {
  const shared = [{ id: "j", name: "Jute", price: 30 }, { id: "l", name: "Labour/roll", price: 5 }];
  const line = { method: "none", labour: { shared: "l", qty: 1 } };
  const s = { sku: "AA1", items: [{ name: "Jute", shared: "j", qty: 1 }, { name: "Straw", qty: 0.5, price: 4 }] };
  const r = M.computeSku(line, s, { rates: M.rates(settings), shared, priceOf });
  near(r.materials, 32); near(r.labour, 5); near(r.cost, 37);
  shared[0].price = 40; near(M.computeSku(line, s, { rates: M.rates(settings), shared, priceOf }).materials, 42);
});
test("USA: USD price × rate, plus commission % and tariff % of price and FOB $", () => {
  const R = M.rates(settings);
  const r = M.computeSku({ method: "none", usa: { commission: 5, fob: 4 } }, { sku: "AA1", materials: 50, usa: { tariff: 10 } }, { rates: R, priceOf, market: "us" });
  near(r.price, 120); near(r.usa.commission, 6); near(r.usa.tariff, 12); near(r.cost, 72); near(r.margin, 40);
});
test("cost list: Canada fully loaded cost + target per SKU, keeps the Income Statement link, first SKU wins", () => {
  const book = { settings: { ...settings, company: { ...settings.company, rate: 36 } }, shared: [], lines: [
    { id: "1", name: "Bags", method: "company", tier: "commodity", skus: [{ sku: "aa1", materials: 40, labour: 10 }, { sku: "BB2" }] },
    { id: "2", name: "Dup", method: "none", skus: [{ sku: "AA1", materials: 1 }] }] };
  const out = M.costList(book, { __incomeSheet: "x", __targets: { a: 1 }, OLD: { cost: 5 } }, priceOf, "Paul");
  assert.equal(out.__incomeSheet, "x"); assert.equal(out.__targets, undefined); assert.equal(out.OLD, undefined);
  assert.equal(out.AA1.cost, 68); assert.equal(out.AA1.target, 20); assert.equal(out.AA1.source, "Costs & Margins › Bags");
  assert.equal(out.BB2, undefined);
  assert.equal(M.costListDiffers(out, M.costList(book, out, priceOf)), false);
});
test("change log describes edits in plain words", () => {
  const a = { settings, shared: [], lines: [{ id: "1", name: "Bags", method: "company", skus: [{ id: "s", sku: "AA1", materials: 1 }] }] };
  const b = JSON.parse(JSON.stringify(a)); b.lines[0].skus[0].materials = 2; b.lines[0].tier = "exclusive";
  const ch = M.describeChanges(a, b).map(x => x.slice(0, 2).join(" / "));
  assert.ok(ch.includes("Bags / AA1 · materials")); assert.ok(ch.includes("Bags / Target"));
});
