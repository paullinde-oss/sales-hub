import { useState, useRef, useEffect, useMemo, useCallback } from "react";

// ─── Themes ───────────────────────────────────────────────────────────────────
const DARK = {
  bg:"#0f0f0f", headerBg:"#080808", activeBg:"#141414",
  panelBg:"#0a0a0a", cardBg:"#111", inputBg:"#1c1c1c", rowHover:"#131313",
  border:"#1a1a1a", borderMid:"#222", borderLight:"#2e2e2e",
  text:"#e8e8e8", subtext:"#ccc", muted:"#3a3a3a", subtle:"#383838",
  btnBg:"#1a1a1a", btnBorder:"#333", btnText:"#ccc",
  gold:"#c8a96e", accent:"#c8a96e",
  tableHead:"#0d0d0d", tableHeadText:"#666",
  sectionLabel:"#555", tag:"#141414", tagBorder:"#202020", tagText:"#888",
};
const LIGHT = {
  bg:"#f2f2f0", headerBg:"#ffffff", activeBg:"#ebebea",
  panelBg:"#f8f8f6", cardBg:"#ffffff", inputBg:"#ffffff", rowHover:"#f5f5f3",
  border:"#d8d8d4", borderMid:"#c8c8c4", borderLight:"#d0d0cc",
  text:"#111111", subtext:"#2a2a2a", muted:"#999", subtle:"#bbb",
  btnBg:"#ffffff", btnBorder:"#c0c0bc", btnText:"#333",
  gold:"#a07828", accent:"#a07828",
  tableHead:"#e8e8e5", tableHeadText:"#666",
  sectionLabel:"#888", tag:"#e8e8e5", tagBorder:"#ccc", tagText:"#555",
  inputBorder:"#b0b0ac", inputBorderFocus:"#a07828",
  fieldBg:"#ffffff", fieldBorder:"#b8b8b4",
};

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ name, size=18, color="currentColor" }) => {
  const paths = {
    quote: <><rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.5" fill="none"/><line x1="7" y1="8" x2="17" y2="8" stroke={color} strokeWidth="1.5"/><line x1="7" y1="12" x2="14" y2="12" stroke={color} strokeWidth="1.5"/><line x1="7" y1="16" x2="11" y2="16" stroke={color} strokeWidth="1.5"/></>,
    dims: <><rect x="3" y="3" width="7" height="7" stroke={color} strokeWidth="1.5" fill="none"/><rect x="14" y="3" width="7" height="7" stroke={color} strokeWidth="1.5" fill="none"/><rect x="3" y="14" width="7" height="7" stroke={color} strokeWidth="1.5" fill="none"/><rect x="14" y="14" width="7" height="7" stroke={color} strokeWidth="1.5" fill="none"/></>,
    ship: <><path d="M3 17l2-8h14l2 8H3z" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 9V5h8v4" stroke={color} strokeWidth="1.5" fill="none"/><line x1="12" y1="5" x2="12" y2="3" stroke={color} strokeWidth="1.5"/><path d="M3 17c0 1.1.9 2 2 2s2-.9 2-2 .9-2 2-2 2 .9 2 2 .9 2 2 2 2-.9 2-2 .9-2 2-2 2 .9 2 2" stroke={color} strokeWidth="1.5" fill="none"/></>,
    products: <><line x1="8" y1="6" x2="21" y2="6" stroke={color} strokeWidth="1.5"/><line x1="8" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5"/><line x1="8" y1="18" x2="21" y2="18" stroke={color} strokeWidth="1.5"/><line x1="3" y1="6" x2="3.01" y2="6" stroke={color} strokeWidth="2"/><line x1="3" y1="12" x2="3.01" y2="12" stroke={color} strokeWidth="2"/><line x1="3" y1="18" x2="3.01" y2="18" stroke={color} strokeWidth="2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">{paths[name]}</svg>;
};

// ─── Product Data ──────────────────────────────────────────────────────────────
const INITIAL_PRODUCTS_CAD = [
  { sku:"4CBD2416HF", product:"CB Donut - 24x16 HF", description:"CB Donut High Flow Yellow for 24 x 16 Grate", truck:"", pkg:12, pallet:192, price:60.0, palletPrice:56.5, prepaid:63.0, prepaidPallet:61.0, truckPrice:"" },
  { sku:"4CBD2416LF", product:"CB Donut - 24x16 LF", description:"CB Donut Low Flow Grey for 24 x 16 Grate", truck:"", pkg:12, pallet:192, price:58.0, palletPrice:54.5, prepaid:61.0, prepaidPallet:58.0, truckPrice:"" },
  { sku:"4CBD2424HF", product:"CB Donut - 24x24 HF", description:"CB Donut High Flow Yellow for 24 x 24 Grate", truck:"", pkg:12, pallet:192, price:60.0, palletPrice:56.5, prepaid:63.0, prepaidPallet:61.0, truckPrice:"" },
  { sku:"4CBD2424LF", product:"CB Donut - 24x24 LF", description:"CB Donut Low Flow Grey for 24 x 24 Grate", truck:"", pkg:12, pallet:192, price:58.0, palletPrice:54.5, prepaid:61.0, prepaidPallet:58.0, truckPrice:"" },
  { sku:"4CBD21DIAHF", product:"CB Donut - 21 Round HF", description:"CB Round Donut High Flow Yellow for 21 Dia. Grate", truck:"", pkg:12, pallet:192, price:65.0, palletPrice:62.0, prepaid:70.0, prepaidPallet:66.0, truckPrice:"" },
  { sku:"4CBD24DIAHF", product:"CB Donut - 24 Round HF", description:"CB Round Donut High Flow Yellow for 24 Dia. Grate", truck:"", pkg:12, pallet:192, price:65.0, palletPrice:62.0, prepaid:70.0, prepaidPallet:66.0, truckPrice:"" },
  { sku:"SSC2118HF", product:"Silt Sack", description:"Silt Sack High Flow Yellow Fabric for 21 x 18 Grate", truck:"", pkg:15, pallet:150, price:69.0, palletPrice:65.0, prepaid:72.0, prepaidPallet:69.0, truckPrice:"" },
  { sku:"DDS2424OF", product:"CB Sack", description:"Orange CB Sack with Overflow", truck:"", pkg:15, pallet:180, price:59.0, palletPrice:55.5, prepaid:62.0, prepaidPallet:59.0, truckPrice:"" },
  { sku:"DGD3648", product:"Drain Guard", description:"36 x 48 Drain Guard", truck:"", pkg:15, pallet:150, price:41.0, palletPrice:39.0, prepaid:44.0, prepaidPallet:42.0, truckPrice:"" },
  { sku:"CBW8009", product:"CB Log", description:"7.5' x 9 Catch Basin Log", truck:"", pkg:1, pallet:30, price:49.0, palletPrice:47.0, prepaid:56.5, prepaidPallet:54.5, truckPrice:"" },
  { sku:"CIF6048", product:"CB Sock - Curb Inlet Filter", description:"4' x 6 Curb Inlet Filter", truck:"", pkg:1, pallet:96, price:43.0, palletPrice:38.0, prepaid:48.0, prepaidPallet:46.0, truckPrice:"" },
  { sku:"OOF2230", product:"CB Mat - Oil Only", description:"Oil Only Catch Basin Mat", truck:"", pkg:12, pallet:120, price:44.0, palletPrice:42.0, prepaid:47.0, prepaidPallet:43.0, truckPrice:"" },
  { sku:"OOF4806", product:"CB Tube - Oil Only", description:"Oil Only Catch Basin Tube 6 Diameter x 48 Length", truck:"", pkg:1, pallet:48, price:50.0, palletPrice:48.0, prepaid:56.5, prepaidPallet:53.5, truckPrice:"" },
  { sku:"SPB1206G", product:"Spring Berm - Green", description:"Spring Berm 12 x 6' Green Mesh", truck:"", pkg:6, pallet:270, price:33.5, palletPrice:31.5, prepaid:35.5, prepaidPallet:33.5, truckPrice:"" },
  { sku:"SBG2509", product:"Dewatering Silt Bag", description:"2.5' x 9' Dewatering Silt Bag - 6 Inlet", truck:"", pkg:15, pallet:220, price:28.0, palletPrice:26.0, prepaid:31.5, prepaidPallet:29.0, truckPrice:"" },
  { sku:"SBG0506", product:"Dewatering Silt Bag", description:"5' x 6' Dewatering Silt Bag - 6 Inlet", truck:"", pkg:12, pallet:216, price:29.0, palletPrice:27.0, prepaid:32.5, prepaidPallet:30.0, truckPrice:"" },
  { sku:"SBG0510", product:"Dewatering Silt Bag", description:"5' x 10' Dewatering Silt Bag - 6 Inlet", truck:"", pkg:6, pallet:51, price:41.0, palletPrice:39.0, prepaid:45.0, prepaidPallet:42.0, truckPrice:"" },
  { sku:"SBG0515", product:"Dewatering Silt Bag", description:"5' x 15' Dewatering Silt Bag - 8 Inlet", truck:"", pkg:4, pallet:96, price:52.5, palletPrice:48.0, prepaid:56.5, prepaidPallet:52.5, truckPrice:"" },
  { sku:"SBG1010", product:"Dewatering Silt Bag", description:"10' x 10' Dewatering Silt Bag - 8 Inlet", truck:"", pkg:2, pallet:56, price:110.0, palletPrice:107.0, prepaid:115.5, prepaidPallet:112.0, truckPrice:"" },
  { sku:"SBG1015", product:"Dewatering Silt Bag", description:"10' x 15' Dewatering Silt Bag - 8 Inlet", truck:"", pkg:4, pallet:48, price:142.0, palletPrice:137.5, prepaid:147.0, prepaidPallet:143.0, truckPrice:"" },
  { sku:"SBG1020", product:"Dewatering Silt Bag", description:"10' x 20' Dewatering Silt Bag - 8 Inlet", truck:"", pkg:3, pallet:36, price:170.0, palletPrice:167.0, prepaid:175.0, prepaidPallet:172.0, truckPrice:"" },
  { sku:"SBG2020", product:"Dewatering Silt Bag", description:"20' x 20' Dewatering Silt Bag - 8 Inlet", truck:"", pkg:2, pallet:20, price:357.0, palletPrice:346.5, prepaid:362.0, prepaidPallet:352.0, truckPrice:"" },
  { sku:"SBG2030", product:"Dewatering Silt Bag", description:"20' x 30' Dewatering Silt Bag - 8 Inlet", truck:"", pkg:1, pallet:10, price:396.0, palletPrice:384.0, prepaid:401.0, prepaidPallet:390.5, truckPrice:"" },
  { sku:"HN2027", product:"HydroNest Small", description:"20 x 27 HyrdroNest Spill Absorbent Containment Berm - 2L Capacity", truck:"", pkg:6, pallet:216, price:154.0, palletPrice:154.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"HN3927", product:"HydroNest Medium", description:"39 x 27 HyrdroNest Spill Absorbent Containment Berm - 4.5L Capacity", truck:"", pkg:4, pallet:144, price:268.0, palletPrice:268.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"HN7945", product:"HydroNest Large", description:"79 x 54 HyrdroNest Spill Absorbent Containment Berm - 16L Capacity", truck:"", pkg:1, pallet:36, price:700.0, palletPrice:700.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"HNL2027", product:"HydroNest - Liner", description:"20 x 27 HyrdroNest Spill Absorbent Liner - 2L Capacity", truck:"", pkg:"", pallet:"", price:40.0, palletPrice:40.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"HNL3927", product:"HydroNest - Liner", description:"39 x 27 HyrdroNest Spill Absorbent Liner - 4.5L Capacity", truck:"", pkg:"", pallet:"", price:67.0, palletPrice:67.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"HNL7954", product:"HydroNest - Liner", description:"79 x 54 HyrdroNest Spill Absorbent Liner - 16L Capacity", truck:"", pkg:"", pallet:"", price:250.0, palletPrice:250.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"SCB0404", product:"Spill Containment Berm", description:"48 x 48 - Traditional Spill Containment Berm", truck:"", pkg:1, pallet:60, price:163.0, palletPrice:152.0, prepaid:168.0, prepaidPallet:157.5, truckPrice:"" },
  { sku:"SCB0406", product:"Spill Containment Berm", description:"48 x 72 - Traditional Spill Containment Berm", truck:"", pkg:1, pallet:50, price:194.0, palletPrice:184.0, prepaid:199.5, prepaidPallet:189.0, truckPrice:"" },
  { sku:"SCB0708", product:"Spill Containment Berm", description:"84 x 96 - Traditional Spill Containment Berm", truck:"", pkg:1, pallet:30, price:257.0, palletPrice:247.0, prepaid:262.5, prepaidPallet:252.0, truckPrice:"" },
  { sku:"TBC2.550T1IND", product:"Turbidity Curtain", description:"2.5' x 50' Turbidity Curtain Type 1 IND", truck:"", pkg:1, pallet:12, price:625.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC0550T1IND", product:"Turbidity Curtain", description:"5' x 50' Turbidity Curtain Type 1 IND", truck:"", pkg:1, pallet:12, price:656.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC7550T1IND", product:"Turbidity Curtain", description:"7.5' x 50' Turbidity Curtain Type 1 IND", truck:"", pkg:1, pallet:12, price:782.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1050T1IND", product:"Turbidity Curtain", description:"10' x 50' Turbidity Curtain Type 1 IND", truck:"", pkg:1, pallet:12, price:871.5, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1250T1IND", product:"Turbidity Curtain", description:"12.5' x 50' Turbidity Curtain Type 1 IND", truck:"", pkg:1, pallet:11, price:960.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1550T1IND", product:"Turbidity Curtain", description:"15' x 50' Turbidity Curtain Type 1 IND", truck:"", pkg:1, pallet:9, price:1070.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2.550T1DOT", product:"Turbidity Curtain", description:"2.5' x 50' Turbidity Curtain Type 1 DOT", truck:"", pkg:1, pallet:12, price:620.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC0550T1DOT", product:"Turbidity Curtain", description:"5' x 50' Turbidity Curtain Type 1 DOT", truck:"", pkg:1, pallet:12, price:651.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC7550T1DOT", product:"Turbidity Curtain", description:"7.5' x 50' Turbidity Curtain Type 1 DOT", truck:"", pkg:1, pallet:11, price:777.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1050T1DOT", product:"Turbidity Curtain", description:"10' x 50' Turbidity Curtain Type 1 DOT", truck:"", pkg:1, pallet:11, price:971.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1250T1DOT", product:"Turbidity Curtain", description:"12.5' x 50' Turbidity Curtain Type 1 DOT", truck:"", pkg:1, pallet:11, price:1060.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1550T1DOT", product:"Turbidity Curtain", description:"15' x 50' Turbidity Curtain Type 1 DOT", truck:"", pkg:1, pallet:10, price:1330.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC3050T1DOT", product:"Turbidity Curtain", description:"30' x 50' Turbidity Curtain Type 1 DOT", truck:"", pkg:1, pallet:8, price:2350.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2550T2IND", product:"Turbidity Curtain", description:"2.5' x 50' Turbidity Curtain Type 2 IND", truck:"", pkg:1, pallet:9, price:810.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC0550T2IND", product:"Turbidity Curtain", description:"5' x 50' Turbidity Curtain Type 2 IND", truck:"", pkg:1, pallet:9, price:861.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC7550T2IND", product:"Turbidity Curtain", description:"7.5' x 50' Turbidity Curtain Type 2 IND", truck:"", pkg:1, pallet:9, price:1003.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1050T2IND", product:"Turbidity Curtain", description:"10' x 50' Turbidity Curtain Type 2 IND", truck:"", pkg:1, pallet:8, price:1102.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1250T2IND", product:"Turbidity Curtain", description:"12.5' x 50' Turbidity Curtain Type 2 IND", truck:"", pkg:1, pallet:8, price:1210.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1550T2IND", product:"Turbidity Curtain", description:"15' x 50' Turbidity Curtain Type 2 IND", truck:"", pkg:1, pallet:7, price:1400.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2050T2IND", product:"Turbidity Curtain", description:"20' x 50' Turbidity Curtain Type 2 IND", truck:"", pkg:1, pallet:6, price:1650.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2.550T2DOT", product:"Turbidity Curtain", description:"2.5' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:10, price:855.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC0550T2DOT", product:"Turbidity Curtain", description:"5' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:10, price:861.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC7550T2DOT", product:"Turbidity Curtain", description:"7.5' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:10, price:1018.5, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1050T2DOT", product:"Turbidity Curtain", description:"10' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:9, price:1249.5, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1250T2DOT", product:"Turbidity Curtain", description:"12.5' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:8, price:1460.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1550T2DOT", product:"Turbidity Curtain", description:"15' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:8, price:1550.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2050T2DOT", product:"Turbidity Curtain", description:"20' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:7, price:2470.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2550T2DOT", product:"Turbidity Curtain", description:"25' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:7, price:2810.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC3050T2DOT", product:"Turbidity Curtain", description:"30' x 50' Turbidity Curtain Type 2 DOT", truck:"", pkg:1, pallet:6, price:3210.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2.550T3DOT", product:"Turbidity Curtain", description:"2.5' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:9, price:1083.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC0550T3DOT", product:"Turbidity Curtain", description:"5' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:9, price:1118.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC7550T3DOT", product:"Turbidity Curtain", description:"7.5' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:9, price:1181.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1050T3DOT", product:"Turbidity Curtain", description:"10' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:8, price:1612.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1250T3DOT", product:"Turbidity Curtain", description:"12.5' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:7, price:1685.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC1550T3DOT", product:"Turbidity Curtain", description:"15' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:7, price:1997.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2050T3DOT", product:"Turbidity Curtain", description:"20' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:6, price:2635.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC2550T3DOT", product:"Turbidity Curtain", description:"25' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:"-", price:2950.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TBC3050T3DOT", product:"Turbidity Curtain", description:"30' x 50' Turbidity Curtain Type 3 DOT", truck:"", pkg:1, pallet:"-", price:3300.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"OCB1850", product:"Turbidity Curtain", description:"18 x 50' Containment Boom 22oz", truck:"", pkg:1, pallet:16, price:651.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"OCB1250", product:"Turbidity Curtain", description:"12 x 50' Containment Boom 22oz", truck:"", pkg:1, pallet:16, price:635.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BAK14LBS", product:"Turbidity Curtain", description:"14 lbs Anchor Kit", truck:"", pkg:1, pallet:1, price:292.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BAK25LBS", product:"Turbidity Curtain", description:"25 lbs Anchor Kit", truck:"", pkg:1, pallet:1, price:329.5, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BAK40LBS", product:"Turbidity Curtain", description:"40 lbs Anchor Kit", truck:"", pkg:1, pallet:1, price:423.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TOWBRI12", product:"Turbidity Curtain", description:"12 Tow Bridle Pair", truck:"", pkg:1, pallet:1, price:88.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"TOWBRI24", product:"Turbidity Curtain", description:"24 Tow Bridle Pair", truck:"", pkg:1, pallet:1, price:105.0, palletPrice:"", prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BMP-SSNS08", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:34.5, prepaid:"", prepaidPallet:"", truckPrice:30.0 },
  { sku:"BMP-SSNS16", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:69.0, prepaid:"", prepaidPallet:"", truckPrice:60.0 },
  { sku:"BMP-SSNS08JR", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:173.0, prepaid:"", prepaidPallet:"", truckPrice:150.5 },
  { sku:"BMP-SSNS16JR", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:346.5, prepaid:"", prepaidPallet:"", truckPrice:301.0 },
  { sku:"BMP-SDNS08", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:38.0, prepaid:"", prepaidPallet:"", truckPrice:33.0 },
  { sku:"BMP-SDNS16", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:76.5, prepaid:"", prepaidPallet:"", truckPrice:66.5 },
  { sku:"BMP-SDNS08JR", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:192.0, prepaid:"", prepaidPallet:"", truckPrice:167.0 },
  { sku:"BMP-SDNS16JR", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:385.0, prepaid:"", prepaidPallet:"", truckPrice:334.0 },
  { sku:"BMP-SDNSC08", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:67.0, prepaid:"", prepaidPallet:"", truckPrice:58.0 },
  { sku:"BMP-SDNSC16", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:76.5, prepaid:"", prepaidPallet:"", truckPrice:117.0 },
  { sku:"BMP-SDNSC08JR", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:192.0, prepaid:"", prepaidPallet:"", truckPrice:299.0 },
  { sku:"BMP-SDNSC16JR", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:385.0, prepaid:"", prepaidPallet:"", truckPrice:598.5 },
  { sku:"BMP-SDNC08", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:98.0, prepaid:"", prepaidPallet:"", truckPrice:85.0 },
  { sku:"BMP-SDNC16", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:196.0, prepaid:"", prepaidPallet:"", truckPrice:170.5 },
  { sku:"BMP-SDNC08JR", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:498.0, prepaid:"", prepaidPallet:"", truckPrice:426.0 },
  { sku:"BMP-SDNC16JR", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:997.5, prepaid:"", prepaidPallet:"", truckPrice:852.5 },
  { sku:"BMP-BDNS08", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:94.5, prepaid:"", prepaidPallet:"", truckPrice:82.5 },
  { sku:"BMP-BDNS16", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:189.75, prepaid:"", prepaidPallet:"", truckPrice:165.0 },
  { sku:"BMP- BDNS08JR", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:472.0, prepaid:"", prepaidPallet:"", truckPrice:412.0 },
  { sku:"BMP-BDNS16JR", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:945.0, prepaid:"", prepaidPallet:"", truckPrice:824.0 },
  { sku:"BMP-BDNSC08", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:95.75, prepaid:"", prepaidPallet:"", truckPrice:83.25 },
  { sku:"BMP-BDNSC16", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket - 16' x 112.5' (1000sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:190.0, prepaid:"", prepaidPallet:"", truckPrice:166.5 },
  { sku:"BMP-BDNSC08JR", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:478.0, prepaid:"", prepaidPallet:"", truckPrice:416.25 },
  { sku:"BMP-BDNSC16JR", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:956.0, prepaid:"", prepaidPallet:"", truckPrice:832.0 },
  { sku:"BMP-BDNC08", product:"Biodegradable (Jute) - Double Net - 100% Coconut", description:"Bio-Double Net Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:133.5, prepaid:"", prepaidPallet:"", truckPrice:116.5 },
  { sku:"BMP-BDNC16", product:"Biodegradable (Jute) - Double Net - 100% Coconut", description:"Bio-Double Net Coconut Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:267.75, prepaid:"", prepaidPallet:"", truckPrice:233.0 },
  { sku:"BMP-BDNC08JR", product:"Biodegradable (Jute) - Double Net - 100% Coconut", description:"Bio-Double Net Coconut Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:669.0, prepaid:"", prepaidPallet:"", truckPrice:582.5 },
  { sku:"BMP-BDNC16JR", product:"Biodegradable (Jute) - Double Net - 100% Coconut", description:"Bio-Double Net Coconut Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:1339.0, prepaid:"", prepaidPallet:"", truckPrice:1165.0 },
  { sku:"BMPSTK06", product:"ECB Stake", description:"6 BMP Stake - 100% biodegradable hardwood stake", truck:"", pkg:1000, pallet:40, price:144.0, palletPrice:136.5, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BMPSTK12", product:"ECB Stake", description:"12 BMP Stake - 100% biodegradable hardwood stake", truck:"", pkg:500, pallet:40, price:144.0, palletPrice:136.5, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BMPSTP06", product:"ECB Staple", description:"6 BMP U Staple - 6 x 1 - heavy duty metal U-shaped staple (11 gauge)", truck:"", pkg:1000, pallet:100, price:44.0, palletPrice:39.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BMP-SDNAE08", product:"Standard (Plastic) - Double Net - 100% Aspen Exelsior", description:"Std (Plastic) Double Net Aspen Excelsior Blanket - 8' x 112.5' (100sy / 83m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:113.0, prepaid:"", prepaidPallet:"", truckPrice:99.0 },
  { sku:"BMP-SDNAE16", product:"Standard (Plastic) - Double Net - 100% Aspen Exelsior", description:"Std (Plastic) Double Net Aspen Excelsior Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:227.0, prepaid:"", prepaidPallet:"", truckPrice:198.0 },
  { sku:"BMP-BSNAE08", product:"Biodegradable (Jute) - Double Net - 100% Aspen Excelsior", description:"Bio (Jute) Single Net Aspen Excelsior Blanket - 8' x 112.5' (100sy / 83m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:128.0, prepaid:"", prepaidPallet:"", truckPrice:112.0 },
  { sku:"BMP-BSNAE16", product:"Biodegradable (Jute) - Double Net - 100% Aspen Excelsior", description:"Bio (Jute) Single Net Aspen Excelsior Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:257.0, prepaid:"", prepaidPallet:"", truckPrice:224.0 },
  { sku:"BMP-BDNAE08", product:"Biodegradable (Jute) - Double Net - 100% Aspen Excelsior", description:"Bio (Jute) Double Net Aspen Excelsior Blanket - 8' x 112.5' (100sy / 83m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:140.0, prepaid:"", prepaidPallet:"", truckPrice:122.0 },
  { sku:"BMP-BDNAE16", product:"Biodegradable (Jute) - Double Net - 100% Aspen Excelsior", description:"Bio (Jute) Double Net Aspen Excelsior Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:280.0, prepaid:"", prepaidPallet:"", truckPrice:244.0 },
  { sku:"BMP-HVDNAE", product:"Biodegradable (Jute) - High Velocity Net - 100% Aspen Excelsior", description:"High Velocity - Bio (Jute) Double Net Aspen Excelsior Blanket - 8' x 50' (44sy / 37m²)", truck:"", pkg:"", pallet:25, price:"", palletPrice:110.0, prepaid:"", prepaidPallet:"", truckPrice:95.0 },
  { sku:"AEW0925", product:"Aspen Excelsior Wattle", description:"Aspen Excelsior Straw Wattle - 9 x 25'", truck:"", pkg:"", pallet:14, price:"", palletPrice:52.0, prepaid:"", prepaidPallet:"", truckPrice:55.0 },
  { sku:"AEW1220", product:"Aspen Excelsior Wattle", description:"Aspen Excelsior Straw Wattle - 12 x 20'", truck:"", pkg:"", pallet:12, price:"", palletPrice:52.0, prepaid:"", prepaidPallet:"", truckPrice:55.0 },
  { sku:"AEB181608", product:"Bloc", description:"Bio (Burlap) Aspen Excelsior Bloc - 18 x 16 x 8' Long", truck:"", pkg:"", pallet:"", price:"", palletPrice:0.0, prepaid:"", prepaidPallet:"", truckPrice:0.0 },
  { sku:"BMP-TRMP08", product:"Turf Reinforcement Mats", description:"100% Polypropylene Fiber TRM  - 8' x 112.5' (100sy/83m²)", truck:"", pkg:"", pallet:20, price:323.0, palletPrice:323.0, prepaid:"", prepaidPallet:"", truckPrice:323.0 },
  { sku:"BMP-TRMP16", product:"Turf Reinforcement Mats", description:"100% Polypropylene Fiber TRM  - 16' x 112.5' (200sy/167m²)", truck:"", pkg:"", pallet:20, price:645.0, palletPrice:645.0, prepaid:"", prepaidPallet:"", truckPrice:645.0 },
  { sku:"BMP-TRMPC08", product:"Turf Reinforcement Mats", description:"67% Polypropylene Fiber and 33% Coconut TRM -  8' x 112.5' (100sy/83m²)", truck:"", pkg:"", pallet:20, price:266.0, palletPrice:266.0, prepaid:"", prepaidPallet:"", truckPrice:266.0 },
  { sku:"BMP-TRMPC16", product:"Turf Reinforcement Mats", description:"67% Polypropylene Fiber and 33% Coconut TRM - 16' x 112.5' (200sy/167m²)", truck:"", pkg:"", pallet:20, price:532.0, palletPrice:532.0, prepaid:"", prepaidPallet:"", truckPrice:532.0 },
  { sku:"BMP-TRMPS08", product:"Turf Reinforcement Mats", description:"67% Polypropylene Fiber and 33% Straw TRM - 8' x 112.5' (100sy/83m²)", truck:"", pkg:"", pallet:20, price:253.0, palletPrice:253.0, prepaid:"", prepaidPallet:"", truckPrice:253.0 },
  { sku:"BMP-TRMPS16", product:"Turf Reinforcement Mats", description:"67% Polypropylene Fiber and 33% Straw TRM - 16' x 112.5' (200sy/167m²)", truck:"", pkg:"", pallet:20, price:507.0, palletPrice:507.0, prepaid:"", prepaidPallet:"", truckPrice:507.0 },
  { sku:"STW0925", product:"Straw Wattle", description:"Standard Straw Wattle - 9 x 25'", truck:364, pkg:"", pallet:14, price:"", palletPrice:27.0, prepaid:"", prepaidPallet:"", truckPrice:25.0 },
  { sku:"STW1220", product:"Straw Wattle", description:"Standard Straw Wattle - 12 x 20'", truck:312, pkg:"", pallet:12, price:"", palletPrice:27.0, prepaid:"", prepaidPallet:"", truckPrice:25.0 },
  { sku:"RDSTW0925", product:"Straw Wattle", description:"Rapid Degradable Straw Wattle - 9 x 25'", truck:364, pkg:"", pallet:14, price:"", palletPrice:29.0, prepaid:"", prepaidPallet:"", truckPrice:27.0 },
  { sku:"RDSTW1220", product:"Straw Wattle", description:"Rapid Degradable Straw Wattle - 12 x 20'", truck:312, pkg:"", pallet:12, price:"", palletPrice:29.0, prepaid:"", prepaidPallet:"", truckPrice:27.0 },
  { sku:"BSTW0925", product:"Straw Wattle", description:"Biodegradable (Burlap) Straw Wattle  - 9 x 25'", truck:364, pkg:"", pallet:14, price:"", palletPrice:31.5, prepaid:"", prepaidPallet:"", truckPrice:29.0 },
  { sku:"BSTW1220", product:"Straw Wattle", description:"Biodegradable (Burlap) Straw Wattle - 12 x 20'", truck:312, pkg:"", pallet:12, price:"", palletPrice:31.5, prepaid:"", prepaidPallet:"", truckPrice:29.0 },
  { sku:"BMPSTK18", product:"Wattle Stakes", description:"2 x 2 x 18  - 100% biodegradable wood stake for securing Straw Wattles", truck:"", pkg:25, pallet:"48 Bundles", price:20.0, palletPrice:18.0, prepaid:"", prepaidPallet:"", truckPrice:"" },
  { sku:"BMPSTK24", product:"Wattle Stakes", description:"2 x 2 x 24 - 100% biodegradable wood stake for securing Straw Wattles", truck:"", pkg:25, pallet:"48 Bundles", price:24.0, palletPrice:22.0, prepaid:"", prepaidPallet:"", truckPrice:"" }
];

const CATEGORY_ORDER = ["Catch Basin Protection", "Misc. BMP Products", "Spill Solutions", "Turbidity Curtain", "Erosion Control Blanket", "Aspen Excelsior", "Turf Reinforcement Mats", "Straw Wattle"];

const INITIAL_CATEGORIES = {
  "4CBD2416HF": "Catch Basin Protection",
  "4CBD2416LF": "Catch Basin Protection",
  "4CBD2424HF": "Catch Basin Protection",
  "4CBD2424LF": "Catch Basin Protection",
  "4CBD21DIAHF": "Catch Basin Protection",
  "4CBD24DIAHF": "Catch Basin Protection",
  "SSC2118HF": "Catch Basin Protection",
  "DDS2424OF": "Catch Basin Protection",
  "DGD3648": "Catch Basin Protection",
  "CBW8009": "Catch Basin Protection",
  "CIF6048": "Catch Basin Protection",
  "OOF2230": "Catch Basin Protection",
  "OOF4806": "Catch Basin Protection",
  "SPB1206G": "Misc. BMP Products",
  "SBG2509": "Misc. BMP Products",
  "SBG0506": "Misc. BMP Products",
  "SBG0510": "Misc. BMP Products",
  "SBG0515": "Misc. BMP Products",
  "SBG1010": "Misc. BMP Products",
  "SBG1015": "Misc. BMP Products",
  "SBG1020": "Misc. BMP Products",
  "SBG2020": "Misc. BMP Products",
  "SBG2030": "Misc. BMP Products",
  "HN2027": "Spill Solutions",
  "HN3927": "Spill Solutions",
  "HN7945": "Spill Solutions",
  "HNL2027": "Spill Solutions",
  "HNL3927": "Spill Solutions",
  "HNL7954": "Spill Solutions",
  "SCB0404": "Spill Solutions",
  "SCB0406": "Spill Solutions",
  "SCB0708": "Spill Solutions",
  "TBC2.550T1IND": "Turbidity Curtain",
  "TBC0550T1IND": "Turbidity Curtain",
  "TBC7550T1IND": "Turbidity Curtain",
  "TBC1050T1IND": "Turbidity Curtain",
  "TBC1250T1IND": "Turbidity Curtain",
  "TBC1550T1IND": "Turbidity Curtain",
  "TBC2.550T1DOT": "Turbidity Curtain",
  "TBC0550T1DOT": "Turbidity Curtain",
  "TBC7550T1DOT": "Turbidity Curtain",
  "TBC1050T1DOT": "Turbidity Curtain",
  "TBC1250T1DOT": "Turbidity Curtain",
  "TBC1550T1DOT": "Turbidity Curtain",
  "TBC3050T1DOT": "Turbidity Curtain",
  "TBC2550T2IND": "Turbidity Curtain",
  "TBC0550T2IND": "Turbidity Curtain",
  "TBC7550T2IND": "Turbidity Curtain",
  "TBC1050T2IND": "Turbidity Curtain",
  "TBC1250T2IND": "Turbidity Curtain",
  "TBC1550T2IND": "Turbidity Curtain",
  "TBC2050T2IND": "Turbidity Curtain",
  "TBC2.550T2DOT": "Turbidity Curtain",
  "TBC0550T2DOT": "Turbidity Curtain",
  "TBC7550T2DOT": "Turbidity Curtain",
  "TBC1050T2DOT": "Turbidity Curtain",
  "TBC1250T2DOT": "Turbidity Curtain",
  "TBC1550T2DOT": "Turbidity Curtain",
  "TBC2050T2DOT": "Turbidity Curtain",
  "TBC2550T2DOT": "Turbidity Curtain",
  "TBC3050T2DOT": "Turbidity Curtain",
  "TBC2.550T3DOT": "Turbidity Curtain",
  "TBC0550T3DOT": "Turbidity Curtain",
  "TBC7550T3DOT": "Turbidity Curtain",
  "TBC1050T3DOT": "Turbidity Curtain",
  "TBC1250T3DOT": "Turbidity Curtain",
  "TBC1550T3DOT": "Turbidity Curtain",
  "TBC2050T3DOT": "Turbidity Curtain",
  "TBC2550T3DOT": "Turbidity Curtain",
  "TBC3050T3DOT": "Turbidity Curtain",
  "OCB1850": "Turbidity Curtain",
  "OCB1250": "Turbidity Curtain",
  "BAK14LBS": "Turbidity Curtain",
  "BAK25LBS": "Turbidity Curtain",
  "BAK40LBS": "Turbidity Curtain",
  "TOWBRI12": "Turbidity Curtain",
  "TOWBRI24": "Turbidity Curtain",
  "BMP-SSNS08": "Erosion Control Blanket",
  "BMP-SSNS16": "Erosion Control Blanket",
  "BMP-SSNS08JR": "Erosion Control Blanket",
  "BMP-SSNS16JR": "Erosion Control Blanket",
  "BMP-SDNS08": "Erosion Control Blanket",
  "BMP-SDNS16": "Erosion Control Blanket",
  "BMP-SDNS08JR": "Erosion Control Blanket",
  "BMP-SDNS16JR": "Erosion Control Blanket",
  "BMP-SDNSC08": "Erosion Control Blanket",
  "BMP-SDNSC16": "Erosion Control Blanket",
  "BMP-SDNSC08JR": "Erosion Control Blanket",
  "BMP-SDNSC16JR": "Erosion Control Blanket",
  "BMP-SDNC08": "Erosion Control Blanket",
  "BMP-SDNC16": "Erosion Control Blanket",
  "BMP-SDNC08JR": "Erosion Control Blanket",
  "BMP-SDNC16JR": "Erosion Control Blanket",
  "BMP-BDNS08": "Erosion Control Blanket",
  "BMP-BDNS16": "Erosion Control Blanket",
  "BMP- BDNS08JR": "Erosion Control Blanket",
  "BMP-BDNS16JR": "Erosion Control Blanket",
  "BMP-BDNSC08": "Erosion Control Blanket",
  "BMP-BDNSC16": "Erosion Control Blanket",
  "BMP-BDNSC08JR": "Erosion Control Blanket",
  "BMP-BDNSC16JR": "Erosion Control Blanket",
  "BMP-BDNC08": "Erosion Control Blanket",
  "BMP-BDNC16": "Erosion Control Blanket",
  "BMP-BDNC08JR": "Erosion Control Blanket",
  "BMP-BDNC16JR": "Erosion Control Blanket",
  "BMPSTK06": "Erosion Control Blanket",
  "BMPSTK12": "Erosion Control Blanket",
  "BMPSTP06": "Erosion Control Blanket",
  "BMP-SDNAE08": "Aspen Excelsior",
  "BMP-SDNAE16": "Aspen Excelsior",
  "BMP-BSNAE08": "Aspen Excelsior",
  "BMP-BSNAE16": "Aspen Excelsior",
  "BMP-BDNAE08": "Aspen Excelsior",
  "BMP-BDNAE16": "Aspen Excelsior",
  "BMP-HVDNAE": "Aspen Excelsior",
  "AEW0925": "Aspen Excelsior",
  "AEW1220": "Aspen Excelsior",
  "AEB181608": "Aspen Excelsior",
  "BMP-TRMP08": "Turf Reinforcement Mats",
  "BMP-TRMP16": "Turf Reinforcement Mats",
  "BMP-TRMPC08": "Turf Reinforcement Mats",
  "BMP-TRMPC16": "Turf Reinforcement Mats",
  "BMP-TRMPS08": "Turf Reinforcement Mats",
  "BMP-TRMPS16": "Turf Reinforcement Mats",
  "STW0925": "Straw Wattle",
  "STW1220": "Straw Wattle",
  "RDSTW0925": "Straw Wattle",
  "RDSTW1220": "Straw Wattle",
  "BSTW0925": "Straw Wattle",
  "BSTW1220": "Straw Wattle",
  "BMPSTK18": "Straw Wattle",
  "BMPSTK24": "Straw Wattle"
};


// ─── DIMS Data from CSV ────────────────────────────────────────────────────────
const INITIAL_DIMS = [
  { product:"DDS2424", type:"BMP Box", pieces:15, L:'20"', W:'16"', H:'15"', weight:"16.2", indWeight:"" },
  { product:"SSC1821HF", type:"BMP Box", pieces:15, L:'20"', W:'16"', H:'15"', weight:"16.2", indWeight:"" },
  { product:"DGD2836", type:"BMP Box", pieces:15, L:'20"', W:'16"', H:'15"', weight:"16.8", indWeight:"" },
  { product:"4CBD2416HF", type:"BMP Bag", pieces:12, L:'36"', W:'14"', H:'20"', weight:"12", indWeight:"" },
  { product:"4CBD2416LF", type:"BMP Bag", pieces:12, L:'36"', W:'14"', H:'20"', weight:"12", indWeight:"" },
  { product:"BOM0510-O", type:"BMP Bag", pieces:4, L:'24"', W:'24"', H:'19"', weight:"19", indWeight:"" },
  { product:"SPG1206G", type:"BMP Bag", pieces:6, L:'10"', W:'10"', H:'12"', weight:"22.2", indWeight:"" },
  { product:"4CBD2416LF", type:"Pallet", pieces:192, L:'40"', W:'48"', H:'80"', weight:"240", indWeight:"" },
  { product:"4CBD2424HF", type:"Pallet", pieces:192, L:'40"', W:'48"', H:'80"', weight:"215", indWeight:"" },
  { product:"4CBD3628HF", type:"Pallet", pieces:192, L:'40"', W:'48"', H:'80"', weight:"285", indWeight:"" },
  { product:"CIF6048", type:"Pallet", pieces:48, L:'40"', W:'38"', H:'50"', weight:"400", indWeight:"" },
  { product:"CBW8009", type:"Pallet", pieces:30, L:'40"', W:'48"', H:'72"', weight:"650", indWeight:"" },
  { product:"ESC1202", type:"Pallet", pieces:"", L:'40"', W:'48"', H:'80"', weight:"", indWeight:"" },
  { product:"ECS0905", type:"Pallet", pieces:"", L:'40"', W:'48"', H:'86"', weight:"700", indWeight:"" },
  { product:"SPB1206G", type:"Pallet", pieces:270, L:'40"', W:'48"', H:'85"', weight:"1070", indWeight:"" },
  { product:"BOM0510-O", type:"Pallet", pieces:64, L:'40"', W:'48"', H:'78"', weight:"320", indWeight:"" },
  { product:"TBC2.550T1IND", type:"Pallet", pieces:10, L:'48"', W:'96"', H:'85"', weight:"850", indWeight:"" },
  { product:"TBC0550T1IND", type:"Pallet", pieces:12, L:'48"', W:'96"', H:'96"', weight:"910", indWeight:"" },
  { product:"TBC7550T1IND", type:"Pallet", pieces:12, L:'48"', W:'96"', H:'96"', weight:"1050", indWeight:"" },
  { product:"TBC1050T1IND", type:"Pallet", pieces:12, L:'48"', W:'96"', H:'96"', weight:"1200", indWeight:"120" },
  { product:"TBC1250T1IND", type:"Pallet", pieces:11, L:'48"', W:'96"', H:'92"', weight:"1180", indWeight:"" },
  { product:"TBC1550T1IND", type:"Pallet", pieces:9, L:'48"', W:'96"', H:'96"', weight:"1100", indWeight:"" },
  { product:"TBC0550T1DOT", type:"Pallet", pieces:12, L:'48"', W:'96"', H:'92"', weight:"1100", indWeight:"110" },
  { product:"TBC7550T1DOT", type:"Pallet", pieces:11, L:'48"', W:'96"', H:'94"', weight:"1250", indWeight:"114" },
  { product:"TBC1050T1DOT", type:"Pallet", pieces:11, L:'48"', W:'96"', H:'96"', weight:"1490", indWeight:"" },
  { product:"TBC1250T1DOT", type:"Pallet", pieces:11, L:'48"', W:'96"', H:'94"', weight:"1350", indWeight:"" },
  { product:"TBC1550T1DOT", type:"Pallet", pieces:10, L:'48"', W:'96"', H:'96"', weight:"1400", indWeight:"" },
  { product:"TBC3050T1DOT", type:"Pallet", pieces:8, L:'48"', W:'96"', H:'98"', weight:"2227", indWeight:"" },
  { product:"TBC0550T2DOT", type:"Pallet", pieces:10, L:'48"', W:'96"', H:'96"', weight:"1250", indWeight:"121" },
  { product:"TBC7550T2DOT", type:"Pallet", pieces:9, L:'48"', W:'96"', H:'92"', weight:"1170", indWeight:"130" },
  { product:"TBC1050T2DOT", type:"Pallet", pieces:9, L:'48"', W:'96"', H:'96"', weight:"1288", indWeight:"161" },
  { product:"TBC1250T2DOT", type:"Pallet", pieces:8, L:'48"', W:'96"', H:'96"', weight:"1407", indWeight:"201" },
  { product:"TBC1550T2DOT", type:"Pallet", pieces:8, L:'48"', W:'96"', H:'102"', weight:"1512", indWeight:"216" },
  { product:"TBC2050T2DOT", type:"Pallet", pieces:7, L:'48"', W:'96"', H:'100"', weight:"", indWeight:"" },
  { product:"TBC2550T2DOT", type:"Pallet", pieces:7, L:'48"', W:'96"', H:'100"', weight:"", indWeight:"" },
  { product:"TBC3050T2DOT", type:"Pallet", pieces:6, L:'48"', W:'96"', H:'100"', weight:"", indWeight:"141" },
  { product:"TBC0550T3DOT", type:"Pallet", pieces:9, L:'48"', W:'96"', H:'96"', weight:"1275", indWeight:"181" },
  { product:"TBC7550T3DOT", type:"Pallet", pieces:9, L:'48"', W:'96"', H:'92"', weight:"1350", indWeight:"221" },
  { product:"TBC1050T3DOT", type:"Pallet", pieces:8, L:'48"', W:'96"', H:'96"', weight:"1450", indWeight:"250" },
  { product:"TBC1250T3DOT", type:"Pallet", pieces:7, L:'48"', W:'96"', H:'96"', weight:"1550", indWeight:"" },
  { product:"TBC1550T3DOT", type:"Pallet", pieces:7, L:'48"', W:'96"', H:'102"', weight:"1752", indWeight:"" },
  { product:"TBC2050T3DOT", type:"Pallet", pieces:6, L:'48"', W:'96"', H:'100"', weight:"", indWeight:"" },
  { product:"TBC0550T2IND", type:"Pallet", pieces:9, L:'48"', W:'96"', H:'96"', weight:"1200", indWeight:"" },
  { product:"TBC7550T2IND", type:"Pallet", pieces:9, L:'48"', W:'96"', H:'92"', weight:"1100", indWeight:"" },
  { product:"TBC1050T2IND", type:"Pallet", pieces:8, L:'48"', W:'96"', H:'98"', weight:"1250", indWeight:"" },
  { product:"TBC1250T2IND", type:"Pallet", pieces:8, L:'48"', W:'96"', H:'99"', weight:"1400", indWeight:"" },
  { product:"TBC1550T2IND", type:"Pallet", pieces:7, L:'48"', W:'96"', H:'96"', weight:"", indWeight:"" },
  { product:"OCB1250", type:"Pallet", pieces:16, L:'48"', W:'96"', H:'92"', weight:"", indWeight:"" },
  { product:"OCB1850", type:"Pallet", pieces:16, L:'48"', W:'96"', H:'98"', weight:"", indWeight:"" },
  { product:"BMPSTK", type:"Box", pieces:1, L:'34"', W:'13"', H:'9"', weight:"20 lbs", indWeight:"" },
  { product:"Wattle Stakes", type:"Bundle", pieces:48, L:'48"', W:'48"', H:'36"', weight:"600", indWeight:"" },
  { product:"Blanket Stakes Box", type:"Box", pieces:1, L:'34"', W:'13"', H:'9"', weight:"20 lbs", indWeight:"" },
  { product:"Blanket Stakes Pallet", type:"Pallet", pieces:"", L:'48"', W:'40"', H:'85"', weight:"850 lbs", indWeight:"" },
  { product:'Metal Blanket 6"', type:"Box", pieces:1, L:"", W:"", H:"", weight:"40 lbs", indWeight:"" },
  { product:"Wattles", type:"Pallet", pieces:"", L:'48"', W:'40"', H:'108"', weight:"550 lbs", indWeight:"" },
  { product:"8' Roll ECB", type:"Pallet", pieces:"", L:'48"', W:'96"', H:'52"', weight:"1300 lbs", indWeight:"" },
  { product:"16' Roll ECB", type:"Pallet", pieces:"", L:'49"', W:'192"', H:'55"', weight:"2200 lbs", indWeight:"" },
];

// ─── Shipping chart data matching the spreadsheet exactly ─────────────────────
const SHIPPING_DATA = {
  calgaryEdmonton: {
    type1: {
      label: "Type 1 Curtain (6\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[184,189.75,218.50,247.25,270.25,276,299,304.75,327.75,345] },
        { depth:"5' Depth",   vals:[184,189.75,218.50,247.25,264.50,287.50,299,304.75,327.75,350.75] },
        { depth:"7.5' Depth", vals:[184,189.75,218.50,247.25,281.75,293.25,304.75,310.50,333.50,356.50] },
        { depth:"10' Depth",  vals:[184,189.75,218.50,247.25,287.50,299,310.50,316.25,339.25,368] },
        { depth:"12.5' Depth",vals:[184,189.75,218.50,253,293.25,304.75,316.25,322,356.50,""] },
        { depth:"15' Depth",  vals:[195.50,201.25,218.50,258.75,264.50,310.50,322,345,"",""] },
      ]
    },
    type2: {
      label: "Type 2 Curtain (8\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[220,230,240,270,300,315,340,360,380,390] },
        { depth:"5' Depth",   vals:[220,230,240,270,315,340,360,375,391,421.99] },
        { depth:"7.5' Depth", vals:[220,230,240,270,300,340,360,380,400,""] },
        { depth:"10' Depth",  vals:[220,230,240,270,320,345,400,420,"",""] },
        { depth:"12.5' Depth",vals:[220,230,240,270,320,350,400,420,"",""] },
        { depth:"15' Depth",  vals:[220,230,280,320,340,360,410,"","",""] },
      ]
    }
  },
  calgaryVancouver: {
    type1: {
      label: "Type 1 Curtain (6\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[172.50,230,253,299,333.50,368,402.50,402.50,402.50,448] },
        { depth:"5' Depth",   vals:[184,235.75,258.75,304.75,339.25,362.25,408.25,408.25,408.25,448] },
        { depth:"7.5' Depth", vals:[189.75,241.50,264.50,310.50,345,379.50,391,414,414,448] },
        { depth:"10' Depth",  vals:[212.75,241.50,270.25,316.25,350.75,385.25,402.50,431.25,431.25,448] },
        { depth:"12.5' Depth",vals:[212.75,247.25,276,333.50,362.25,414,425.50,448,448,""] },
        { depth:"15' Depth",  vals:[212.75,247.25,281.75,339.25,368,425.50,448.50,448,"",""] },
      ]
    },
    type2: {
      label: "Type 2 Curtain (8\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[189.75,241.50,270.25,327.75,356.50,396.75,431.25,437,465.75,519.74] },
        { depth:"5' Depth",   vals:[189.75,247.25,281.75,316.25,362.25,402.50,425.50,448.50,471.50,524.85] },
        { depth:"7.5' Depth", vals:[195.50,253,287.50,333.50,368,408.25,431.25,454.25,483,""] },
        { depth:"10' Depth",  vals:[195.50,253,293.25,339.25,373.75,425.50,454.25,483,"",""] },
        { depth:"12.5' Depth",vals:[207,293.25,333.50,368,408.25,442.75,477.25,"","",""] },
        { depth:"15' Depth",  vals:[207,293.25,339.25,373.75,419.75,448.50,483,"","",""] },
      ]
    }
  },
  brooksEdmonton: {
    type1: {
      label: "Type 1 Curtain (6\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[276,284.63,327.75,370.88,405.38,414,448.50,457.13,491.63,517.50] },
        { depth:"5' Depth",   vals:[276,284.63,327.75,370.88,396.75,431.25,448.50,457.13,491.63,526.13] },
        { depth:"7.5' Depth", vals:[276,284.63,327.75,370.88,422.63,439.88,457.13,465.75,500.25,534.75] },
        { depth:"10' Depth",  vals:[276,284.63,327.75,370.88,431.25,448.50,465.75,474.38,508.88,552] },
        { depth:"12.5' Depth",vals:[276,284.63,327.75,379.50,439.88,457.13,474.38,483,534.75,""] },
        { depth:"15' Depth",  vals:[293.25,301.88,327.75,388.13,396.75,465.75,483,517.50,"",""] },
      ]
    },
    type2: {
      label: "Type 2 Curtain (8\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[374,391,408,459,510,535.50,578,612,646,663] },
        { depth:"5' Depth",   vals:[374,391,408,459,510,578,612,637.50,664.70,717.38] },
        { depth:"7.5' Depth", vals:[374,391,408,459,535.50,612,648,684,720,""] },
        { depth:"10' Depth",  vals:[396,414,432,486,576,621,720,756,"",""] },
        { depth:"12.5' Depth",vals:[374,391,408,459,544,595,680,714,"",""] },
        { depth:"15' Depth",  vals:[374,391,476,544,578,612,697,"","",""] },
      ]
    }
  },
  brooksVancouver: {
    type1: {
      label: "Type 1 Curtain (6\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[310.50,414,455.40,538.20,600.30,662.40,724.50,724.50,724.50,806.40] },
        { depth:"5' Depth",   vals:[331.20,424.35,465.75,548.55,610.65,652.05,734.85,734.85,734.85,806.40] },
        { depth:"7.5' Depth", vals:[341.55,434.70,476.10,558.90,621,683.10,703.80,745.20,745.20,806.40] },
        { depth:"10' Depth",  vals:[382.95,434.70,486.45,569.25,631.35,693.45,724.50,776.25,776.25,806.40] },
        { depth:"12.5' Depth",vals:[382.95,445.05,496.80,600.30,652.05,745.20,765.90,806.40,806.40,""] },
        { depth:"15' Depth",  vals:[382.95,445.05,507.15,610.65,662.40,765.90,807.30,806.40,"",""] },
      ]
    },
    type2: {
      label: "Type 2 Curtain (8\" foam)",
      rows: [
        { depth:"2.5' Depth", vals:[322.58,410.55,459.43,557.18,606.05,674.48,733.13,742.90,791.78,883.55] },
        { depth:"5' Depth",   vals:[322.58,420.33,478.98,537.63,615.83,684.25,723.35,762.45,801.55,892.24] },
        { depth:"7.5' Depth", vals:[332.35,430.10,488.75,566.95,625.60,694.03,733.13,772.23,"",821.10] },
        { depth:"10' Depth",  vals:[332.35,430.10,498.53,576.73,635.38,723.35,772.23,821.10,"",""] },
        { depth:"12.5' Depth",vals:[351.90,498.53,566.95,625.60,694.03,752.68,811.33,"","",""] },
        { depth:"15' Depth",  vals:[351.90,498.53,576.73,635.38,713.58,762.45,821.10,"","",""] },
      ]
    }
  }
};

const PRICE_INCREASE_OPTIONS = [0,5,10,15,20,25,30,35,40,50,55,60];
function fmtCur(val) {
  if (val === "" || val === null || val === undefined) return "—";
  const n = parseFloat(String(val).replace(/[$,]/g,""));
  if (isNaN(n) || n === 0) return "—";
  return `$${n.toLocaleString("en-CA",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function parsePrice(str) {
  if (!str && str !== 0) return 0;
  return parseFloat(String(str).replace(/[$,]/g,"")) || 0;
}
let qCounter = 44003;
function nextQNum() { return `BMP${qCounter++}`; }

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function SalesHub() {
  const [authed, setAuthed] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginError, setLoginError] = useState("");

  const VALID_NAMES = ["Paul", "Mark", "Grant", "Jeff"];

  function handleLogin() {
    const name = loginName.trim();
    const match = VALID_NAMES.find(n => n.toLowerCase() === name.toLowerCase());
    if (!match) {
      setLoginError("Name not recognised. Please enter your first name.");
      return;
    }
    setLoginName(match); // normalise capitalisation
    setLoginError("");
    setAuthed(true);
  }



  const [activeTab, setActiveTab] = useState("quotes");
  const [productsCAD, setProductsCAD] = useState(INITIAL_PRODUCTS_CAD);
  const [productsUSD, setProductsUSD] = useState(
    INITIAL_PRODUCTS_CAD.map(p=>({...p,price:"",palletPrice:"",prepaid:"",prepaidPallet:"",truckPrice:""}))
  );
  const [dims, setDims] = useState(INITIAL_DIMS);
  const [quotes, setQuotes] = useState([]);
  const [activeQuote, setActiveQuote] = useState(null);
  const [searchQ, setSearchQ] = useState({name:"",company:"",date:"",madeBy:"",quoteNum:""});
  const [productCurrency, setProductCurrency] = useState("CAD");
  const [productSearch, setProductSearch] = useState("");
  const [emailModal, setEmailModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pdfQuote, setPdfQuote] = useState(null);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);  // { sku: "Category Name" }
  const [theme, setTheme] = useState("light");
  const T = theme === "dark" ? DARK : LIGHT;
  const LOGO_B64 = ""; // logo injected at print time

  const currentProducts = productCurrency==="CAD" ? productsCAD : productsUSD;
  const setCurrentProducts = productCurrency==="CAD" ? setProductsCAD : setProductsUSD;

  const filteredQuotes = useMemo(()=>quotes.filter(q=>{
    const s=searchQ;
    return (!s.name||q.name.toLowerCase().includes(s.name.toLowerCase()))&&
      (!s.company||q.company.toLowerCase().includes(s.company.toLowerCase()))&&
      (!s.date||q.savedDate?.includes(s.date))&&
      (!s.madeBy||q.savedBy?.toLowerCase().includes(s.madeBy.toLowerCase()))&&
      (!s.quoteNum||q.quoteNum?.toLowerCase().includes(s.quoteNum.toLowerCase()));
  }),[quotes,searchQ]);

  const filteredProducts = useMemo(()=>{
    if (!productSearch) return currentProducts;
    const q=productSearch.toLowerCase();
    return currentProducts.filter(p=>p.sku.toLowerCase().includes(q)||p.product.toLowerCase().includes(q)||p.description.toLowerCase().includes(q));
  },[currentProducts,productSearch]);

  function createNewQuote() {
    const q={id:Date.now(),quoteNum:nextQNum(),name:"",company:"",prepaid:false,currency:"CAD",
      lineItems:[{id:Date.now(),sku:"",description:"",qty:1,unitPrice:0,increase:0,basePrice:0}],
      notes:"",saved:false,savedBy:"",savedDate:""};
    setActiveQuote(q);
  }
  function saveQuote(q) {
    const saved={...q,saved:true,savedBy:loginName,savedDate:new Date().toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"})};
    setQuotes(prev=>{const i=prev.findIndex(x=>x.id===saved.id);if(i>=0){const n=[...prev];n[i]=saved;return n;}return[...prev,saved];});
    setActiveQuote(saved);
  }
  function deleteQuote(id) {
    setQuotes(prev=>prev.filter(q=>q.id!==id));
    if(activeQuote?.id===id) setActiveQuote(null);
    setDeleteConfirm(null);
  }
  function openEmailModal(q) {
    const total=q.lineItems.reduce((a,li)=>a+(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0),0);
    const prods=[...new Set(q.lineItems.map(li=>li.description||li.sku).filter(Boolean))].join(", ");

    // HTML version — Outlook-compatible table (inline styles only, no classes)
    const rowsHtml=q.lineItems.map(li=>{
      const lt=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
      return `<tr>
        <td style="border:1px solid #000;padding:6px 12px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:13px;">${li.sku||"—"}</td>
        <td style="border:1px solid #000;padding:6px 12px;font-family:Calibri,Arial,sans-serif;font-size:13px;">${li.description||"—"}</td>
        <td style="border:1px solid #000;padding:6px 12px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:13px;">${li.qty}</td>
        <td style="border:1px solid #000;padding:6px 12px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:13px;">${fmtCur(li.unitPrice)}</td>
        <td style="border:1px solid #000;padding:6px 12px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;">${fmtCur(lt)}</td>
      </tr>`;
    }).join("");

    const bottomRow=`<tr>
      <td colspan="3" style="border:1px solid #000;padding:6px 12px;font-family:Calibri,Arial,sans-serif;font-size:12px;color:#555;font-style:italic;background:#f9f9f9;">${q.notes?"Notes: "+q.notes:""}</td>
      <td style="border:1px solid #000;padding:6px 12px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;background:#f5f5f5;">Total (${q.currency})</td>
      <td style="border:1px solid #000;padding:6px 12px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;background:#f5f5f5;">${fmtCur(total)}</td>
    </tr>`;

    const html=`<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000;">
<p>Hello ${q.name||"{NAME}"},</p>
<p>Thanks for reaching out! I would love to help you out, please see quote:</p>
<table style="border-collapse:collapse;width:100%;margin:16px 0;">
  <thead>
    <tr>
      <th style="border:1px solid #000;padding:7px 12px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;text-align:center;">SKU</th>
      <th style="border:1px solid #000;padding:7px 12px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;text-align:center;">Description</th>
      <th style="border:1px solid #000;padding:7px 12px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;text-align:center;">Qty</th>
      <th style="border:1px solid #000;padding:7px 12px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;text-align:center;">Unit Price</th>
      <th style="border:1px solid #000;padding:7px 12px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;text-align:center;">Total Price</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    ${bottomRow}
  </tbody>
</table>
<p>Let me know if you have any questions or concerns.</p>
<p>Thank you,</p>
</div>`;

    // Plain-text fallback
    const plain=`Hello ${q.name||"{NAME}"},\n\nThanks for reaching out! I would love to help you out, please see quote:\n\n${q.lineItems.map(li=>`${li.sku||"—"}  |  ${li.description||"—"}  |  Qty: ${li.qty}  |  Unit: ${fmtCur(li.unitPrice)}  |  Total: ${fmtCur((parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0))}`).join("\n")}\n\nTotal (${q.currency}): ${fmtCur(total)}${q.notes?`\nNotes: ${q.notes}`:""}\n\nLet me know if you have any questions or concerns.\n\nThank you,`;

    setEmailModal({html, plain});
  }

  function generatePDF(q) {
    setPdfQuote(q);
  }


  const TABS = [
    {id:"quotes", label:"Quote Maker", icon:"quote"},
    {id:"dims",   label:"DIMS",        icon:"dims"},
    {id:"shipping",label:"Shipping",   icon:"ship"},
    {id:"products",label:"Products",   icon:"products"},
  ];

  return authed ? (
    <div style={{fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:T.bg,color:T.text,minHeight:"100vh",display:"flex",flexDirection:"column",
      "--input-bg":T.inputBg,"--text":T.text,"--border":T.border,"--border-light":T.borderLight,"--border-mid":T.borderMid,
      "--accent":T.accent,"--table-head":T.tableHead,"--table-head-text":T.tableHeadText,
      "--btn-bg":T.btnBg,"--btn-border":T.btnBorder,"--btn-text":T.btnText,
      "--card-bg":T.cardBg,"--row-hover":T.rowHover,
      "--field-border":T.fieldBorder||T.borderLight,
      "--accent-glow":T===LIGHT?"rgba(160,120,40,.14)":"rgba(200,169,110,.14)"}}>
      <style>{`
        /* Helvetica Neue system font stack — no import needed */
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:var(--card-bg)}
        ::-webkit-scrollbar-thumb{background:var(--border-mid);border-radius:2px}
        input,select,textarea{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:var(--input-bg);color:var(--text);border:1px solid var(--field-border,var(--border-light));border-radius:2px;padding:4px 8px;outline:none;transition:border-color .15s,box-shadow .15s}
        input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-glow,rgba(160,120,40,.12))}
        button{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;cursor:pointer}
        .data-table{width:100%;border-collapse:collapse;font-size:12px}
        .data-table th{background:var(--table-head);color:var(--table-head-text);font-weight:500;text-transform:uppercase;letter-spacing:.06em;font-size:10px;padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:1}
        .data-table td{padding:5px 10px;border-bottom:1px solid var(--border);vertical-align:middle;color:var(--text)}
        .data-table tr:hover td{background:var(--row-hover)}
        .btn{background:var(--btn-bg);border:1px solid var(--btn-border);color:var(--btn-text);padding:6px 14px;font-size:11px;letter-spacing:.04em;transition:all .12s;cursor:pointer}
        .btn:hover{opacity:.85}
        .btn-gold{background:#c8a96e;border:none;color:#0a0a0a;padding:8px 22px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;transition:background .12s}
        .btn-gold:hover{background:#d4b87e}
        .btn-del{background:transparent;border:1px solid #2a1818;color:#774444;padding:3px 9px;font-size:11px;transition:all .12s}
        .btn-del:hover{background:#2a1515;border-color:#553333}
        .pill{display:inline-block;padding:2px 7px;border-radius:1px;font-size:9px;letter-spacing:.06em;text-transform:uppercase;font-weight:500}
        .pill-saved{background:#182018;color:#5a9e5a;border:1px solid #253525}
        .pill-open{background:#201e10;color:#9e8e40;border:1px solid #352e10}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:100}
        .modal{background:var(--card-bg);border:1px solid var(--border-mid);border-radius:3px;padding:22px;max-width:580px;width:92%;max-height:80vh;overflow-y:auto;color:var(--text);box-shadow:0 4px 24px rgba(0,0,0,.12)}
        .warn-toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1e1808;border:1px solid #3a2e08;color:#c8a030;font-size:11px;padding:6px 14px;white-space:nowrap;z-index:500;cursor:pointer;border-radius:2px;box-shadow:0 2px 12px rgba(0,0,0,.4);}
      `}</style>

      {/* Header */}
      <div style={{background:T.headerBg,borderBottom:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:14}}>
        <svg width="26" height="20" viewBox="0 0 26 20">
          {[0,4,8,12,16].map((y,i)=><rect key={i} x="0" y={y} width="16" height="3" fill="#c8a96e"/>)}
        </svg>
        <div>
          <div style={{fontSize:12,fontWeight:600,letterSpacing:".1em",color:T.text}}> BMP SUPPLIES</div>
          <div style={{fontSize:8,color:T.muted,letterSpacing:".18em"}}>SALES HUB</div>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:9,color:T.subtle,letterSpacing:".06em"}}>{new Date().toLocaleDateString("en-CA",{weekday:"short",year:"numeric",month:"short",day:"numeric"})}</div>
          <div style={{fontSize:10,color:T.muted,borderLeft:`1px solid ${T.border}`,paddingLeft:12}}>
            <span style={{color:T.subtext,fontWeight:600}}>{loginName}</span>
          </div>
          <button onClick={()=>{setAuthed(false);setLoginName("");setLoginPass("");}}
            style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,padding:"3px 10px",fontSize:9,cursor:"pointer",letterSpacing:".06em",borderRadius:1}}>
            Sign out
          </button>
        </div>
        <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}
          style={{background:T.btnBg,border:`1px solid ${T.border}`,color:T.subtext,padding:"4px 12px",fontSize:10,cursor:"pointer",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",letterSpacing:".06em",borderRadius:2}}>
          {theme==="dark"?"☀ Light":"☾ Dark"}
        </button>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden",height:"calc(100vh - 52px)"}}>
        {/* Sidebar — icons only */}
        <div style={{width:46,background:T.headerBg,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:10,gap:2}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} title={t.label}
              style={{background:activeTab===t.id?T.activeBg:"transparent",border:"none",padding:"10px 0",width:"100%",display:"flex",justifyContent:"center",
                color:activeTab===t.id?"#c8a96e":T.muted,transition:"color .15s,background .15s",borderLeft:activeTab===t.id?"2px solid #c8a96e":`2px solid transparent`}}>
              <Icon name={t.icon} size={17} color="currentColor"/>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {activeTab==="quotes"&&<QuotesTab quotes={filteredQuotes} activeQuote={activeQuote} searchQ={searchQ} setSearchQ={setSearchQ}
            productsCAD={productsCAD} productsUSD={productsUSD} createNewQuote={createNewQuote}
            setActiveQuote={setActiveQuote} saveQuote={saveQuote} editQuote={q=>setActiveQuote({...q,saved:false})}
            openEmailModal={openEmailModal} generatePDF={generatePDF} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} deleteQuote={deleteQuote} T={T}/>}
          {activeTab==="dims"&&<DimsTab dims={dims} setDims={setDims} T={T}/>}
          {activeTab==="shipping"&&<ShippingTab T={T}/>}
          {activeTab==="products"&&<ProductsTab products={filteredProducts} setProducts={setCurrentProducts}
            currency={productCurrency} setCurrency={setProductCurrency} search={productSearch} setSearch={setProductSearch}
            categories={categories} setCategories={setCategories} T={T}/>}
        </div>
      </div>

      {/* PDF Modal */}
      {pdfQuote && (
        <PDFModal quote={pdfQuote} onClose={()=>setPdfQuote(null)}/>
      )}

      {/* Email Modal */}
      {emailModal&&(
        <div className="modal-overlay" onClick={()=>setEmailModal(null)}>
          <div className="modal" style={{maxWidth:700,width:"94%"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:10,letterSpacing:".12em",textTransform:"uppercase",color:"#666"}}>Email Template — Copy &amp; Paste into Outlook</div>
              <button style={{background:"none",border:"none",color:"#555",fontSize:14}} onClick={()=>setEmailModal(null)}>✕</button>
            </div>
            {/* Live HTML preview — this is what gets copied */}
            <div style={{background:"#fff",border:"1px solid #ddd",padding:"18px 22px",marginBottom:10,maxHeight:340,overflowY:"auto",borderRadius:2}}
              id="email-html-preview"
              dangerouslySetInnerHTML={{__html:emailModal.html}}
            />
            <div style={{fontSize:9,color:"#555",marginBottom:10,letterSpacing:".06em"}}>
              ↑ Preview — click "Copy for Outlook" then paste directly into a new Outlook email with Ctrl+V
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-gold" style={{fontSize:11,padding:"7px 18px"}} onClick={()=>{
                // Copy rich HTML to clipboard so Outlook preserves table formatting
                const el=document.getElementById("email-html-preview");
                if(navigator.clipboard&&window.ClipboardItem){
                  const blob=new Blob([emailModal.html],{type:"text/html"});
                  const item=new window.ClipboardItem({"text/html":blob});
                  navigator.clipboard.write([item]).catch(()=>{
                    // fallback: select the rendered div
                    const sel=window.getSelection();
                    const range=document.createRange();
                    range.selectNodeContents(el);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    document.execCommand("copy");
                    sel.removeAllRanges();
                  });
                } else {
                  // execCommand fallback — selects rendered content
                  const sel=window.getSelection();
                  const range=document.createRange();
                  range.selectNodeContents(el);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  document.execCommand("copy");
                  sel.removeAllRanges();
                }
              }}>Copy for Outlook</button>
              <button className="btn" style={{fontSize:11}} onClick={()=>navigator.clipboard.writeText(emailModal.plain)}>Copy Plain Text</button>
              <button className="btn" style={{fontSize:11,marginLeft:"auto"}} onClick={()=>setEmailModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm&&(
        <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth:340}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:11,color:"#aaa",marginBottom:16}}>Delete quote <span style={{color:"#c8a96e"}}>{deleteConfirm.quoteNum}</span>?<br/><span style={{fontSize:10,color:"#666"}}>This cannot be undone.</span></div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-del" style={{padding:"6px 16px"}} onClick={()=>deleteQuote(deleteConfirm.id)}>Delete</button>
              <button className="btn" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (

    <div style={{fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:"#f2f2f0",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:360,padding:"0 20px"}}>

        {/* Brand */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <img src="data:image/png;base64,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" style={{height:64,width:"auto",display:"block",margin:"0 auto 20px"}} alt="BMP Supplies"/>
          <div style={{fontSize:10,color:"#aaa",letterSpacing:".16em",textTransform:"uppercase"}}>Sales Hub</div>
        </div>

        {/* Card */}
        <div style={{background:"#ffffff",border:"1px solid #d8d8d4",borderRadius:6,padding:"36px 32px",boxShadow:"0 2px 20px rgba(0,0,0,.08)"}}>
          <div style={{fontSize:17,fontWeight:600,color:"#111",marginBottom:6}}>Who are you?</div>
          <div style={{fontSize:12,color:"#aaa",marginBottom:28,lineHeight:1.5}}>Enter your first name to get started.</div>

          <input
            value={loginName}
            onChange={e=>{ setLoginName(e.target.value); setLoginError(""); }}
            onKeyDown={e=>e.key==="Enter" && handleLogin()}
            placeholder="Your name"
            autoFocus
            style={{width:"100%",height:44,fontSize:14,padding:"0 14px",border:`1px solid ${loginError?"#e08080":"#c0c0bc"}`,borderRadius:3,background:"#fff",color:"#111",outline:"none",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",marginBottom:10,transition:"border-color .15s"}}
          />

          {loginError && (
            <div style={{fontSize:11,color:"#c04040",marginBottom:14,paddingLeft:2}}>
              {loginError}
            </div>
          )}

          <button onClick={handleLogin}
            style={{width:"100%",height:44,background:"#111111",border:"none",color:"#ffffff",fontSize:13,fontWeight:600,letterSpacing:".05em",cursor:"pointer",borderRadius:3,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",marginTop:4}}
            onMouseOver={e=>e.currentTarget.style.background="#333"}
            onMouseOut={e=>e.currentTarget.style.background="#111111"}>
            Continue →
          </button>
        </div>

        <div style={{textAlign:"center",marginTop:24,fontSize:10,color:"#ccc",letterSpacing:".04em"}}>
          BMP Supplies · Internal use only
        </div>
      </div>
    </div>
  );
}

// ─── Quotes Tab ────────────────────────────────────────────────────────────────
function QuotesTab({quotes,activeQuote,searchQ,setSearchQ,productsCAD,productsUSD,createNewQuote,setActiveQuote,saveQuote,editQuote,openEmailModal,generatePDF,deleteConfirm,setDeleteConfirm,deleteQuote,T}) {
  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Left panel */}
      <div style={{width:252,borderRight:"1px solid #181818",display:"flex",flexDirection:"column",background:"#0a0a0a"}}>
        <div style={{padding:"12px 12px 8px",borderBottom:"1px solid #181818"}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".12em",color:"#444",marginBottom:6}}>Search Quotes</div>
          {[{k:"name",p:"Name"},{k:"company",p:"Company"},{k:"date",p:"Date"},{k:"madeBy",p:"Made By"},{k:"quoteNum",p:"Quote #"}].map(f=>(
            <input key={f.k} value={searchQ[f.k]} onChange={e=>setSearchQ(p=>({...p,[f.k]:e.target.value}))}
              placeholder={f.p} style={{width:"100%",marginBottom:4,fontSize:11,height:26}}/>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {quotes.length===0&&<div style={{padding:16,color:"#333",fontSize:11,textAlign:"center"}}>No quotes</div>}
          {quotes.map(q=>(
            <div key={q.id} style={{padding:"9px 12px",borderBottom:"1px solid #131313",cursor:"pointer",background:activeQuote?.id===q.id?"#161616":"transparent",position:"relative"}}
              onClick={()=>setActiveQuote(q)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#bbb"}}>{q.quoteNum}</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span className={`pill ${q.saved?"pill-saved":"pill-open"}`}>{q.saved?"Saved":"Open"}</span>
                  <button className="btn-del" style={{padding:"1px 6px",fontSize:10}} title="Delete quote"
                    onClick={e=>{e.stopPropagation();setDeleteConfirm(q);}}>✕</button>
                </div>
              </div>
              <div style={{fontSize:11,color:"#777",marginTop:2}}>{q.name||"—"}</div>
              <div style={{fontSize:10,color:"#444"}}>{q.company||"—"} · {q.currency}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Right: form */}
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {!activeQuote
          ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16}}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="4" width="32" height="32" rx="3" stroke={T.borderMid||"#ccc"} strokeWidth="1.5" fill="none"/>
                <line x1="12" y1="14" x2="28" y2="14" stroke={T.borderMid||"#ccc"} strokeWidth="1.5"/>
                <line x1="12" y1="20" x2="22" y2="20" stroke={T.borderMid||"#ccc"} strokeWidth="1.5"/>
                <line x1="12" y1="26" x2="19" y2="26" stroke={T.borderMid||"#ccc"} strokeWidth="1.5"/>
              </svg>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:600,color:T.subtext||"#333",marginBottom:4}}>No quote open</div>
                <div style={{fontSize:11,color:T.muted||"#999"}}>Select one from the list or start a new one</div>
              </div>
              <button className="btn-gold" style={{fontSize:12,padding:"9px 24px"}} onClick={createNewQuote}>+ Create New Quote</button>
            </div>
          : <QuoteForm quote={activeQuote} setQuote={setActiveQuote} productsCAD={productsCAD} productsUSD={productsUSD}
              onSave={saveQuote} onEdit={editQuote} onEmail={openEmailModal} onPDF={generatePDF}
              onClose={()=>setActiveQuote(null)} onNewQuote={()=>{setActiveQuote(null);setTimeout(createNewQuote,50);}} T={T}/>
        }
      </div>
    </div>
  );
}

// ─── Quote Form ────────────────────────────────────────────────────────────────
function QuoteForm({quote,setQuote,productsCAD,productsUSD,onSave,onEdit,onEmail,onPDF,onClose,onNewQuote,T}) {
  const products = quote.currency==="CAD"?productsCAD:productsUSD;
  const [qtyWarnings,setQtyWarnings] = useState({});

  function upd(field,val){setQuote(q=>({...q,[field]:val}));}
  function updLI(id,field,val){
    setQuote(q=>({...q,lineItems:q.lineItems.map(li=>{
      if(li.id!==id)return li;
      const u={...li,[field]:val};
      if(field==="sku"||field==="description"){
        const prod=field==="sku"?products.find(p=>p.sku===val):products.find(p=>p.description===val);
        if(prod){
          if(field==="sku")u.description=prod.description;else u.sku=prod.sku;
          const base=q.prepaid&&prod.prepaid?parsePrice(prod.prepaid):parsePrice(prod.price||prod.palletPrice);
          u.basePrice=base; u.unitPrice=base*(1+(u.increase||0)/100);
        }
      }
      if(field==="increase"){const p=parseFloat(val)||0;u.unitPrice=u.basePrice*(1+p/100);}
      if(field==="qty"){
        const prod=products.find(p=>p.sku===u.sku);
        if(prod&&prod.pkg&&prod.pkg!==""){
          const pkg=parseInt(prod.pkg);
          if(!isNaN(pkg)&&parseInt(val)%pkg!==0){
            setQtyWarnings(w=>({...w,[id]:`Not a multiple of package qty (${pkg})`}));
          } else {
            setQtyWarnings(w=>{const n={...w};delete n[id];return n;});
          }
        }
      }
      return u;
    })}));
  }
  function addLI(){setQuote(q=>({...q,lineItems:[...q.lineItems,{id:Date.now(),sku:"",description:"",qty:1,unitPrice:0,increase:0,basePrice:0}]}));}
  function removeLI(id){setQuote(q=>({...q,lineItems:q.lineItems.filter(li=>li.id!==id)}));setQtyWarnings(w=>{const n={...w};delete n[id];return n;});}

  const total=quote.lineItems.reduce((s,li)=>s+(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0),0);
  const ro=quote.saved;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:9,color:T.sectionLabel||"#555",letterSpacing:".1em"}}>QUOTE</span>
          <span style={{fontSize:14,fontWeight:600,color:"#c8a96e"}}>{quote.quoteNum}</span>
          {quote.saved&&<span className="pill pill-saved">Saved</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {quote.saved&&<div style={{fontSize:9,color:T.muted||"#888"}}>Saved by {quote.savedBy} · {quote.savedDate}</div>}
          {quote.saved&&(
            <button onClick={onNewQuote}
              style={{background:"#c8a96e",border:"none",color:"#0a0a0a",padding:"4px 12px",fontSize:10,fontWeight:600,cursor:"pointer",letterSpacing:".05em",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",borderRadius:2}}>
              + New Quote
            </button>
          )}
          <button onClick={onClose} title="Close"
            style={{background:"transparent",border:`1px solid ${T.border||"#ddd"}`,color:T.muted||"#999",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,borderRadius:2,lineHeight:1}}>
            ✕
          </button>
        </div>
      </div>

      {/* Customer fields */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:"1px solid #1e1e1e",marginBottom:10}}>
        {[["Name","name"],["Company","company"]].map(([label,field])=>(
          <div key={field} style={{borderRight:"1px solid #1a1a1a",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center"}}>
            <div style={{fontSize:10,color:"#666",padding:"5px 10px",width:80,flexShrink:0,borderRight:"1px solid #161616"}}>{label}</div>
            <input disabled={ro} value={quote[field]} onChange={e=>upd(field,e.target.value)}
              style={{flex:1,border:"none",background:"var(--input-bg)",height:28,paddingLeft:8,fontSize:12,color:"var(--text)"}}/>
          </div>
        ))}
        <div style={{borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",padding:"4px 12px",gap:8}}>
          <span style={{fontSize:10,color:"#666"}}>Currency</span>
          <select disabled={ro} value={quote.currency} onChange={e=>upd("currency",e.target.value)}
            style={{background:"var(--input-bg)",border:"1px solid var(--border-light)",color:"var(--text)",fontSize:11,padding:"2px 6px",fontStyle:"italic"}}>
            <option>CAD</option><option>USD</option>
          </select>
        </div>
        <div style={{borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",padding:"4px 12px",gap:8}}>
          <span style={{fontSize:10,color:"#666"}}>Quote #</span>
          <span style={{fontSize:11,fontWeight:600,color:"#888"}}>{quote.quoteNum}</span>
        </div>
        <div style={{display:"flex",alignItems:"center"}}>
          <div style={{fontSize:10,color:"#666",padding:"5px 10px",width:80,flexShrink:0,borderRight:"1px solid #161616"}}>Prepaid?</div>
          <select disabled={ro} value={quote.prepaid?"Yes":"No"} onChange={e=>upd("prepaid",e.target.value==="Yes")}
            style={{border:"none",background:"var(--input-bg)",height:28,paddingLeft:8,color:"var(--text)",fontSize:11}}>
            <option>No</option><option>Yes</option>
          </select>
        </div>
        <div/>
      </div>

      {/* Line items */}
      <div style={{border:"1px solid #1e1e1e",marginBottom:8,overflowX:"auto"}}>
        <table className="data-table">
          <thead><tr>
            <th style={{width:140}}>SKU</th>
            <th>Description</th>
            <th style={{width:72}}>Qty</th>
            <th style={{width:105}}>Unit Price</th>
            <th style={{width:105}}>Total</th>
            <th style={{width:110}}>Increase (%)</th>
            {!ro&&<th style={{width:36}}/>}
          </tr></thead>
          <tbody>{quote.lineItems.map((li,idx)=>{
            const lineTotal=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
            return <tr key={li.id}>
              <td>
                {ro?<span style={{fontSize:11}}>{li.sku||"—"}</span>
                  :<><input list={`sl-${idx}`} value={li.sku} onChange={e=>updLI(li.id,"sku",e.target.value)}
                      style={{width:"100%",fontSize:11,height:25}} placeholder="SKU"/>
                    <datalist id={`sl-${idx}`}>{products.map(p=><option key={p.sku} value={p.sku}/>)}</datalist></>}
              </td>
              <td>
                {ro?<span style={{fontSize:11}}>{li.description}</span>
                  :<><input list={`dl-${idx}`} value={li.description} onChange={e=>updLI(li.id,"description",e.target.value)}
                      style={{width:"100%",fontSize:11,height:25}} placeholder="Product description"/>
                    <datalist id={`dl-${idx}`}>{products.map(p=><option key={p.sku} value={p.description}/>)}</datalist></>}
              </td>
              <td style={{position:"relative"}}>
                {ro?<span>{li.qty}</span>
                  :<div style={{position:"relative"}}>
                    <input type="number" min="1" value={li.qty} onChange={e=>updLI(li.id,"qty",parseInt(e.target.value)||1)}
                      style={{width:"100%",fontSize:11,height:25,borderColor:qtyWarnings[li.id]?"#5a3a00":"#2e2e2e"}}/>
                    {qtyWarnings[li.id]&&<div className="warn-toast" onClick={()=>setQtyWarnings(w=>{const n={...w};delete n[li.id];return n;})}>⚠ {qtyWarnings[li.id]} &nbsp;✕</div>}
                  </div>}
              </td>
              <td>{ro?<span>{fmtCur(li.unitPrice)}</span>
                :<input type="number" step="0.01" value={li.unitPrice} onChange={e=>updLI(li.id,"unitPrice",e.target.value)}
                    style={{width:"100%",fontSize:11,height:25}}/>}
              </td>
              <td style={{fontWeight:500,fontFamily:"monospace"}}>{fmtCur(lineTotal)}</td>
              <td>
                {ro?<span>{li.increase||0}%</span>
                  :<select value={li.increase||0} onChange={e=>updLI(li.id,"increase",parseInt(e.target.value))}
                      style={{width:"100%",fontSize:11,height:25,color:li.increase>0?"#c8a96e":"var(--subtext)",background:"var(--input-bg)"}}>
                      {PRICE_INCREASE_OPTIONS.map(o=><option key={o} value={o}>{o}%</option>)}
                    </select>}
              </td>
              {!ro&&<td>{quote.lineItems.length>1&&<button className="btn-del" style={{padding:"1px 7px"}} onClick={()=>removeLI(li.id)}>✕</button>}</td>}
            </tr>;
          })}</tbody>
        </table>
        {!ro&&<div style={{padding:"7px 10px",borderTop:"1px solid #161616",background:"#0a0a0a"}}>
          <button className="btn" style={{fontSize:10,padding:"4px 12px"}} onClick={addLI}>+ Add Line Item</button>
        </div>}
      </div>

      {/* Notes + Total */}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,border:"1px solid #1e1e1e",padding:12}}>
        <div>
          <div style={{fontSize:9,color:"#444",letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Notes</div>
          <textarea disabled={ro} value={quote.notes} onChange={e=>upd("notes",e.target.value)}
            style={{width:"100%",height:64,resize:"vertical",fontSize:11,background:"var(--input-bg)",border:"1px solid var(--border)",color:"var(--text)"}} placeholder="Add notes…"/>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"space-between",minWidth:190}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:"#666",letterSpacing:".08em"}}>TOTAL ({quote.currency})</div>
            <div style={{fontSize:20,fontWeight:600,color:"#c8a96e",fontVariantNumeric:"tabular-nums"}}>{fmtCur(total)}</div>
          </div>
          {ro
            ? <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"stretch"}}>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn" style={{flex:1,fontSize:11}} onClick={()=>onEmail(quote)}>✉ Email</button>
                  <button className="btn" style={{flex:1,fontSize:11,color:"#c8a96e"}} onClick={()=>onPDF(quote)}>↓ PDF</button>
                </div>
                <button className="btn" style={{fontSize:11}} onClick={()=>onEdit(quote)}>Make Edits</button>
              </div>
            : <button className="btn-gold" onClick={()=>onSave(quote)}>SAVE</button>}
        </div>
      </div>
    </div>
  );
}

// ─── DIMS Tab ──────────────────────────────────────────────────────────────────
function DimsTab({dims,setDims}) {
  const [editing,setEditing] = useState(null);
  const [adding,setAdding] = useState(false);
  const [newRow,setNewRow] = useState({product:"",type:"Pallet",pieces:"",L:"",W:"",H:"",weight:"",indWeight:""});
  const [search,setSearch] = useState("");
  const [filterType,setFilterType] = useState("All");

  const types = useMemo(()=>["All",...new Set(dims.map(d=>d.type))],[dims]);
  const filtered = useMemo(()=>dims.filter(d=>{
    const q=search.toLowerCase();
    const matchS=!q||(d.product||"").toLowerCase().includes(q)||(d.type||"").toLowerCase().includes(q);
    const matchT=filterType==="All"||d.type===filterType;
    return matchS&&matchT;
  }),[dims,search,filterType]);

  function handleImport(e) {
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const lines=ev.target.result.split("\n").filter(l=>l.trim());
      const rows=lines.slice(1).map(line=>{
        const cols=line.split(",").map(c=>c.replace(/^"|"$/g,"").replace(/""/g,'"').trim());
        return {product:cols[0]||"",type:cols[1]||"",pieces:cols[2]||"",L:cols[3]||"",W:cols[4]||"",H:cols[5]||"",weight:cols[6]||"",indWeight:cols[7]||""};
      }).filter(r=>r.product);
      setDims(rows);
    };
    reader.readAsText(file);
    e.target.value="";
  }

  function saveNew(){setDims(d=>[...d,{...newRow}]);setNewRow({product:"",type:"Pallet",pieces:"",L:"",W:"",H:"",weight:"",indWeight:""});setAdding(false);}
  function saveEdit(row){setDims(d=>d.map((r,i)=>i===editing.idx?row:r));setEditing(null);}
  function removeRow(idx){setDims(d=>d.filter((_,i)=>i!==idx));}

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #181818",display:"flex",alignItems:"center",gap:10,background:"#090909",flexWrap:"wrap"}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".12em",color:"#555"}}>DIMS — Package Dimensions</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{height:26,fontSize:11,width:160}}/>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{height:26,fontSize:11,background:"#141414"}}>
          {types.map(t=><option key={t}>{t}</option>)}
        </select>
        <div style={{flex:1}}/>
        <label className="btn" style={{fontSize:10,padding:"4px 10px",cursor:"pointer"}}>
          ↑ Import CSV<input type="file" accept=".csv" style={{display:"none"}} onChange={handleImport}/>
        </label>
        <button className="btn" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setAdding(true)}>+ Add Row</button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        <table className="data-table">
          <thead><tr>
            <th>Product</th>
            <th>Type</th>
            <th>Pieces</th>
            <th>L</th><th>W</th><th>H</th>
            <th>Weight</th>
            <th>Ind. Weight</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((row,i)=>{
              const origIdx=dims.indexOf(row);
              return editing?.idx===origIdx
                ? <DimEditRow key={i} row={editing.data} setRow={d=>setEditing(e=>({...e,data:d}))} onSave={()=>saveEdit(editing.data)} onCancel={()=>setEditing(null)}/>
                : <tr key={i}>
                    <td style={{color:"#c8a96e",fontFamily:"monospace",fontSize:11}}>{row.product}</td>
                    <td><span style={{background:"#141414",border:"1px solid #202020",padding:"1px 7px",fontSize:9,borderRadius:1,color:"#888",letterSpacing:".05em"}}>{row.type}</span></td>
                    <td style={{color:"#888"}}>{row.pieces||"—"}</td>
                    <td style={{fontFamily:"monospace",fontSize:11}}>{row.L||"—"}</td>
                    <td style={{fontFamily:"monospace",fontSize:11}}>{row.W||"—"}</td>
                    <td style={{fontFamily:"monospace",fontSize:11}}>{row.H||"—"}</td>
                    <td style={{fontFamily:"monospace",fontSize:11}}>{row.weight||"—"}</td>
                    <td style={{fontFamily:"monospace",fontSize:11,color:"#666"}}>{row.indWeight||"—"}</td>
                    <td style={{display:"flex",gap:5}}>
                      <button className="btn" style={{fontSize:10,padding:"2px 8px"}} onClick={()=>setEditing({idx:origIdx,data:{...row}})}>Edit</button>
                      <button className="btn-del" onClick={()=>removeRow(origIdx)}>✕</button>
                    </td>
                  </tr>;
            })}
            {adding&&<DimEditRow row={newRow} setRow={setNewRow} onSave={saveNew} onCancel={()=>setAdding(false)}/>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DimEditRow({row,setRow,onSave,onCancel}) {
  const f=(k)=>({value:row[k]??"",onChange:e=>setRow(r=>({...r,[k]:e.target.value})),style:{width:"100%",fontSize:11,height:24}});
  return (
    <tr style={{background:"#161614"}}>
      <td><input {...f("product")}/></td>
      <td>
        <select value={row.type||"Pallet"} onChange={e=>setRow(r=>({...r,type:e.target.value}))} style={{width:"100%",fontSize:11,height:24,background:"#1a1a18"}}>
          {["Pallet","BMP Box","BMP Bag","Box","Bundle","Other"].map(t=><option key={t}>{t}</option>)}
        </select>
      </td>
      <td><input {...f("pieces")}/></td>
      <td><input {...f("L")}/></td><td><input {...f("W")}/></td><td><input {...f("H")}/></td>
      <td><input {...f("weight")}/></td>
      <td><input {...f("indWeight")}/></td>
      <td style={{display:"flex",gap:4}}>
        <button className="btn-gold" style={{padding:"3px 10px",fontSize:10}} onClick={onSave}>✓</button>
        <button className="btn" style={{fontSize:10}} onClick={onCancel}>✕</button>
      </td>
    </tr>
  );
}

// ─── Shipping Tab ──────────────────────────────────────────────────────────────
function ShippingTab({T}) {
  const [origin, setOrigin] = useState("calgary");
  const [dest,   setDest]   = useState("edmonton");
  const [markup, setMarkup] = useState(0);
  const [editingCell, setEditingCell] = useState(null); // {sectionKey, type, rowIdx, colIdx}
  const [overrides, setOverrides] = useState({}); // key: "sectionKey.type.rowIdx.colIdx" => value

  const sectionKey = `${origin}${dest.charAt(0).toUpperCase()+dest.slice(1)}`;
  const section = SHIPPING_DATA[sectionKey];

  function getVal(sk, type, ri, ci) {
    const k = `${sk}.${type}.${ri}.${ci}`;
    if (overrides[k] !== undefined) return overrides[k];
    return SHIPPING_DATA[sk]?.[type]?.rows?.[ri]?.vals?.[ci] ?? "";
  }

  function setVal(sk, type, ri, ci, v) {
    const k = `${sk}.${type}.${ri}.${ci}`;
    setOverrides(o => ({...o, [k]: v === "" ? "" : parseFloat(v) || ""}));
  }

  function applyMarkup(pct) {
    if (!pct) return;
    const newOv = {...overrides};
    ["calgaryEdmonton","calgaryVancouver","brooksEdmonton","brooksVancouver"].forEach(sk => {
      ["type1","type2"].forEach(type => {
        const rows = SHIPPING_DATA[sk]?.[type]?.rows || [];
        rows.forEach((row, ri) => {
          row.vals.forEach((v, ci) => {
            if (!v && v !== 0) return;
            const k = `${sk}.${type}.${ri}.${ci}`;
            const base = overrides[k] !== undefined ? overrides[k] : v;
            if (base === "" || base === null) return;
            newOv[k] = Math.round(parseFloat(base) * (1 + pct/100) * 100) / 100;
          });
        });
      });
    });
    setOverrides(newOv);
  }

  function resetAll() { setOverrides({}); setMarkup(0); }

  const brooksRules = [
    { vol:"1 or 2 curtain pallets to EDM", carrier:"Rosneau",              pricing:"Jeff to quote 2 pallets" },
    { vol:'1 curtain pallet over 50" to VAN',  carrier:"TEAMS",            pricing:"Use Chart Above" },
    { vol:'1 curtain pallet under 50" to VAN', carrier:"Mustang c/o Hwy 9",pricing:"Use Chart Above" },
    { vol:"3 Curtain pallets",            carrier:"TEAMS",                  pricing:"Jeff to Quote" },
    { vol:"Everything else",              carrier:"Jeff to Quote",          pricing:"Jeff to Quote" },
  ];

  const ShippingTable = ({sk, data, type}) => (
    <div style={{marginBottom:20}}>
      <div style={{background:T.tableHead,borderBottom:`1px solid ${T.border}`,padding:"6px 10px",fontSize:10,color:T.tableHeadText,letterSpacing:".08em",textTransform:"uppercase"}}>
        <span style={{color:T.accent}}>{data.label}</span>
      </div>
      <div style={{overflowX:"auto"}}>
        <table className="data-table" style={{"--row-hover":T.rowHover}}>
          <thead>
            <tr style={{background:T.tableHead}}>
              <th style={{minWidth:110,color:T.tableHeadText}}>Depth</th>
              {[1,2,3,4,5,6,7,8,9,10].map(n=><th key={n} style={{textAlign:"right",minWidth:76,color:T.tableHeadText}}>{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row,ri)=>(
              <tr key={ri} style={{background:T.cardBg}}>
                <td style={{color:T.subtext,fontWeight:500,fontSize:12}}>{row.depth}</td>
                {row.vals.map((_, ci)=>{
                  const v = getVal(sk, type, ri, ci);
                  const isEditing = editingCell?.sk===sk && editingCell?.type===type && editingCell?.ri===ri && editingCell?.ci===ci;
                  const hasOverride = overrides[`${sk}.${type}.${ri}.${ci}`] !== undefined;
                  return (
                    <td key={ci} style={{textAlign:"right",padding:"4px 6px",position:"relative"}}>
                      {isEditing
                        ? <input autoFocus type="number" step="0.01"
                            defaultValue={v}
                            onBlur={e=>{setVal(sk,type,ri,ci,e.target.value);setEditingCell(null);}}
                            onKeyDown={e=>{if(e.key==="Enter"){setVal(sk,type,ri,ci,e.target.value);setEditingCell(null);}if(e.key==="Escape")setEditingCell(null);}}
                            style={{width:72,textAlign:"right",fontSize:11,height:24,background:T.inputBg,color:T.text,border:`1px solid ${T.accent}`,padding:"0 4px"}}/>
                        : <div
                            onClick={()=>setEditingCell(v || v===0 ? {sk,type,ri,ci} : null)}
                            onDoubleClick={()=>setEditingCell({sk,type,ri,ci})}
                            style={{fontFamily:"monospace",fontSize:11,cursor:v||v===0?"pointer":"default",
                              color: hasOverride ? T.accent : v ? T.subtext : T.muted,
                              padding:"3px 4px",borderRadius:1,
                              background: isEditing?"transparent":"transparent",
                              minWidth:60,display:"inline-block",textAlign:"right"}}>
                            {v || v===0 ? `$${parseFloat(v).toFixed(2)}` : "—"}
                          </div>
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:9,color:T.muted,padding:"3px 10px"}}>Click a value to edit · Double-click empty cells to add</div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:T.bg}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,background:T.panelBg,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".12em",color:T.sectionLabel}}>Turbidity Curtain Shipping</div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontSize:10,color:T.sectionLabel}}>From</span>
          {["calgary","brooks"].map(o=>(
            <button key={o} onClick={()=>setOrigin(o)}
              style={{padding:"4px 12px",fontSize:10,background:origin===o?T.accent:T.btnBg,color:origin===o?"#fff":T.btnText,border:origin===o?"none":`1px solid ${T.btnBorder}`,cursor:"pointer",letterSpacing:".05em",textTransform:"capitalize"}}>
              {o.charAt(0).toUpperCase()+o.slice(1)}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontSize:10,color:T.sectionLabel}}>To</span>
          {["edmonton","vancouver"].map(d=>(
            <button key={d} onClick={()=>setDest(d)}
              style={{padding:"4px 12px",fontSize:10,background:dest===d?T.accent:T.btnBg,color:dest===d?"#fff":T.btnText,border:dest===d?"none":`1px solid ${T.btnBorder}`,cursor:"pointer",letterSpacing:".05em",textTransform:"capitalize"}}>
              {d.charAt(0).toUpperCase()+d.slice(1)}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center",marginLeft:8}}>
          <span style={{fontSize:10,color:T.sectionLabel}}>Markup all</span>
          {[10,15,20,30].map(pct=>(
            <button key={pct} onClick={()=>{setMarkup(pct);applyMarkup(pct);}}
              style={{padding:"4px 10px",fontSize:10,background:markup===pct?T.accent:T.btnBg,color:markup===pct?"#fff":T.btnText,border:markup===pct?"none":`1px solid ${T.btnBorder}`,cursor:"pointer",fontWeight:markup===pct?600:400}}>
              +{pct}%
            </button>
          ))}
          {(Object.keys(overrides).length>0||markup>0)&&(
            <button onClick={resetAll}
              style={{padding:"4px 10px",fontSize:10,background:"transparent",color:"#c84444",border:"1px solid #3a1818",cursor:"pointer"}}>
              Reset
            </button>
          )}
        </div>
        <div style={{fontSize:9,color:T.muted,marginLeft:"auto"}}>Qty = number of 50' sections</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 14px 0"}}>
        {section ? (
          <>
            <ShippingTable sk={sectionKey} data={section.type1} type="type1"/>
            <ShippingTable sk={sectionKey} data={section.type2} type="type2"/>
            {origin==="brooks"&&<div style={{fontSize:9,color:"#8a8020",background:T.panelBg,border:`1px solid ${T.border}`,padding:"4px 10px",marginBottom:14,display:"inline-block"}}>★ Includes 15% (CAD)</div>}
          </>
        ) : <div style={{color:T.muted,padding:20}}>No data for this route.</div>}
        <div style={{border:`1px solid ${T.border}`,background:T.panelBg,padding:14,marginBottom:16,borderLeft:`3px solid ${T.accent}`}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".14em",color:T.tableHeadText,marginBottom:10}}>⚑ Brooks Rules — Freight Carrier Guidelines</div>
          <table className="data-table">
            <thead><tr>
              <th style={{color:T.tableHeadText}}>Volume / Size of Pallet</th>
              <th style={{color:T.tableHeadText}}>Who Should You Use?</th>
              <th style={{color:T.tableHeadText}}>How to Price It?</th>
            </tr></thead>
            <tbody>{brooksRules.map((r,i)=>(
              <tr key={i} style={{background:T.cardBg}}>
                <td style={{color:T.subtext}}>{r.vol}</td>
                <td style={{color:T.accent,fontWeight:500}}>{r.carrier}</td>
                <td style={{color:T.muted}}>{r.pricing}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Products Tab ──────────────────────────────────────────────────────────────
function ProductsTab({products,setProducts,currency,setCurrency,search,setSearch,categories,setCategories,T}) {
  const [editing,      setEditing]      = useState(null);
  const [sortF,        setSortF]        = useState("sku");
  const [sortD,        setSortD]        = useState(1);
  const [importResult, setImportResult] = useState(null);
  const [sampleCSVOpen,setSampleCSVOpen]= useState(false);
  const [selected,     setSelected]     = useState(new Set());   // selected SKUs
  const [catModal,     setCatModal]     = useState(false);       // assign category modal
  const [catInput,     setCatInput]     = useState("");          // typed category name
  const [collapsed,    setCollapsed]    = useState(new Set());   // collapsed category names
  const [viewMode,     setViewMode]     = useState("grouped");   // "grouped" | "flat"

  const SAMPLE_CSV = `SKU,Product,Product Description,Truck Volume,Package Volume,Pallet Volume,Price Per,Pallet Price Per,Prepaid Price Per,Prepaid Pallet Price Per,Truck Price Per,category
TBC1250T2IND,Turbidity Curtain,12.5x50 Turbidity Curtain Type 2 IND,,1,8,$1210.00,,,,,Turbidity Curtain
4CBD2416HF,CB Donut - 24x16 HF,CB Donut High Flow Yellow for 24x16 Grate,,12,192,$60.00,$56.50,$63.00,$61.00,,Catch Basin Protection
NEW-SKU-001,New Product Name,Full product description here,,6,48,$99.00,$94.00,,,$85.00,Misc. BMP Products`;

  // All unique category names — ordered by CATEGORY_ORDER, extras appended alphabetically
  const allCategories = useMemo(()=> {
    const assigned = new Set(Object.values(categories).filter(Boolean));
    const ordered = CATEGORY_ORDER.filter(c => assigned.has(c));
    const extras = Array.from(assigned).filter(c => !CATEGORY_ORDER.includes(c)).sort();
    return [...ordered, ...extras, "Uncategorized"];
  }, [categories]);

  // Sort helper
  function sortProducts(arr) {
    return [...arr].sort((a,b)=>String(a[sortF]??"").localeCompare(String(b[sortF]??""),undefined,{numeric:true})*sortD);
  }

  // Group products by category
  const grouped = useMemo(()=>{
    const map = {};
    allCategories.forEach(cat => { map[cat] = []; });
    products.forEach(p => {
      const cat = categories[p.sku] || "Uncategorized";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    // Sort within each group
    Object.keys(map).forEach(k => { map[k] = sortProducts(map[k]); });
    return map;
  }, [products, categories, sortF, sortD, allCategories]);

  const flatSorted = useMemo(()=>sortProducts(products), [products, sortF, sortD]);

  function hs(f){if(sortF===f)setSortD(d=>-d);else{setSortF(f);setSortD(1);}}
  const Th=({l,f,style={}})=><th onClick={()=>hs(f)} style={{cursor:"pointer",userSelect:"none",...style}}>{l}{sortF===f?(sortD===1?" ↑":" ↓"):""}</th>;

  function toggleSelect(sku) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(sku) ? n.delete(sku) : n.add(sku);
      return n;
    });
  }
  function selectAll() {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map(p=>p.sku)));
  }
  function toggleCollapse(cat) {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  }
  function assignCategory() {
    if (!catInput.trim()) return;
    const cat = catInput.trim();
    setCategories(prev => {
      const next = {...prev};
      selected.forEach(sku => { next[sku] = cat; });
      return next;
    });
    setSelected(new Set());
    setCatModal(false);
    setCatInput("");
  }
  function removeCategory(sku) {
    setCategories(prev => { const n={...prev}; delete n[sku]; return n; });
  }
  function removeCategoryAll(cat) {
    setCategories(prev => {
      const n={...prev};
      Object.keys(n).forEach(k=>{ if(n[k]===cat) delete n[k]; });
      return n;
    });
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      const lines = text.split(/[\r\n]+/).filter(l => l.trim());
      if (lines.length < 2) return;
      const parseCSVLine = line => {
        const result = []; let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; }
          else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        result.push(cur.trim()); return result;
      };
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g,"").toLowerCase().replace(/[^a-z0-9]/g,""));
      const col = (...names) => { for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; } return -1; };
      const iSku=col("sku"), iProduct=col("product","productname","name"), iDesc=col("productdescription","description","desc"),
            iPkg=col("packagevolume","pkgqty","pkg","packageqty"), iPallet=col("palletvolume","palletqty","pallet"),
            iTruck=col("truckvolume","truck"), iPrice=col("priceper","price","unitprice"),
            iPalletP=col("palletpriceper","palletprice"), iPrepaid=col("prepaidpriceper","prepaid","prepaidprice"),
            iPrepaidP=col("prepaidpalletpriceper","prepaidpalletprice","prepaidpallet"), iTruckP=col("truckpriceper","truckprice"),
            iCat=col("category","cat","group","productcategory");
      if (iSku < 0) { setImportResult({ error: "No SKU column found." }); return; }
      const pp = v => { if (!v||v==="") return ""; const n=parseFloat(String(v).replace(/[$,\s]/g,"")); return isNaN(n)?"":n; };
      let updated=0,added=0,skipped=0; const log=[];
      setProducts(prev => {
        const next=[...prev];
        for (let i=1;i<lines.length;i++) {
          const cols=parseCSVLine(lines[i]);
          const sku=cols[iSku]?.replace(/"/g,"").trim();
          if (!sku){skipped++;continue;}
          const incoming={sku,
            ...(iProduct>=0&&cols[iProduct]?{product:cols[iProduct].replace(/"/g,"").trim()}:{}),
            ...(iDesc>=0&&cols[iDesc]?{description:cols[iDesc].replace(/"/g,"").trim()}:{}),
            ...(iPkg>=0?{pkg:cols[iPkg]?.replace(/"/g,"").trim()||""}:{}),
            ...(iPallet>=0?{pallet:cols[iPallet]?.replace(/"/g,"").trim()||""}:{}),
            ...(iTruck>=0?{truck:cols[iTruck]?.replace(/"/g,"").trim()||""}:{}),
            ...(iPrice>=0?{price:pp(cols[iPrice])}:{}),
            ...(iPalletP>=0?{palletPrice:pp(cols[iPalletP])}:{}),
            ...(iPrepaid>=0?{prepaid:pp(cols[iPrepaid])}:{}),
            ...(iPrepaidP>=0?{prepaidPallet:pp(cols[iPrepaidP])}:{}),
            ...(iTruckP>=0?{truckPrice:pp(cols[iTruckP])}:{}),
          };
          const idx=next.findIndex(p=>p.sku===sku);
          if(idx>=0){next[idx]={...next[idx],...incoming};updated++;log.push({sku,action:"updated"});}
          else{next.push({sku,product:"",description:"",pkg:"",pallet:"",truck:"",price:"",palletPrice:"",prepaid:"",prepaidPallet:"",truckPrice:"",...incoming});added++;log.push({sku,action:"added"});}
          // Apply category from column L if present
          if(iCat>=0 && cols[iCat]?.replace(/"/g,"").trim()){
            const catVal = cols[iCat].replace(/"/g,"").trim();
            setCategories(prev=>({...prev,[sku]:catVal}));
          }
        }
        return next;
      });
      setImportResult({updated,added,skipped,log,currency});
    };
    reader.readAsText(file);
    e.target.value="";
  }

  // ── Row renderer (shared for flat + grouped) ─────────────────────────────
  const ProductRow = ({p}) => {
    const isSelected = selected.has(p.sku);
    const cat = categories[p.sku];
    return editing?.sku===p.sku
      ? <ProductEditRow key={p.sku} row={editing} setRow={setEditing}
          onSave={()=>{setProducts(ps=>ps.map(r=>r.sku===editing.sku?editing:r));setEditing(null);}}
          onCancel={()=>setEditing(null)}/>
      : <tr key={p.sku} style={{background:isSelected?(T===DARK?"#1a1a14":"#f0ede4"):T.cardBg}}>
          <td style={{padding:"4px 8px",width:32}}>
            <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(p.sku)}
              style={{cursor:"pointer",accentColor:"#c8a96e",width:13,height:13}}/>
          </td>
          <td style={{fontFamily:"monospace",fontSize:11,color:T.accent,whiteSpace:"nowrap"}}>{p.sku}</td>
          <td style={{fontSize:11,fontWeight:500,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.product}</td>
          <td style={{fontSize:11,color:T.muted,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.description}</td>
          <td style={{fontSize:11,fontFamily:"monospace",color:T.tableHeadText,textAlign:"right"}}>{p.pkg||"—"}</td>
          <td style={{fontSize:11,fontFamily:"monospace",color:T.tableHeadText,textAlign:"right"}}>{p.pallet||"—"}</td>
          <td style={{fontSize:11,fontFamily:"monospace",textAlign:"right",color:parsePrice(p.price)>0?T.subtext:T.muted}}>{fmtCur(p.price)}</td>
          <td style={{fontSize:11,fontFamily:"monospace",textAlign:"right",color:parsePrice(p.palletPrice)>0?T.subtext:T.muted}}>{fmtCur(p.palletPrice)}</td>
          <td style={{fontSize:11,fontFamily:"monospace",textAlign:"right",color:parsePrice(p.prepaid)>0?"#9ec89e":T.muted}}>{fmtCur(p.prepaid)}</td>
          <td style={{fontSize:11,fontFamily:"monospace",textAlign:"right",color:parsePrice(p.prepaidPallet)>0?"#9ec89e":T.muted}}>{fmtCur(p.prepaidPallet)}</td>
          <td style={{fontSize:11,fontFamily:"monospace",textAlign:"right",color:parsePrice(p.truckPrice)>0?T.subtext:T.muted}}>{fmtCur(p.truckPrice)}</td>
          <td>
            <div style={{display:"flex",gap:4}}>
              <button className="btn" style={{fontSize:10,padding:"2px 8px"}} onClick={()=>setEditing({...p})}>Edit</button>
              {cat && <button className="btn-del" style={{fontSize:9,padding:"2px 6px"}} title={`Remove from "${cat}"`} onClick={()=>removeCategory(p.sku)}>✕</button>}
            </div>
          </td>
        </tr>;
  };

  const tableHeaders = (
    <tr>
      <th style={{width:32,padding:"7px 8px"}}>
        <input type="checkbox" onChange={selectAll} checked={selected.size===products.length&&products.length>0}
          style={{cursor:"pointer",accentColor:"#c8a96e",width:13,height:13}}/>
      </th>
      <Th l="SKU" f="sku"/>
      <Th l="Product" f="product"/>
      <th>Description</th>
      <Th l="Pkg" f="pkg" style={{textAlign:"right"}}/>
      <Th l="Pallet" f="pallet" style={{textAlign:"right"}}/>
      <Th l="Price/Unit" f="price" style={{textAlign:"right"}}/>
      <Th l="Pallet Price" f="palletPrice" style={{textAlign:"right"}}/>
      <Th l="Prepaid" f="prepaid" style={{textAlign:"right"}}/>
      <Th l="Prepaid Pallet" f="prepaidPallet" style={{textAlign:"right"}}/>
      <Th l="Truck Price" f="truckPrice" style={{textAlign:"right"}}/>
      <th>Actions</th>
    </tr>
  );

  const filteredFlat = useMemo(()=>{
    if (!search) return flatSorted;
    const q=search.toLowerCase();
    return flatSorted.filter(p=>p.sku.toLowerCase().includes(q)||p.product.toLowerCase().includes(q)||p.description.toLowerCase().includes(q));
  },[flatSorted, search]);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:T.bg}}>

      {/* Import result modal */}
      {importResult && (
        <div className="modal-overlay" onClick={()=>setImportResult(null)}>
          <div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
            {importResult.error
              ? <><div style={{color:"#c84444",fontSize:12,marginBottom:12}}>⚠ Import Error</div><div style={{fontSize:12,color:T.muted,marginBottom:14}}>{importResult.error}</div><button className="btn" onClick={()=>setImportResult(null)}>Close</button></>
              : <>
                  <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".12em",color:T.tableHeadText,marginBottom:14}}>Import Complete — {importResult.currency} Price List</div>
                  <div style={{display:"flex",gap:20,marginBottom:16}}>
                    {[{n:importResult.added,l:"Added",c:"#5a9e5a"},{n:importResult.updated,l:"Updated",c:"#c8a96e"},{n:importResult.skipped,l:"Skipped",c:T.muted}].map(({n,l,c})=>(
                      <div key={l} style={{textAlign:"center"}}>
                        <div style={{fontSize:24,fontWeight:600,color:c}}>{n}</div>
                        <div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:".08em"}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  {importResult.log?.length>0&&(
                    <div style={{maxHeight:220,overflowY:"auto",border:`1px solid ${T.border}`,marginBottom:14}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                        <thead><tr>
                          <th style={{background:T.tableHead,color:T.tableHeadText,padding:"5px 10px",textAlign:"left",fontSize:10,position:"sticky",top:0}}>SKU</th>
                          <th style={{background:T.tableHead,color:T.tableHeadText,padding:"5px 10px",textAlign:"left",fontSize:10,position:"sticky",top:0}}>Action</th>
                        </tr></thead>
                        <tbody>{importResult.log.map((r,i)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                            <td style={{padding:"4px 10px",fontFamily:"monospace",color:T.accent}}>{r.sku}</td>
                            <td style={{padding:"4px 10px",color:r.action==="added"?"#5a9e5a":"#c8a96e",textTransform:"uppercase",fontSize:10}}>{r.action}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                  <button className="btn-gold" style={{fontSize:11}} onClick={()=>setImportResult(null)}>Done</button>
                </>
            }
          </div>
        </div>
      )}

      {/* Sample CSV modal */}
      {sampleCSVOpen && (
        <div className="modal-overlay" onClick={()=>setSampleCSVOpen(false)}>
          <div className="modal" style={{maxWidth:700,width:"94%"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:10,letterSpacing:".12em",textTransform:"uppercase",color:T.tableHeadText}}>Sample Import CSV — Copy contents, save as <span style={{color:T.accent}}>.csv</span></div>
              <button style={{background:"none",border:"none",color:T.muted,fontSize:14}} onClick={()=>setSampleCSVOpen(false)}>✕</button>
            </div>
            <div style={{fontSize:9,color:T.muted,marginBottom:8,lineHeight:1.6}}>— First row is the header · SKU is the only required column · Leave others blank to skip · Prices: $60.00 or 60</div>
            <div style={{background:T.panelBg||"#090909",border:`1px solid ${T.border}`,padding:"10px 12px",marginBottom:10}}>
              <div style={{fontSize:9,color:T.muted,letterSpacing:".06em",marginBottom:6,textTransform:"uppercase"}}>Column names — click to select all</div>
              <div style={{fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",fontSize:11,color:T.accent,lineHeight:1.8,cursor:"text",userSelect:"all"}}>
                SKU,Product,Product Description,Truck Volume,Package Volume,Pallet Volume,Price Per,Pallet Price Per,Prepaid Price Per,Prepaid Pallet Price Per,Truck Price Per
              </div>
            </div>
            <div style={{marginBottom:10}}>
              {["SKU","Product","Product Description","Truck Volume","Package Volume","Pallet Volume","Price Per","Pallet Price Per","Prepaid Price Per","Prepaid Pallet Price Per","Truck Price Per","category"].map((col,i)=>(
                <div key={i} style={{display:"flex",gap:12,marginBottom:3,alignItems:"center"}}>
                  <div style={{fontSize:10,color:T.muted,fontFamily:"monospace",width:20,textAlign:"right"}}>{i+1}</div>
                  <div style={{fontSize:11,color:T.accent,fontFamily:"monospace",background:T.tableHead,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:1}}>{col}</div>
                </div>
              ))}
            </div>
            <button className="btn" style={{fontSize:11}} onClick={()=>setSampleCSVOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Assign Category modal */}
      {catModal && (
        <div className="modal-overlay" onClick={()=>setCatModal(false)}>
          <div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".12em",color:T.tableHeadText,marginBottom:14}}>
              Assign Category — {selected.size} item{selected.size!==1?"s":""} selected
            </div>
            <div style={{fontSize:9,color:T.muted,marginBottom:10}}>Type a new category or pick an existing one:</div>
            <input value={catInput} onChange={e=>setCatInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") assignCategory(); if(e.key==="Escape") setCatModal(false); }}
              placeholder="e.g. Turbidity Curtains" autoFocus
              style={{width:"100%",fontSize:12,height:32,marginBottom:10}}/>
            {allCategories.filter(c=>c!=="Uncategorized").length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:9,color:T.muted,marginBottom:6,letterSpacing:".06em",textTransform:"uppercase"}}>Existing categories</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {allCategories.filter(c=>c!=="Uncategorized").map(cat=>(
                    <button key={cat} onClick={()=>setCatInput(cat)}
                      style={{padding:"4px 12px",fontSize:11,background:catInput===cat?T.accent:T.tableHead,
                        color:catInput===cat?"#fff":T.subtext,border:`1px solid ${T.border}`,cursor:"pointer",borderRadius:2}}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn" onClick={()=>setCatModal(false)}>Cancel</button>
              <button className="btn-gold" onClick={assignCategory} disabled={!catInput.trim()}>Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,background:T.panelBg||T.headerBg,flexWrap:"wrap"}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".12em",color:T.sectionLabel}}>Product &amp; Price List</div>
        <div style={{display:"flex",gap:3}}>
          {["CAD","USD"].map(c=>(
            <button key={c} onClick={()=>setCurrency(c)}
              style={{padding:"4px 12px",fontSize:10,background:currency===c?T.accent:T.btnBg,color:currency===c?"#fff":T.btnText,border:currency===c?"none":`1px solid ${T.btnBorder}`,cursor:"pointer",letterSpacing:".05em"}}>
              {c}
            </button>
          ))}
        </div>
        {/* View toggle */}
        <div style={{display:"flex",gap:3}}>
          {[["grouped","⊞ Grouped"],["flat","≡ Flat"]].map(([v,l])=>(
            <button key={v} onClick={()=>setViewMode(v)}
              style={{padding:"4px 10px",fontSize:10,background:viewMode===v?T.btnBg:T.tableHead,color:viewMode===v?T.accent:T.muted,border:`1px solid ${viewMode===v?T.accent:T.border}`,cursor:"pointer"}}>
              {l}
            </button>
          ))}
        </div>
        {currency==="USD"&&<span style={{fontSize:9,color:"#554",background:"#111108",border:"1px solid #2a2808",padding:"3px 8px"}}>USD prices not set — import or edit</span>}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search SKU, product, description…"
          style={{flex:1,maxWidth:260,height:26,fontSize:11}}/>
        {/* Selected actions */}
        {selected.size>0&&(
          <div style={{display:"flex",gap:6,alignItems:"center",background:T.tableHead,border:`1px solid ${T.accent}`,padding:"3px 10px",borderRadius:2}}>
            <span style={{fontSize:10,color:T.accent,fontWeight:600}}>{selected.size} selected</span>
            <button className="btn-gold" style={{fontSize:10,padding:"3px 12px"}} onClick={()=>{setCatInput("");setCatModal(true);}}>Assign Category</button>
            <button className="btn" style={{fontSize:10,padding:"3px 10px"}} onClick={()=>setSelected(new Set())}>Clear</button>
          </div>
        )}
        <div style={{fontSize:9,color:T.muted,marginLeft:"auto"}}>{products.length} items</div>
        <label className="btn" style={{fontSize:10,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>
          ↑ Import {currency} CSV<input type="file" accept=".csv" style={{display:"none"}} onChange={handleImport}/>
        </label>
        <button className="btn" style={{fontSize:10,padding:"4px 10px",whiteSpace:"nowrap"}} onClick={()=>setSampleCSVOpen(true)}>↓ Sample CSV</button>
      </div>

      {/* Table */}
      <div style={{flex:1,overflowY:"auto"}}>
        <table className="data-table">
          <thead>{tableHeaders}</thead>
          <tbody>
            {viewMode==="flat"
              ? filteredFlat.map(p=><ProductRow key={p.sku} p={p}/>)
              : allCategories.map(cat=>{
                  const rows = grouped[cat]||[];
                  if(rows.length===0) return null;
                  // Filter by search
                  const q=search.toLowerCase();
                  const visible = q ? rows.filter(p=>p.sku.toLowerCase().includes(q)||p.product.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)) : rows;
                  if(visible.length===0) return null;
                  const isCollapsed = collapsed.has(cat);
                  return [
                    // Category header row
                    <tr key={`cat-${cat}`} style={{background:T.tableHead,cursor:"pointer"}} onClick={()=>toggleCollapse(cat)}>
                      <td colSpan={12} style={{padding:"7px 12px",userSelect:"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:12,color:T.accent,transition:"transform .15s",display:"inline-block",transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)"}}>▾</span>
                          <span style={{fontSize:11,fontWeight:600,color:T.subtext,letterSpacing:".04em"}}>{cat}</span>
                          <span style={{fontSize:9,color:T.muted,marginLeft:2}}>({visible.length})</span>
                          {cat!=="Uncategorized"&&(
                            <button className="btn-del" style={{marginLeft:"auto",fontSize:9,padding:"1px 8px"}}
                              onClick={e=>{e.stopPropagation();removeCategoryAll(cat);}}>Remove category</button>
                          )}
                        </div>
                      </td>
                    </tr>,
                    // Product rows
                    ...(!isCollapsed ? visible.map(p=><ProductRow key={p.sku} p={p}/>) : [])
                  ];
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductEditRow({row,setRow,onSave,onCancel}) {
  const f=(k,type="text")=>({type,value:row[k]??"",onChange:e=>setRow(r=>({...r,[k]:e.target.value})),style:{width:"100%",fontSize:11,height:24}});
  return (
    <tr style={{background:"#14140e"}}>
      <td><span style={{fontSize:11,color:"#c8a96e"}}>{row.sku}</span></td>
      <td><input {...f("product")}/></td>
      <td><input {...f("description")}/></td>
      <td><input {...f("pkg")}/></td>
      <td><input {...f("pallet")}/></td>
      <td><input {...f("price","number")} step="0.01"/></td>
      <td><input {...f("palletPrice","number")} step="0.01"/></td>
      <td><input {...f("prepaid","number")} step="0.01"/></td>
      <td><input {...f("prepaidPallet","number")} step="0.01"/></td>
      <td><input {...f("truckPrice","number")} step="0.01"/></td>
      <td style={{display:"flex",gap:4}}>
        <button className="btn-gold" style={{padding:"3px 8px",fontSize:10}} onClick={onSave}>✓</button>
        <button className="btn" style={{fontSize:10}} onClick={onCancel}>✕</button>
      </td>
    </tr>
  );
}

// ─── PDF Modal ─────────────────────────────────────────────────────────────────
function PDFModal({quote:q, onClose}) {
  const [freight,    setFreight]    = useState("");
  const [discount,   setDiscount]   = useState("");
  const [validDays,  setValidDays]  = useState(30);
  const [contact,    setContact]    = useState(q.name||"");
  const [payTerms,   setPayTerms]   = useState("Net 30 days from invoice date");
  const [bmpNotes,   setBmpNotes]   = useState(q.notes||"");
  const [showPreview,setShowPreview]= useState(false);
  const iframeRef = useRef(null);

  const subtotal   = q.lineItems.reduce((a,li)=>a+(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0),0);
  const freightVal = parseFloat(freight)||0;
  const discountVal= parseFloat(discount)||0;
  const grandTotal = subtotal + freightVal - discountVal;

  const today     = new Date();
  const todayStr  = today.toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"numeric"});
  const validDate = new Date(today); validDate.setDate(today.getDate()+validDays);
  const validStr  = validDate.toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"numeric"});
  const fmt = v=>`$${parseFloat(v||0).toLocaleString("en-CA",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  function buildHTML() {
    // Max 9 line items
    const items = q.lineItems.slice(0,9);
    const rows = items.map((li,i)=>{
      const lt=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
      const bg = i%2===0?"#ffffff":"#f7f7f7";
      return `<tr style="background:${bg};">
        <td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;font-size:11px;color:#222;">${li.description||"—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;font-size:10.5px;font-family:'Courier New',monospace;color:#444;white-space:nowrap;">${li.sku||""}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;font-size:11px;text-align:right;color:#333;">${li.unitPrice?fmt(li.unitPrice):"$ —"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;font-size:11px;text-align:center;color:#333;">${li.qty||""}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;font-size:11px;text-align:right;font-weight:600;color:#111;">${lt?fmt(lt):"$ —"}</td>
      </tr>`;
    }).join("");

    // Pad to 9 rows
    const padCount = Math.max(0, 9 - items.length);
    const padRows = Array(padCount).fill(`<tr style="background:#fff;"><td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;">&nbsp;</td><td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;"></td><td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;"></td><td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;"></td><td style="padding:7px 10px;border-bottom:1px solid #e8e8e4;"></td></tr>`).join("");

    const totalRows = `
      ${freightVal>0?`<tr><td colspan="4" style="text-align:right;padding:5px 10px;font-size:11px;color:#555;">Freight / Shipping</td><td style="text-align:right;padding:5px 10px;font-size:11px;font-weight:500;">${fmt(freightVal)}</td></tr>`:""}
      ${discountVal>0?`<tr><td colspan="4" style="text-align:right;padding:5px 10px;font-size:11px;color:#555;">Discount</td><td style="text-align:right;padding:5px 10px;font-size:11px;font-weight:500;">-${fmt(discountVal)}</td></tr>`:""}
      <tr style="background:#1a1a1a;">
        <td colspan="4" style="padding:9px 10px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#aaa;font-weight:600;">Total :</td>
        <td style="padding:9px 10px;text-align:right;font-size:15px;font-weight:700;color:#fff;white-space:nowrap;">$ ${grandTotal.toLocaleString("en-CA",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      </tr>`;

    const DISCLAIMER = "The Information provided by BMP Supplies Inc. has shown to be correct and is generally based on information supplied by the manufacturers of the product offered. Any recommendations made by BMP Supplies Inc. concerning uses or applications of our products are also believed to be reliable; however, as BMP Supplies Inc. has no control over design, execution, and field conditions of the project which incorporate the product, BMP Supplies Inc. disclaims all warranties, expressed or implied, including, without limitation, the warranties of merchantability and/ or fitness for a particular purpose.";

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:215.9mm;min-height:279.4mm;background:#fff;}
  body{font-family:Avenir,'Avenir Next','Helvetica Neue',Arial,sans-serif;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12px;}
  h1,h2,h3,.label-font{font-family:Raleway,'Helvetica Neue',Arial,sans-serif;}
  @page{size:8.5in 11in;margin:0;}
  @media print{.no-print{display:none!important;} body{margin:0;}}
  .page{width:215.9mm;min-height:279.4mm;padding:14mm 14mm 10mm 14mm;display:flex;flex-direction:column;background:#fff;}
</style>
</head><body>
<div class="page">

  <!-- TOP: Logo left, QUOTE right -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10mm;">
    <div>
      <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAD/Au4DASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//9k=" style="height:48px;width:auto;mix-blend-mode:multiply;" alt="BMP Supplies"/>
      <div style="font-size:10px;color:#888;margin-top:5px;letter-spacing:.04em;">All-in-one ESC Manufacturer</div>
      <div style="margin-top:8px;font-size:9.5px;color:#555;line-height:1.8;">
        102 - 19181 34a Ave, Surrey, BC, V3Z 0Z7<br/>
        604.542.0222 | sales@bmpsupplies.com
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:48px;font-weight:700;color:#1a1a1a;line-height:1;letter-spacing:-.01em;font-family:Raleway,sans-serif;">Quote</div>
    </div>
  </div>

  <!-- Divider -->
  <div style="border-top:1px solid #d0d0cc;margin-bottom:6mm;"></div>

  <!-- Meta grid: left=customer info, right=quote details -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:6mm;align-items:start;">
    <!-- Left: notes box -->
    <div style="padding-right:16px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#aaa;font-weight:700;margin-bottom:5px;">BMP Notes</div>
      <div style="border:1px solid #d8d8d4;min-height:52px;padding:7px 10px;font-size:10.5px;color:#444;line-height:1.6;background:#fafaf8;">${bmpNotes||""}</div>
      <div style="font-size:10px;color:#555;margin-top:6px;">${q.currency}</div>
    </div>
    <!-- Right: quote fields -->
    <div style="padding-left:16px;border-left:1px solid #e8e8e4;">
      ${[
        ["Date", todayStr],
        ["Quotation #", q.quoteNum],
        ["Customer", q.company||q.name||"—"],
        ["Contact", contact||q.name||"—"],
        ["Quotation valid until", validStr],
        ["Prepared by", q.savedBy||"Paul Lindemulder"],
      ].map(([l,v])=>`
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;border-bottom:1px solid #efefed;">
          <span style="font-size:10px;font-weight:600;color:#333;">${l}:</span>
          <span style="font-size:10.5px;color:#1a1a1a;text-align:right;">${v}</span>
        </div>`).join("")}
    </div>
  </div>

  <!-- Line items table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:0;flex:1;">
    <thead>
      <tr style="background:#1a1a1a;">
        <th style="padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#fff;font-weight:600;width:38%;">Description</th>
        <th style="padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#fff;font-weight:600;width:18%;">SKU</th>
        <th style="padding:8px 10px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#fff;font-weight:600;width:16%;">Price/per</th>
        <th style="padding:8px 10px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#fff;font-weight:600;width:12%;">Qty</th>
        <th style="padding:8px 10px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#fff;font-weight:600;width:16%;">Total Price</th>
      </tr>
    </thead>
    <tbody>
      ${rows}${padRows}${totalRows}
    </tbody>
  </table>

  <!-- Payment terms + tax note -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:5mm;padding-top:4mm;border-top:1px solid #e0e0dc;">
    <div style="flex:1;padding-right:20px;">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#aaa;font-weight:700;margin-bottom:4px;">Payment Terms</div>
      <div style="font-size:10px;color:#555;line-height:1.7;">${payTerms}</div>
    </div>
    <div style="font-size:9.5px;color:#aaa;font-style:italic;text-align:right;padding-left:20px;">Tax not included</div>
  </div>

  <!-- Disclaimer -->
  <div style="margin-top:auto;padding-top:5mm;border-top:1px solid #efefed;">
    <p style="font-size:7.5px;color:#bbb;line-height:1.65;text-align:center;">${DISCLAIMER}</p>
  </div>

  <!-- Footer -->
  <div style="text-align:center;margin-top:4mm;padding-top:3mm;border-top:1px solid #efefed;">
    <span style="font-size:8px;color:#ccc;letter-spacing:.06em;">bmpsupplies.com</span>
  </div>

</div>

<div class="no-print" style="position:fixed;bottom:16px;right:16px;display:flex;gap:8px;z-index:999;">
  <button onclick="window.print()" style="background:#1a1a1a;color:#fff;border:none;padding:10px 20px;font-size:12px;cursor:pointer;font-family:Raleway,sans-serif;font-weight:600;letter-spacing:.04em;">🖨 Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#e8e8e4;color:#333;border:none;padding:10px 16px;font-size:12px;cursor:pointer;font-family:Raleway,sans-serif;">Close</button>
</div>
</body></html>`;
  }

  useEffect(()=>{
    if(showPreview && iframeRef.current){
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      doc.open(); doc.write(buildHTML()); doc.close();
    }
  },[showPreview]);

  function doPrint(){
    if(iframeRef.current) iframeRef.current.contentWindow.print();
  }

  // ── Preview screen ───────────────────────────────────────────────────────
  if(showPreview) return (
    <div style={{position:"fixed",inset:0,background:"#2a2a2a",zIndex:200,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",gap:8,padding:"10px 16px",alignItems:"center",background:"#111",borderBottom:"1px solid #222",flexShrink:0}}>
        <div style={{fontSize:10,color:"#666",letterSpacing:".1em",textTransform:"uppercase",flex:1}}>{q.quoteNum} — {q.company||q.name} — Print Preview</div>
        <button onClick={doPrint}
          style={{background:"#c8a96e",border:"none",color:"#0a0a0a",padding:"8px 20px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",letterSpacing:".06em"}}>
          🖨 Print / Save as PDF
        </button>
        <button onClick={()=>setShowPreview(false)}
          style={{background:"#1a1a1a",border:"1px solid #333",color:"#ccc",padding:"8px 14px",fontSize:11,cursor:"pointer",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>
          ← Edit Details
        </button>
        <button onClick={onClose}
          style={{background:"transparent",border:"1px solid #333",color:"#666",padding:"8px 14px",fontSize:11,cursor:"pointer",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>
          Close
        </button>
      </div>
      <div style={{flex:1,overflow:"auto",display:"flex",justifyContent:"center",padding:"24px",background:"#2a2a2a"}}>
        <iframe ref={iframeRef} style={{width:"215.9mm",height:"279.4mm",border:"none",background:"#fff",boxShadow:"0 4px 32px rgba(0,0,0,.5)",flexShrink:0}}/>
      </div>
    </div>
  );

  // ── Details form ─────────────────────────────────────────────────────────
  const F = ({label,value,onChange,placeholder=""}) => (
    <div style={{marginBottom:8}}>
      <div style={{fontSize:9,color:"#666",letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",fontSize:11,height:26,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#ccc",padding:"0 8px"}}/>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"#111",border:"1px solid #222",width:"100%",maxWidth:680,padding:"24px 28px"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontSize:11,color:"#c8a96e",letterSpacing:".1em",textTransform:"uppercase",fontWeight:600}}>{q.quoteNum} — {q.company||q.name||"Quote"}</div>
            <div style={{fontSize:9,color:"#555",marginTop:2}}>Fill in any extra details then preview</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#555",fontSize:16,cursor:"pointer"}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
          {/* Left col */}
          <div style={{background:"#0d0d0d",border:"1px solid #1e1e1e",padding:"14px 16px"}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".14em",color:"#888",marginBottom:12,fontWeight:600}}>Quote Details</div>
            <F label="Contact Name" value={contact} onChange={setContact} placeholder={q.name||"Contact person"}/>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:"#666",letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>Valid For</div>
              <select value={validDays} onChange={e=>setValidDays(parseInt(e.target.value))}
                style={{width:"100%",fontSize:11,height:26,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#ccc"}}>
                {[14,21,30,45,60,90].map(d=><option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <F label="Freight / Shipping ($)" value={freight} onChange={setFreight} placeholder="0.00"/>
            <F label="Discount ($)" value={discount} onChange={setDiscount} placeholder="0.00"/>
            <F label="Payment Terms" value={payTerms} onChange={setPayTerms} placeholder="Net 30 days..."/>
          </div>

          {/* Right col: summary */}
          <div style={{background:"#0d0d0d",border:"1px solid #1e1e1e",padding:"14px 16px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".14em",color:"#888",marginBottom:6,fontWeight:600}}>BMP Notes (appears on quote)</div>
            <textarea value={bmpNotes} onChange={e=>setBmpNotes(e.target.value)} placeholder="Internal notes or special instructions..."
              style={{width:"100%",height:72,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#ccc",fontSize:11,padding:"6px 8px",resize:"vertical",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}/>
            <div style={{marginTop:8,background:"#0a0a0a",border:"1px solid #1a1a1a",padding:"10px 12px"}}>
              {[
                ["Subtotal", fmtCur(subtotal)],
                ...(freightVal>0?[["Freight", fmtCur(freightVal)]]:[]),
                ...(discountVal>0?[["Discount", "-"+fmtCur(discountVal)]]:[]),
              ].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#888",marginBottom:4}}>
                  <span>{l}</span><span style={{fontFamily:"monospace"}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#c8a96e",marginTop:6,paddingTop:6,borderTop:"1px solid #222"}}>
                <span>Total ({q.currency})</span>
                <span style={{fontFamily:"monospace"}}>{fmtCur(grandTotal)}</span>
              </div>
              <div style={{fontSize:9,color:"#444",marginTop:4,fontStyle:"italic"}}>* Tax not included</div>
            </div>
          </div>
        </div>

        {/* Items preview */}
        <div style={{background:"#0d0d0d",border:"1px solid #1e1e1e",marginBottom:18}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",color:"#555",padding:"7px 12px",borderBottom:"1px solid #1a1a1a"}}>
            {q.lineItems.length} line item{q.lineItems.length!==1?"s":""}{q.lineItems.length>9?" (first 9 will print)":""}
          </div>
          <div style={{overflowX:"auto",maxHeight:160,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              {q.lineItems.slice(0,9).map((li,i)=>{
                const lt=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
                return <tr key={i} style={{borderBottom:"1px solid #141414"}}>
                  <td style={{padding:"5px 12px",color:"#aaa",width:"38%"}}>{li.description||"—"}</td>
                  <td style={{padding:"5px 12px",fontFamily:"monospace",fontSize:10,color:"#c8a96e",width:"18%"}}>{li.sku||""}</td>
                  <td style={{padding:"5px 12px",textAlign:"right",color:"#888",width:"16%",fontFamily:"monospace"}}>{fmtCur(li.unitPrice)}</td>
                  <td style={{padding:"5px 12px",textAlign:"center",color:"#888",width:"12%"}}>{li.qty}</td>
                  <td style={{padding:"5px 12px",textAlign:"right",color:"#ccc",fontFamily:"monospace",fontWeight:600,width:"16%"}}>{fmtCur(lt)}</td>
                </tr>;
              })}
            </table>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{background:"transparent",border:"1px solid #2a2a2a",color:"#666",padding:"9px 18px",fontSize:11,cursor:"pointer",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>Cancel</button>
          <button onClick={()=>setShowPreview(true)}
            style={{background:"#c8a96e",border:"none",color:"#0a0a0a",padding:"9px 26px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",letterSpacing:".06em"}}>
            Preview &amp; Print →
          </button>
        </div>
      </div>
    </div>
  );
}
