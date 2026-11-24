// ─── Products & Price List → Costs & Margins ─────────────────────────────────
// Two views: Overview (every SKU's cost from the calculators + margin vs the category target) and
// Calculators (the Cost Calculator — the only place costs come from). Cost viewers only.
import { useEffect, useRef } from "react";
import { Loader } from "../Loader";
import CostsView, { CostGate } from "../pricelist/CostsView";
import CostCalculator from "./CostCalculator";
import { costMapFromBook, costsDiffer } from "./sync";

export default function CostsArea({ T, costs, costBook, loginName, productsCAD, productsUSD, hubUsdRate, categories, categoryOrder, focusSku, setFocus, onFocusDone, view, setView }) {
  // Opened from a product page → straight to the calculators
  useEffect(() => { if (focusSku) setView("calc"); }, [focusSku]); // eslint-disable-line

  // Keep the cost list exactly what the calculators give: clears costs typed in before, and follows
  // price changes for "% of price" lines. Only once both are open, and only with calculators present.
  const syncing = useRef(false);
  useEffect(() => {
    if (syncing.current || costs.status !== "ready" || costBook.status !== "ready" || !costBook.book?.calcs?.length || !productsCAD.length) return;
    const next = costMapFromBook(costBook.book, costs.costs || {}, productsCAD, productsUSD, hubUsdRate, "Cost Calculator");
    if (!costsDiffer(costs.costs || {}, next)) return;
    syncing.current = true;
    costs.save(next, loginName).catch(e => console.warn("Couldn't update costs from the calculators:", e)).finally(() => { syncing.current = false; });
  }, [costs.status, costs.costs, costBook.status, costBook.book, productsCAD, productsUSD]); // eslint-disable-line

  const tab = (k, l) => <button key={k} onClick={() => setView(k)} style={{ background: view === k ? T.activeBg : "transparent", border: `1px solid ${view === k ? T.borderLight : "transparent"}`,
    color: view === k ? T.gold : T.subtext, padding: "4px 12px", fontSize: 11, borderRadius: 2, cursor: "pointer" }}>{l}</button>;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "8px 16px 0" }}>{tab("overview", "Overview")}{tab("calc", "Calculators")}</div>
      {view === "calc"
        ? <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}><CostGate T={T} costs={costs}>
            {costBook.status !== "ready" ? <div style={{ padding: 16, fontSize: 12, color: T.tableHeadText }}>{costBook.status === "locked" ? "The calculators are locked — sign out and back in with your own password." : <Loader T={T} label="Loading the calculators…" />}</div>
              : <CostCalculator T={T} book={costBook} saveBook={costBook.save} costs={costs} loginName={loginName} productsCAD={productsCAD} productsUSD={productsUSD} hubUsdRate={hubUsdRate} focusSku={focusSku} onFocusDone={onFocusDone} categories={categories} />}
          </CostGate></div>
        : <div style={{ flex: 1, overflow: "auto", padding: 16 }}><CostGate T={T} costs={costs}>
            <CostsView T={T} costs={costs} loginName={loginName} products={productsCAD} categories={categories} categoryOrder={categoryOrder} onOpenCalc={sku => setFocus(sku)} />
          </CostGate></div>}
    </div>
  );
}
