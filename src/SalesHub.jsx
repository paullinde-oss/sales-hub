import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { initializeApp } from "firebase/app";

const APP_VERSION = "v2.8 — Jun 2025";
const FAVICON_DARK  = "data:image/png;base64,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";
const FAVICON_LIGHT = "data:image/png;base64,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";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";

// ─── Firebase config ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC3hkMEFm9fbJTjRF_btbPwnBEP5aTT_iY",
  authDomain: "bmp-sales-hub.firebaseapp.com",
  projectId: "bmp-sales-hub",
  storageBucket: "bmp-sales-hub.firebasestorage.app",
  messagingSenderId: "209813734426",
  appId: "1:209813734426:web:9acf48246c5427c53b3da3"
};
const fbApp = initializeApp(firebaseConfig);
const db   = getFirestore(fbApp);

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
    truck: <><rect x="1" y="6" width="14" height="12" rx="1" stroke={color} strokeWidth="1.5" fill="none"/><path d="M15 9h4l3 4v5h-7V9z" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="5" cy="19" r="2" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="18" cy="19" r="2" stroke={color} strokeWidth="1.5" fill="none"/></>,
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
  { sku:"BMP-SSNS08", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, truckQty:600, pkg:"", pallet:25, price:"", palletPrice:34.5, prepaid:"", prepaidPallet:"", truckPrice:30.0 },
  { sku:"BMP-SSNS16", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", truckQty:600, pkg:"", pallet:20, price:"", palletPrice:69.0, prepaid:"", prepaidPallet:"", truckPrice:60.0 },
  { sku:"BMP-SSNS08JR", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:173.0, prepaid:"", prepaidPallet:"", truckPrice:150.5 },
  { sku:"BMP-SSNS16JR", product:"Standard (Plastic) - Single Net - 100% Straw", description:"Std-Single Net Straw Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:346.5, prepaid:"", prepaidPallet:"", truckPrice:301.0 },
  { sku:"BMP-SDNS08", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, truckQty:600, pkg:"", pallet:25, price:"", palletPrice:38.0, prepaid:"", prepaidPallet:"", truckPrice:33.0 },
  { sku:"BMP-SDNS16", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:76.5, prepaid:"", prepaidPallet:"", truckPrice:66.5 },
  { sku:"BMP-SDNS08JR", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:192.0, prepaid:"", prepaidPallet:"", truckPrice:167.0 },
  { sku:"BMP-SDNS16JR", product:"Standard (Plastic) - Double Net - 100% Straw", description:"Std-Double Net Straw Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:385.0, prepaid:"", prepaidPallet:"", truckPrice:334.0 },
  { sku:"BMP-SDNSC08", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:67.0, prepaid:"", prepaidPallet:"", truckPrice:58.0 },
  { sku:"BMP-SDNSC16", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:76.5, prepaid:"", prepaidPallet:"", truckPrice:117.0 },
  { sku:"BMP-SDNSC08JR", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:192.0, prepaid:"", prepaidPallet:"", truckPrice:299.0 },
  { sku:"BMP-SDNSC16JR", product:"Standard (Plastic) - Double Net - 70% Straw 30% Coconut", description:"Std-Double Net Straw Coconut Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:385.0, prepaid:"", prepaidPallet:"", truckPrice:598.5 },
  { sku:"BMP-SDNC08", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, truckQty:600, pkg:"", pallet:25, price:"", palletPrice:98.0, prepaid:"", prepaidPallet:"", truckPrice:85.0 },
  { sku:"BMP-SDNC16", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:196.0, prepaid:"", prepaidPallet:"", truckPrice:170.5 },
  { sku:"BMP-SDNC08JR", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:498.0, prepaid:"", prepaidPallet:"", truckPrice:426.0 },
  { sku:"BMP-SDNC16JR", product:"Standard (Plastic) - Double Net - 100% Coconut", description:"Std-Double Net Coconut Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:997.5, prepaid:"", prepaidPallet:"", truckPrice:852.5 },
  { sku:"BMP-BDNS08", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, truckQty:600, pkg:"", pallet:25, price:"", palletPrice:94.5, prepaid:"", prepaidPallet:"", truckPrice:82.5 },
  { sku:"BMP-BDNS16", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket - 16' x 112.5' (200sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:189.75, prepaid:"", prepaidPallet:"", truckPrice:165.0 },
  { sku:"BMP- BDNS08JR", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:472.0, prepaid:"", prepaidPallet:"", truckPrice:412.0 },
  { sku:"BMP-BDNS16JR", product:"Biodegradable (Jute) - Double Net - 100% Straw", description:"Bio-Double Net Straw Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:945.0, prepaid:"", prepaidPallet:"", truckPrice:824.0 },
  { sku:"BMP-BDNSC08", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, pkg:"", pallet:25, price:"", palletPrice:95.75, prepaid:"", prepaidPallet:"", truckPrice:83.25 },
  { sku:"BMP-BDNSC16", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket - 16' x 112.5' (1000sy / 167m²)", truck:"", pkg:"", pallet:20, price:"", palletPrice:190.0, prepaid:"", prepaidPallet:"", truckPrice:166.5 },
  { sku:"BMP-BDNSC08JR", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket Jumbo Roll - 8' x 562.5' (500sy / 418m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:478.0, prepaid:"", prepaidPallet:"", truckPrice:416.25 },
  { sku:"BMP-BDNSC16JR", product:"Biodegradable (Jute) - Double Net - 70% Straw 30% Coconut", description:"Bio-Double Net Straw Coconut Blanket Jumbo Roll - 16' x 562.5' (1000sy / 836m²)", truck:"", pkg:"", pallet:4, price:"", palletPrice:956.0, prepaid:"", prepaidPallet:"", truckPrice:832.0 },
  { sku:"BMP-BDNC08", product:"Biodegradable (Jute) - Double Net - 100% Coconut", description:"Bio-Double Net Coconut Blanket - 8' x 112.5' (100sy / 83m²)", truck:600, truckQty:600, pkg:"", pallet:25, price:"", palletPrice:133.5, prepaid:"", prepaidPallet:"", truckPrice:116.5 },
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
  { sku:"STW0925", product:"Straw Wattle", description:"Standard Straw Wattle - 9 x 25'", truck:364, truckQty:364, pkg:"", pallet:14, price:"", palletPrice:27.0, prepaid:"", prepaidPallet:"", truckPrice:25.0 },
  { sku:"STW1220", product:"Straw Wattle", description:"Standard Straw Wattle - 12 x 20'", truck:312, truckQty:312, pkg:"", pallet:12, price:"", palletPrice:27.0, prepaid:"", prepaidPallet:"", truckPrice:25.0 },
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

const PRICE_INCREASE_OPTIONS = [0,2,5,10,15,20,25,30,35,40,50,55,60];
function fmtCur(val) {
  if (val === "" || val === null || val === undefined) return "—";
  const n = parseFloat(String(val).replace(/[$,]/g,""));
  if (isNaN(n) || n === 0) return "—";
  return `$${n.toLocaleString("en-CA",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
// Determine price tier based on qty and product thresholds
function getPriceTier(prod, qty, prepaid) {
  if (!prod) return {price:0, tier:"unit"};
  const q = parseInt(qty)||0;
  const truckQty  = parseInt(prod.truckQty)||0;
  const palletQty = parseInt(prod.pallet)||0;
  const pkgQty    = parseInt(prod.pkg)||0;

  // Truck price: needs truckQty set AND truckPrice AND qty >= truckQty
  if (truckQty>0 && parsePrice(prod.truckPrice)>0 && q>=truckQty) {
    return {price:parsePrice(prod.truckPrice), tier:"truck"};
  }
  // Pallet price: qty >= pallet qty (full pallet)
  if (palletQty>0 && parsePrice(prod.palletPrice)>0 && q>=palletQty) {
    if (prepaid && parsePrice(prod.prepaidPallet)>0) return {price:parsePrice(prod.prepaidPallet), tier:"prepaid pallet"};
    return {price:parsePrice(prod.palletPrice), tier:"pallet"};
  }
  // Prepaid unit price
  if (prepaid && parsePrice(prod.prepaid)>0) return {price:parsePrice(prod.prepaid), tier:"prepaid"};
  // Standard unit price
  if (parsePrice(prod.price)>0) return {price:parsePrice(prod.price), tier:"unit"};
  // Fallback to pallet price
  if (parsePrice(prod.palletPrice)>0) return {price:parsePrice(prod.palletPrice), tier:"pallet"};
  return {price:0, tier:"unit"};
}

function parsePrice(str) {
  if (!str && str !== 0) return 0;
  return parseFloat(String(str).replace(/[$,]/g,"")) || 0;
}
function nextQNum(existingQuotes) {
  // Find highest existing quote number and go one higher
  let max = 44002;
  (existingQuotes || []).forEach(q => {
    const match = String(q.quoteNum || "").match(/BMP(\d+)/);
    if (match) max = Math.max(max, parseInt(match[1]));
  });
  // Also check localStorage in case quotes haven't loaded from Firebase yet
  try {
    const stored = JSON.parse(localStorage.getItem('bmp_quotes') || '[]');
    stored.forEach(q => {
      const match = String(q.quoteNum || "").match(/BMP(\d+)/);
      if (match) max = Math.max(max, parseInt(match[1]));
    });
  } catch {}
  return `BMP${max + 1}`;
}

// ─── Main App ──────────────────────────────────────────────────────────────────
// ─── Persistent storage hook ───────────────────────────────────────────────────
function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });
  const setAndStore = useCallback((update) => {
    setVal(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [val, setAndStore];
}

// ─── Mobile detection hook ─────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function SalesHub() {
  const isMobile = useIsMobile();
  const [authed, setAuthed] = useLocalStorage('bmp_authed', false);
  const [loginName, setLoginName] = useLocalStorage('bmp_user', '');
  const [loginError, setLoginError] = useState("");

  const VALID_NAMES = ["Paul", "Mark", "Grant", "Jeff", "John"];

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
  const [productsCAD, setProductsCAD] = useLocalStorage('bmp_products_cad', INITIAL_PRODUCTS_CAD);
  const [productsUSD, setProductsUSD] = useLocalStorage('bmp_products_usd',
    INITIAL_PRODUCTS_CAD.map(p=>({...p,price:"",palletPrice:"",prepaid:"",prepaidPallet:"",truckPrice:""}))
  );
  const [dims, setDims] = useLocalStorage('bmp_dims', INITIAL_DIMS);
  const [quotes, setQuotes] = useState([]);  // synced from Firebase
  const [activeQuote, setActiveQuote] = useState(null);
  const [searchQ, setSearchQ] = useState({name:"",company:"",date:"",madeBy:"",quoteNum:"",sku:"",description:""});
  const [quoteSort, setQuoteSort] = useLocalStorage('bmp_quote_sort', 'asc');
  const [exchangeRate, setExchangeRate] = useLocalStorage('bmp_exchange_rate', 0.73); // asc = oldest first (BMP44004 top)
  const [productCurrency, setProductCurrency] = useState("CAD");
  const [productSearch, setProductSearch] = useState("");
  const [emailModal, setEmailModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [closeConfirm, setCloseConfirm] = useState(null); // quote to confirm close on
  const [pdfQuote, setPdfQuote] = useState(null);
  const [categories, setCategories] = useLocalStorage('bmp_categories', INITIAL_CATEGORIES);
  const [theme, setTheme] = useLocalStorage('bmp_theme', 'light');
  const [mobileTab, setMobileTab] = useState('quotes');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail' for quotes
  const T = theme === "dark" ? DARK : LIGHT;

  // Update browser tab favicon when theme changes
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") || (() => {
      const l = document.createElement('link');
      l.rel = 'icon'; document.head.appendChild(l); return l;
    })();
    link.href = theme === 'dark' ? FAVICON_DARK : FAVICON_LIGHT;
    link.type = 'image/png';
  }, [theme]);
  const LOGO_B64 = ""; // logo injected at print time

  // ── Firebase: listen for quotes in real time ──────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "quotes"), orderBy("savedDate", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setQuotes(loaded);
    }, (err) => {
      console.warn("Firebase read error:", err);
    });
    return () => unsub();
  }, []);

  const currentProducts = productCurrency==="CAD" ? productsCAD : productsUSD;
  const setCurrentProducts = productCurrency==="CAD" ? setProductsCAD : setProductsUSD;

  // Effective USD products — if a USD price field is blank, auto-convert from CAD using exchange rate
  const effectiveProductsUSD = useMemo(() => {
    const conv = (usdVal, cadVal, rate) => {
      const u = parseFloat(usdVal);
      if (!isNaN(u) && u > 0) return usdVal;
      const c = parseFloat(cadVal);
      if (!isNaN(c) && c > 0) return Math.round(c * rate * 100) / 100;
      return "";
    };
    try {
      return (productsUSD||[]).map((usdP) => {
        const cadP = (productsCAD||[]).find(p => p.sku === usdP.sku);
        if (!cadP) return usdP;
        return {
          ...usdP,
          price:         conv(usdP.price,         cadP.price,         exchangeRate),
          palletPrice:   conv(usdP.palletPrice,   cadP.palletPrice,   exchangeRate),
          prepaid:       conv(usdP.prepaid,       cadP.prepaid,       exchangeRate),
          prepaidPallet: conv(usdP.prepaidPallet, cadP.prepaidPallet, exchangeRate),
          truckPrice:    conv(usdP.truckPrice,    cadP.truckPrice,    exchangeRate),
        };
      });
    } catch(e) { return productsUSD; }
  }, [productsUSD, productsCAD, exchangeRate]);

  const filteredQuotes = useMemo(()=>quotes.filter(q=>{
    const s=searchQ;
    // Check if any line item matches SKU or description search
    const skuMatch = !s.sku || q.lineItems?.some(li =>
      li.sku?.toLowerCase().includes(s.sku.toLowerCase()));
    const descMatch = !s.description || q.lineItems?.some(li =>
      li.description?.toLowerCase().includes(s.description.toLowerCase()));
    return (!s.name||q.name.toLowerCase().includes(s.name.toLowerCase()))&&
      (!s.company||q.company.toLowerCase().includes(s.company.toLowerCase()))&&
      (!s.date||q.savedDate?.includes(s.date))&&
      (!s.madeBy||q.savedBy?.toLowerCase().includes(s.madeBy.toLowerCase()))&&
      (!s.quoteNum||q.quoteNum?.toLowerCase().includes(s.quoteNum.toLowerCase()))&&
      skuMatch && descMatch;
  }),[quotes,searchQ]);

  const filteredProducts = useMemo(()=>{
    if (!productSearch) return currentProducts;
    const q=productSearch.toLowerCase();
    return currentProducts.filter(p=>p.sku.toLowerCase().includes(q)||p.product.toLowerCase().includes(q)||p.description.toLowerCase().includes(q));
  },[currentProducts,productSearch]);

  function createNewQuote() {
    const q={id:Date.now(),quoteNum:nextQNum(quotes),name:"",company:"",prepaid:false,currency:"CAD",
      lineItems:[{id:Date.now(),sku:"",description:"",qty:1,unitPrice:0,increase:0,basePrice:0}],
      notes:"",internalNotes:"",saved:false,savedBy:"",savedDate:""};
    setActiveQuote(q);
  }
  function saveQuote(q) {
    const saved={...q,saved:true,savedBy:loginName,savedDate:new Date().toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"})};
    // Save to Firebase — use quoteNum as doc ID so it's readable
    const docId = String(saved.id);
    setDoc(doc(db, "quotes", docId), saved)
      .catch(err => console.error("Firebase save error:", err));
    setActiveQuote(saved);
  }
  function deleteQuote(id) {
    // Delete from Firebase
    deleteDoc(doc(db, "quotes", String(id)))
      .catch(err => console.error("Firebase delete error:", err));
    if(activeQuote?.id===id) setActiveQuote(null);
    setDeleteConfirm(null);
  }

  function duplicateQuote(q) {
    const newId = Date.now();
    const newNum = nextQNum(quotes);
    // Normalize each line item to ensure all fields exist
    const srcItems = Array.isArray(q.lineItems) && q.lineItems.length > 0 ? q.lineItems : [];
    const newItems = srcItems.map((li, i) => ({
      id: Date.now() + i + Math.random(),
      sku:         li.sku         || "",
      description: li.description || "",
      qty:         parseInt(li.qty)         || 1,
      unitPrice:   parseFloat(li.unitPrice) || 0,
      increase:    parseFloat(li.increase)  || 0,
      basePrice:   parseFloat(li.basePrice) || 0,
      priceTier:   li.priceTier || "unit",
    }));
    if (newItems.length === 0) newItems.push({id:Date.now(),sku:"",description:"",qty:1,unitPrice:0,increase:0,basePrice:0,priceTier:"unit"});
    const duped = {
      id:            newId,
      quoteNum:      newNum,
      name:          q.name          || "",
      company:       q.company       || "",
      prepaid:       q.prepaid       || false,
      currency:      q.currency      || "CAD",
      notes:         q.notes         || "",
      internalNotes: q.internalNotes || "",
      saved:         false,
      savedBy:       "",
      savedDate:     "",
      lineItems:     newItems,
    };
    setActiveQuote(duped);
  }
  function openEmailModal(q) {
    const total=(q.lineItems||[]).reduce((a,li)=>a+(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0),0);
    const prods=[...new Set((q.lineItems||[]).map(li=>li.description||li.sku).filter(Boolean))].join(", ");

    // HTML version — Outlook-compatible table (inline styles only, no classes)
    const rowsHtml=(q.lineItems||[]).map(li=>{
      const lt=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
      return `<tr>
        <td style="border:1px solid #000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:12px;">${li.sku||"—"}</td>
        <td style="border:1px solid #000;padding:5px 8px;font-family:Calibri,Arial,sans-serif;font-size:12px;">${li.description||"—"}</td>
        <td style="border:1px solid #000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:12px;">${li.qty}</td>
        <td style="border:1px solid #000;padding:5px 8px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:12px;">${fmtCur(li.unitPrice)}</td>
        <td style="border:1px solid #000;padding:5px 8px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:bold;">${fmtCur(lt)}</td>
      </tr>`;
    }).join("");

    const bottomRow=`<tr>
      <td colspan="3" style="border:1px solid #000;padding:6px 12px;font-family:Calibri,Arial,sans-serif;font-size:12px;color:#555;font-style:italic;background:#f9f9f9;">${q.notes?"Notes: "+q.notes:""}</td>
      <td style="border:1px solid #000;padding:6px 12px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;background:#f5f5f5;">Total (${q.currency})</td>
      <td style="border:1px solid #000;padding:6px 12px;text-align:right;font-family:Calibri,Arial,sans-serif;font-size:13px;font-weight:bold;background:#f5f5f5;">${fmtCur(total)}</td>
    </tr>`;

    const html=`<div style="font-family:Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#000;">
<table style="border-collapse:collapse;width:640px;margin:16px 0;table-layout:fixed;">
  <thead>
    <tr>
      <th style="border:1px solid #000;padding:7px 10px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:bold;text-align:center;width:130px;">SKU</th>
      <th style="border:1px solid #000;padding:7px 10px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:bold;text-align:center;">Description</th>
      <th style="border:1px solid #000;padding:7px 10px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:bold;text-align:center;width:50px;">Qty</th>
      <th style="border:1px solid #000;padding:7px 10px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:bold;text-align:center;width:100px;">Unit Price</th>
      <th style="border:1px solid #000;padding:7px 10px;background:#000;color:#fff;font-family:Calibri,Arial,sans-serif;font-size:12px;font-weight:bold;text-align:center;width:100px;">Total Price</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    ${bottomRow}
  </tbody>
</table>
<p>Let me know if you have any questions or need additional information.</p>
<p>Thank you,</p>
</div>`;

    // Plain-text fallback
    const plain=`${(q.lineItems||[]).map(li=>`${li.sku||"—"}  |  ${li.description||"—"}  |  Qty: ${li.qty}  |  Unit: ${fmtCur(li.unitPrice)}  |  Total: ${fmtCur((parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0))}`).join("\n")}\n\nTotal (${q.currency}): ${fmtCur(total)}${q.notes?`\nNotes: ${q.notes}`:""}\n\nLet me know if you have any questions or need additional information.\n\nThank you,`;

    setEmailModal({html, plain});
  }

  function generatePDF(q) {
    setPdfQuote(q);
  }


  const TABS = [
    {id:"quotes",   label:"Quote Maker",     icon:"quote"},
    {id:"dims",     label:"DIMS",            icon:"dims"},
    {id:"shipping", label:"Shipping",        icon:"ship"},
    {id:"products", label:"Products",        icon:"products"},
    {id:"loadcalc", label:"Load Calculator", icon:"truck"},
  ];

  // ── Mobile layout ────────────────────────────────────────────────────────
  if (authed && isMobile) return (
    <MobileLayout
      T={T} theme={theme} setTheme={setTheme}
      activeTab={mobileTab} setActiveTab={setMobileTab}
      mobileView={mobileView} setMobileView={setMobileView}
      quotes={filteredQuotes} allQuotes={quotes}
      activeQuote={activeQuote} setActiveQuote={setActiveQuote}
      createNewQuote={createNewQuote} saveQuote={saveQuote}
      editQuote={q=>setActiveQuote({...q,saved:false})}
      deleteQuote={deleteQuote} duplicateQuote={duplicateQuote}
      deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
      closeConfirm={closeConfirm} setCloseConfirm={setCloseConfirm}
      searchQ={searchQ} setSearchQ={setSearchQ} quoteSort={quoteSort} setQuoteSort={setQuoteSort}
      productsCAD={productsCAD} productsUSD={productsUSD} effectiveProductsUSD={effectiveProductsUSD}
      openEmailModal={openEmailModal} generatePDF={generatePDF}
      dims={dims} setDims={setDims}
      loginName={loginName} setAuthed={setAuthed} setLoginName={setLoginName}
    />
  );

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
        <div style={{fontSize:8,color:T.muted,opacity:.5,letterSpacing:".06em",userSelect:"none"}}>{APP_VERSION}</div>
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
            productsCAD={productsCAD} productsUSD={effectiveProductsUSD} createNewQuote={createNewQuote}
            setActiveQuote={setActiveQuote} saveQuote={saveQuote} editQuote={q=>setActiveQuote({...q,saved:false})}
            openEmailModal={openEmailModal} generatePDF={generatePDF} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} deleteQuote={deleteQuote} duplicateQuote={duplicateQuote} quoteSort={quoteSort} setQuoteSort={setQuoteSort} closeConfirm={closeConfirm} setCloseConfirm={setCloseConfirm} exchangeRate={exchangeRate} T={T}/>}
          {activeTab==="dims"&&<DimsTab dims={dims} setDims={setDims} T={T}/>}
          {activeTab==="shipping"&&<ShippingTab T={T}/>}
          {activeTab==="products"&&<ProductsTab products={filteredProducts} setProducts={setCurrentProducts}
            currency={productCurrency} setCurrency={setProductCurrency} search={productSearch} setSearch={setProductSearch}
            categories={categories} setCategories={setCategories}
            exchangeRate={exchangeRate} setExchangeRate={setExchangeRate} T={T}/>}
          {activeTab==="loadcalc"&&<LoadCalcTab T={T}/>}
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

      {/* Close / Save Confirm */}
      {closeConfirm&&(
        <div className="modal-overlay" onClick={()=>setCloseConfirm(null)}>
          <div className="modal" style={{maxWidth:400,textAlign:"center",padding:"32px 28px"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:24,marginBottom:12}}>💾</div>
            <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:8}}>Save before closing?</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:24}}>
              <span style={{color:"#c8a96e",fontWeight:600}}>{closeConfirm.quoteNum}</span>
              {closeConfirm.company||closeConfirm.name?" — "+(closeConfirm.company||closeConfirm.name):""}
              {" "}has unsaved changes.
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <button className="btn" style={{padding:"9px 20px",fontSize:12}}
                onClick={()=>setCloseConfirm(null)}>
                Keep editing
              </button>
              <button className="btn-del" style={{padding:"9px 20px",fontSize:12}}
                onClick={()=>{setActiveQuote(null);setCloseConfirm(null);}}>
                Discard
              </button>
              <button className="btn-gold" style={{padding:"9px 20px",fontSize:12}}
                onClick={()=>{saveQuote(closeConfirm);setCloseConfirm(null);}}>
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm&&(
        <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth:380,textAlign:"center",padding:"32px 28px"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:12}}>🗑️</div>
            <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:8}}>You sure about that?</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:6}}>
              This will permanently delete quote <span style={{color:"#c8a96e",fontWeight:600}}>{deleteConfirm.quoteNum}</span>
            </div>
            <div style={{fontSize:11,color:T.muted,marginBottom:24}}>
              {deleteConfirm.company||deleteConfirm.name?"for "+( deleteConfirm.company||deleteConfirm.name):""}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn" style={{padding:"9px 24px",fontSize:12}} onClick={()=>setDeleteConfirm(null)}>
                No, keep it
              </button>
              <button className="btn-del" style={{padding:"9px 24px",fontSize:12,fontWeight:600}}
                onClick={()=>deleteQuote(deleteConfirm.id)}>
                Yes, delete it
              </button>
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

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportQuotesCSV(quotes) {
  const escape = v => {
    const s = String(v||"").replace(/"/g,'""');
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s}"` : s;
  };
  const headers = ['Customer Name','Company','Currency','Prepaid','Quote #','SKUs','Total','Saved By','Date Saved','Quote Notes'];
  const rows = (quotes||[]).map(q => {
    const skus = (q.lineItems||[]).map(li=>li.sku||"").filter(Boolean).join(', ');
    const total = (q.lineItems||[]).reduce((s,li)=>(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0)+s,0);
    return [
      escape(q.name),
      escape(q.company),
      escape(q.currency||'CAD'),
      escape(q.prepaid?'Yes':'No'),
      escape(q.quoteNum),
      escape(skus),
      escape(total.toFixed(2)),
      escape(q.savedBy),
      escape(q.savedDate),
      escape(q.notes),
    ].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BMP_Quotes_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Quotes Tab ────────────────────────────────────────────────────────────────
function QuotesTab({quotes,activeQuote,searchQ,setSearchQ,productsCAD,productsUSD,effectiveProductsUSD,createNewQuote,setActiveQuote,saveQuote,editQuote,openEmailModal,generatePDF,deleteConfirm,setDeleteConfirm,deleteQuote,duplicateQuote,quoteSort,setQuoteSort,closeConfirm,setCloseConfirm,exchangeRate,T}) {
  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Left panel */}
      <div style={{width:252,borderRight:"1px solid #181818",display:"flex",flexDirection:"column",background:"#0a0a0a"}}>
        <div style={{padding:"12px 12px 8px",borderBottom:"1px solid #181818"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".12em",color:T.sectionLabel||"#888"}}>Search Quotes</div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setQuoteSort(s=>s==="asc"?"desc":"asc")}
                style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,padding:"2px 8px",fontSize:9,cursor:"pointer",letterSpacing:".04em",borderRadius:2,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>
                {quoteSort==="asc"?"↑ Oldest":"↓ Newest"}
              </button>
              <button title="Export all quotes to CSV" onClick={()=>exportQuotesCSV(quotes)}
                style={{background:"transparent",border:`1px solid ${T.border}`,color:T.muted,padding:"2px 7px",fontSize:11,cursor:"pointer",borderRadius:2,lineHeight:1}}
                onMouseOver={e=>e.currentTarget.style.color=T.accent}
                onMouseOut={e=>e.currentTarget.style.color=T.muted}>
                ⬇
              </button>
            </div>
          </div>
          {[{k:"name",p:"Name"},{k:"company",p:"Company"},{k:"date",p:"Date"},{k:"madeBy",p:"Made By"},{k:"quoteNum",p:"Quote #"}].map(f=>(
            <input key={f.k} value={searchQ[f.k]} onChange={e=>setSearchQ(p=>({...p,[f.k]:e.target.value}))}
              placeholder={f.p} style={{width:"100%",marginBottom:4,fontSize:11,height:26}}/>
          ))}
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".12em",color:"#444",margin:"8px 0 6px"}}>Search by Product</div>
          {[{k:"sku",p:"SKU"},{k:"description",p:"Description"}].map(f=>(
            <input key={f.k} value={searchQ[f.k]} onChange={e=>setSearchQ(p=>({...p,[f.k]:e.target.value}))}
              placeholder={f.p} style={{width:"100%",marginBottom:4,fontSize:11,height:26}}/>
          ))}
          {(searchQ.sku||searchQ.description||searchQ.name||searchQ.company||searchQ.date||searchQ.madeBy||searchQ.quoteNum)&&(
            <button onClick={()=>setSearchQ({name:"",company:"",date:"",madeBy:"",quoteNum:"",sku:"",description:""})}
              style={{width:"100%",marginTop:4,fontSize:10,padding:"4px",background:"transparent",border:`1px solid ${T.borderMid}`,color:T.muted,cursor:"pointer",letterSpacing:".04em"}}>
              Clear filters ✕
            </button>
          )}
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          <QuoteGroupedList quotes={quotes} activeQuote={activeQuote} setActiveQuote={setActiveQuote}
            setDeleteConfirm={setDeleteConfirm} duplicateQuote={duplicateQuote} searchQ={searchQ}
            quoteSort={quoteSort} T={T}/>
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
          : <QuoteForm quote={activeQuote} setQuote={setActiveQuote} productsCAD={productsCAD} productsUSD={effectiveProductsUSD}
              onSave={saveQuote} onEdit={editQuote} onEmail={openEmailModal} onPDF={generatePDF}
              onClose={()=>{ if(activeQuote&&!activeQuote.saved){setCloseConfirm(activeQuote);}else{setActiveQuote(null);} }} onNewQuote={()=>{setActiveQuote(null);setTimeout(createNewQuote,50);}}
              exchangeRate={exchangeRate} T={T}/>
        }
      </div>
    </div>
  );
}

// ─── Quote Form ────────────────────────────────────────────────────────────────
function QuoteForm({quote,setQuote,productsCAD,productsUSD,onSave,onEdit,onEmail,onPDF,onClose,onNewQuote,isMobile,exchangeRate=0.73,T}) {
  // Compute load warnings live from line items
  const loadWarnings = useMemo(() => {
    try {
      const result = validateQuoteLoad(quote.lineItems);
      return Array.isArray(result) ? result : [];
    }
    catch(e) { return []; }
  }, [quote.lineItems]);
  const products = quote.currency==="CAD"?productsCAD:productsUSD; // productsUSD prop is already auto-converted
  const [qtyWarnings,setQtyWarnings] = useState({});

  function upd(field,val){
    setQuote(q=>{
      const updated = {...q, [field]:val};
      // When currency switches, recalc all line item prices
      if (field==='currency') {
        const rate = parseFloat(exchangeRate||0.73) || 0.73;
        updated.lineItems = (q.lineItems||[]).map(li => {
          // Always get the base CAD price first
          const cadProd = (productsCAD||[]).find(p=>p.sku===li.sku);
          if (!cadProd) return li;
          const cadTier = getPriceTier(cadProd, li.qty, updated.prepaid);
          if (!cadTier.price) return li;

          let newBase;
          if (val==='USD') {
            // Check if USD product list has a specific price for this SKU
            const usdProd = (productsUSD||[]).find(p=>p.sku===li.sku);
            const usdTier = usdProd ? getPriceTier(usdProd, li.qty, updated.prepaid) : null;
            // Use explicit USD price if set, otherwise convert from CAD
            newBase = (usdTier && usdTier.price > 0)
              ? usdTier.price
              : Math.round(cadTier.price * rate * 100) / 100;
          } else {
            // Switching back to CAD — use CAD price directly
            newBase = cadTier.price;
          }

          const newUnit = Math.round(newBase * (1+(li.increase||0)/100) * 100) / 100;
          return {...li, basePrice:newBase, unitPrice:newUnit, priceTier:cadTier.tier};
        });
      }
      return updated;
    });
  }
  function updLI(id,field,val){
    setQuote(q=>({...q,lineItems:(q.lineItems||[]).map(li=>{
      if(li.id!==id)return li;
      const u={...li,[field]:val};
      if(field==="sku"||field==="description"){
        const prod=field==="sku"?(products||[]).find(p=>p.sku===val):(products||[]).find(p=>p.description===val);
        if(prod){
          if(field==="sku")u.description=prod.description;else u.sku=prod.sku;
          const tier=getPriceTier(prod,u.qty,q.prepaid);
          u.basePrice=tier.price; u.priceTier=tier.tier;
          u.unitPrice=Math.round(tier.price*(1+(u.increase||0)/100)*100)/100;
        }
      }
      if(field==="increase"){const p=parseFloat(val)||0;u.unitPrice=Math.round(u.basePrice*(1+p/100)*100)/100;}
      if(field==="qty"){
        const prod=(products||[]).find(p=>p.sku===u.sku);
        if(prod){
          // Recalc price tier when qty changes
          const tier=getPriceTier(prod,val,q.prepaid);
          if(tier.price>0){
            u.basePrice=tier.price; u.priceTier=tier.tier;
            u.unitPrice=Math.round(tier.price*(1+(u.increase||0)/100)*100)/100;
          }
          if(prod.pkg&&prod.pkg!==""){
            const pkg=parseInt(prod.pkg);
            if(!isNaN(pkg)&&parseInt(val)%pkg!==0){
              setQtyWarnings(w=>({...w,[id]:`Not a multiple of package qty (${pkg})`}));
            } else {
              setQtyWarnings(w=>{const n={...w};delete n[id];return n;});
            }
          } // end pkg check
        } // end prod check
      }
      return u;
    })}));
  }
  function addLI(){setQuote(q=>({...q,lineItems:[...(q.lineItems||[]),{id:Date.now(),sku:"",description:"",qty:1,unitPrice:0,increase:0,basePrice:0}]}));}
  function removeLI(id){setQuote(q=>({...q,lineItems:(q.lineItems||[]).filter(li=>li.id!==id)}));setQtyWarnings(w=>{const n={...w};delete n[id];return n;});}

  const total=((quote.lineItems||[])).reduce((s,li)=>s+(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0),0);
  const ro=quote.saved;
  // Guard: if quote is somehow invalid, show nothing
  if (!quote || typeof quote !== 'object') return null;

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
      {isMobile ? (
        /* ── Mobile: vertical cards for each line item ── */
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:9,color:T.tableHeadText,letterSpacing:".1em",textTransform:"uppercase"}}>Line Items ({(quote.lineItems||[]).length})</div>
            {!ro&&<button className="btn" style={{fontSize:11,padding:"4px 12px"}} onClick={addLI}>+ Add Item</button>}
          </div>
          {((quote.lineItems||[])).map((li,idx)=>{
            const lineTotal=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
            return (
              <div key={li.id} style={{background:T.cardBg,border:`1px solid ${T.border}`,borderRadius:4,padding:12,marginBottom:8}}>
                {/* Row 1: Description - full width */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:9,color:T.tableHeadText,letterSpacing:".08em",marginBottom:4}}>DESCRIPTION</div>
                  {ro
                    ? <div style={{fontSize:13,color:T.text,lineHeight:1.4}}>{li.description||"—"}</div>
                    : <><input list={`dl-m-${li.id}`} value={li.description}
                        onChange={e=>updLI(li.id,"description",e.target.value)}
                        placeholder="Product description…"
                        style={{width:"100%",fontSize:15,height:44,padding:"0 10px",borderRadius:3}}/> 
                      <datalist id={`dl-m-${li.id}`}>{(products||[]).map(p=><option key={p.sku} value={p.description}/>)}</datalist>
                    </>
                  }
                </div>
                {/* Row 2: SKU */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:9,color:T.tableHeadText,letterSpacing:".08em",marginBottom:4}}>SKU</div>
                  {ro
                    ? <div style={{fontSize:12,color:T.accent,fontFamily:"monospace"}}>{li.sku||"—"}</div>
                    : <><input list={`sl-m-${li.id}`} value={li.sku}
                        onChange={e=>updLI(li.id,"sku",e.target.value)}
                        placeholder="SKU…"
                        style={{width:"100%",fontSize:14,height:40,padding:"0 10px",borderRadius:3,fontFamily:"monospace"}}/>
                      <datalist id={`sl-m-${li.id}`}>{(products||[]).map(p=><option key={p.sku} value={p.sku}/>)}</datalist>
                    </>
                  }
                </div>
                {/* Row 3: Qty | Unit Price | Total */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <div>
                    <div style={{fontSize:9,color:T.tableHeadText,letterSpacing:".08em",marginBottom:4}}>QTY</div>
                    {ro ? <div style={{fontSize:14,fontWeight:600}}>{li.qty}</div>
                      : <input type="number" min="1" value={li.qty}
                          onChange={e=>updLI(li.id,"qty",parseInt(e.target.value)||1)}
                          style={{width:"100%",fontSize:16,height:44,textAlign:"center"}}/>}
                  </div>
                  <div>
                    <div style={{fontSize:9,color:T.tableHeadText,letterSpacing:".08em",marginBottom:4}}>UNIT PRICE</div>
                    {ro ? <div style={{fontSize:14,fontWeight:600}}>{fmtCur(li.unitPrice)}</div>
                      : <input type="number" step="0.01" value={li.unitPrice===0?"":li.unitPrice}
                          onChange={e=>updLI(li.id,"unitPrice",e.target.value)}
                          style={{width:"100%",fontSize:16,height:44,textAlign:"center"}}/>}
                    {li.priceTier&&li.priceTier!=="unit"&&<div style={{fontSize:9,color:T.accent,marginTop:2}}>{li.priceTier}</div>}
                  </div>
                  <div>
                    <div style={{fontSize:9,color:T.tableHeadText,letterSpacing:".08em",marginBottom:4}}>TOTAL</div>
                    <div style={{fontSize:14,fontWeight:600,color:T.accent,paddingTop:ro?0:12}}>{fmtCur(lineTotal)}</div>
                  </div>
                </div>
                {/* Row 4: Increase % | Remove */}
                {!ro&&<div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:T.tableHeadText,letterSpacing:".08em",marginBottom:4}}>MARKUP %</div>
                    <select value={li.increase||0} onChange={e=>updLI(li.id,"increase",parseInt(e.target.value))}
                      style={{width:"100%",height:40,fontSize:14,color:li.increase>0?"#c8a96e":"var(--subtext)",background:"var(--input-bg)"}}>
                      {PRICE_INCREASE_OPTIONS.map(o=><option key={o} value={o}>{o===0?"No markup":`+${o}%`}</option>)}
                    </select>
                  </div>
                  <button onClick={()=>removeLI(li.id)}
                    style={{background:"transparent",border:"1px solid #553",color:"#c84",width:40,height:40,borderRadius:3,cursor:"pointer",fontSize:18,flexShrink:0,marginTop:18}}>
                    ✕
                  </button>
                </div>}
              </div>
            );
          })}
          {!ro&&<button className="btn" style={{width:"100%",padding:"10px",fontSize:13}} onClick={addLI}>+ Add Line Item</button>}
        </div>
      ) : (
      /* ── Desktop: horizontal table ── */
      <div style={{border:"1px solid #1e1e1e",marginBottom:8,overflowX:"auto"}}><table className="data-table">
          <thead><tr>
            <th style={{width:140}}>SKU</th>
            <th>Description</th>
            <th style={{width:72}}>Qty</th>
            <th style={{width:105}}>Unit Price</th>
            <th style={{width:105}}>Total</th>
            <th style={{width:110}}>Increase (%)</th>
            {!ro&&<th style={{width:36}}/>}
          </tr></thead>
          <tbody>{((quote.lineItems||[])).map((li,idx)=>{
            const lineTotal=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
            return <tr key={li.id}>
              <td>
                {ro?<span style={{fontSize:11}}>{li.sku||"—"}</span>
                  :<><input list={`sl-${idx}`} value={li.sku} onChange={e=>updLI(li.id,"sku",e.target.value)}
                      style={{width:"100%",fontSize:11,height:25}} placeholder="SKU"/>
                    <datalist id={`sl-${idx}`}>{(products||[]).map(p=><option key={p.sku} value={p.sku}/>)}</datalist>
                    <datalist id={`sl-${idx}`}>{(products||[]).map(p=><option key={p.sku} value={p.sku}/>)}</datalist></>}
              </td>
              <td>
                {ro?<span style={{fontSize:11}}>{li.description}</span>
                  :<><input list={`dl-${idx}`} value={li.description} onChange={e=>updLI(li.id,"description",e.target.value)}
                      style={{width:"100%",fontSize:11,height:25}} placeholder="Product description"/>
                    <datalist id={`dl-${idx}`}>{(products||[]).map(p=><option key={p.sku} value={p.description}/>)}</datalist>
                    <datalist id={`dl-${idx}`}>{(products||[]).map(p=><option key={p.sku} value={p.description}/>)}</datalist></>}
              </td>
              <td style={{position:"relative"}}>
                {ro?<span>{li.qty}</span>
                  :<div style={{position:"relative"}}>
                    <input type="number" min="1" value={li.qty}
                      onChange={e=>updLI(li.id,"qty",parseInt(e.target.value)||1)}
                      style={{width:"100%",fontSize:12,height:28,borderColor:qtyWarnings[li.id]?"#5a3a00":"#2e2e2e",minWidth:72}}/>
                    {qtyWarnings[li.id]&&<div className="warn-toast" onClick={()=>setQtyWarnings(w=>{const n={...w};delete n[li.id];return n;})}>⚠ {qtyWarnings[li.id]} &nbsp;✕</div>}
                  </div>}
              </td>
              <td>
                {ro
                  ? <div>
                      <div>{fmtCur(li.unitPrice)}</div>
                      {li.priceTier&&li.priceTier!=="unit"&&<div style={{fontSize:8,color:"#c8a96e",textTransform:"uppercase",letterSpacing:".06em",marginTop:1}}>{li.priceTier}</div>}
                    </div>
                  : <div>
                      <input type="number" step="0.01" value={li.unitPrice===0?"":li.unitPrice}
                        onChange={e=>updLI(li.id,"unitPrice",e.target.value)}
                        onBlur={e=>{if(e.target.value==="")updLI(li.id,"unitPrice",0);}}
                        style={{width:"100%",fontSize:11,height:25}}/>
                      {li.priceTier&&li.priceTier!=="unit"&&<div style={{fontSize:8,color:"#c8a96e",textTransform:"uppercase",letterSpacing:".06em",marginTop:1}}>{li.priceTier} price</div>}
                    </div>
                }
              </td>
              <td style={{fontWeight:500,fontFamily:"monospace"}}>{fmtCur(lineTotal)}</td>
              <td>
                {ro?<span>{li.increase||0}%</span>
                  :<select value={li.increase||0} onChange={e=>updLI(li.id,"increase",parseInt(e.target.value))}
                      style={{width:"100%",fontSize:11,height:25,color:li.increase>0?"#c8a96e":"var(--subtext)",background:"var(--input-bg)"}}>
                      {PRICE_INCREASE_OPTIONS.map(o=><option key={o} value={o}>{o}%</option>)}
                    </select>}
              </td>
              {!ro&&<td>{((quote.lineItems||[])).length>1&&<button className="btn-del" style={{padding:"1px 7px"}} onClick={()=>removeLI(li.id)}>✕</button>}</td>}
            </tr>;
          })}</tbody>
        </table>
        {!ro&&<div style={{padding:"7px 10px",borderTop:"1px solid #161616",background:"#0a0a0a"}}>
          <button className="btn" style={{fontSize:10,padding:"4px 12px"}} onClick={addLI}>+ Add Line Item</button>
        </div>}
      </div>
      )} {/* end ternary */}

      {/* Load Validation Warnings */}
      {Array.isArray(loadWarnings) && loadWarnings.length > 0 && (
        <div style={{border:`1px solid ${T.border}`,marginBottom:8,overflow:"hidden"}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".12em",color:T.muted,padding:"5px 10px",background:T.tableHead,borderBottom:`1px solid ${T.border}`}}>
            Load & Packing Check
          </div>
          {(loadWarnings||[]).map((w,i)=>{
            const colors = {ok:"#34c77b", warn:"#f5a623", over:"#e8472c", info:"#4a90d9"};
            const col = colors[w.type]||colors.info;
            return (
              <div key={i} style={{display:"flex",gap:10,padding:"7px 10px",borderBottom:i<loadWarnings.length-1?`1px solid ${T.border}`:"none",background:T.cardBg}}>
                <div style={{flexShrink:0,width:6,background:col,borderRadius:1,alignSelf:"stretch"}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:600,color:col,marginBottom:1}}>{w.product}</div>
                  <div style={{fontSize:11,color:T.subtext,lineHeight:1.5}}>{w.msg}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes + Total */}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,border:"1px solid #1e1e1e",padding:12}}>
        <div>
          <div style={{fontSize:9,color:"#444",letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Quote Notes <span style={{color:"var(--muted)",fontWeight:300,textTransform:"none"}}>(printed on quote)</span></div>
          <textarea disabled={ro} value={quote.notes} onChange={e=>upd("notes",e.target.value)}
            style={{width:"100%",height:48,resize:"vertical",fontSize:11,background:"var(--input-bg)",border:"1px solid var(--border)",color:"var(--text)"}} placeholder="Notes for the customer…"/>
          <div style={{fontSize:9,color:"var(--accent)",letterSpacing:".1em",textTransform:"uppercase",marginTop:8,marginBottom:4}}>Internal Notes <span style={{color:"var(--muted)",fontWeight:300,textTransform:"none"}}>(not on quote)</span></div>
          <textarea disabled={ro} value={quote.internalNotes||""} onChange={e=>upd("internalNotes",e.target.value)}
            style={{width:"100%",height:48,resize:"vertical",fontSize:11,background:"var(--input-bg)",border:`1px solid ${quote.internalNotes?"var(--accent)":"var(--border)"}`,color:"var(--text)"}} placeholder={`Internal notes by ${quote.savedBy||"you"}…`}/>
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

  const types = useMemo(()=>["All",...new Set((dims||[]).map(d=>d.type))],[dims]);
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
      )}
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
function ProductsTab({products,setProducts,currency,setCurrency,search,setSearch,categories,setCategories,exchangeRate,setExchangeRate,T}) {
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
    try {
      const assigned = new Set(Object.values(categories||{}).filter(Boolean));
      const ordered = CATEGORY_ORDER.filter(cat => assigned.has(cat));
      const extras = Array.from(assigned).filter(cat => !CATEGORY_ORDER.includes(cat)).sort();
      return [...ordered, ...extras, "Uncategorized"];
    } catch(e) { return ["Uncategorized"]; }
  }, [categories]);

  // Sort helper
  function sortProducts(arr) {
    return [...arr].sort((a,b)=>String(a[sortF]??"").localeCompare(String(b[sortF]??""),undefined,{numeric:true})*sortD);
  }

  // Group products by category
  const grouped = useMemo(()=>{
    try {
      const map = {};
      (allCategories||[]).forEach(cat => { map[cat] = []; });
      (products||[]).forEach(p => {
        const cat = (categories||{})[p.sku] || "Uncategorized";
        if (!map[cat]) map[cat] = [];
        map[cat].push(p);
      });
      Object.keys(map).forEach(k => { map[k] = sortProducts(map[k]); });
      return map;
    } catch(e) { return {"Uncategorized": products||[]}; }
  }, [products, categories, sortF, sortD, allCategories]);

  const flatSorted = useMemo(()=>{ try { return sortProducts(products||[]); } catch(e) { return products||[]; } }, [products, sortF, sortD]);

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
    else setSelected(new Set((products||[]).map(p=>p.sku)));
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
          <td style={{fontSize:11,fontFamily:"monospace",textAlign:"right",color:T.tableHeadText}}>{p.truckQty||"—"}</td>
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
      <Th l="Truck Qty" f="truckQty" style={{textAlign:"right"}}/>
              <Th l="Truck Price" f="truckPrice" style={{textAlign:"right"}}/>
      <th>Actions</th>
    </tr>
  );

  const filteredFlat = useMemo(()=>{
    try {
      if (!search) return flatSorted||[];
      const q=search.toLowerCase();
      return (flatSorted||[]).filter(p=>
        (p.sku||"").toLowerCase().includes(q)||
        (p.product||"").toLowerCase().includes(q)||
        (p.description||"").toLowerCase().includes(q));
    } catch(e) { return flatSorted||[]; }
  },[flatSorted, search]);

  // Safety guard
  if (!T || !products) return null;

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
        {currency==="USD"&&(
          <div style={{display:"flex",alignItems:"center",gap:6,background:T.tableHead,border:`1px solid ${T.border}`,padding:"3px 10px",borderRadius:2}}>
            <span style={{fontSize:9,color:T.muted}}>Auto-convert rate: $1 CAD =</span>
            <input type="number" step="0.001" min="0.1" max="2"
              value={exchangeRate}
              onChange={e=>setExchangeRate(parseFloat(e.target.value)||0.73)}
              style={{width:64,fontSize:11,height:22,textAlign:"center",padding:"0 4px"}}/>
            <span style={{fontSize:9,color:T.muted}}>USD</span>
            <span style={{fontSize:9,color:T.accent,marginLeft:4}}>Blank USD prices auto-convert from CAD</span>
          </div>
        )}
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
  // For number fields: show empty string instead of 0 so user can type freely
  const f=(k,type="text")=>({
    type,
    value: type==="number" ? (row[k]===0||row[k]===""||row[k]===null||row[k]===undefined ? "" : row[k]) : (row[k]??""),
    onChange: e=>setRow(r=>({...r,[k]:e.target.value})),
    onFocus: e=>{ if(type==="number" && (e.target.value==="0"||e.target.value==="0.00")) e.target.select(); },
    style:{width:"100%",fontSize:11,height:26,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}
  });
  return (
    <tr style={{background:"#14140e",verticalAlign:"top"}}>
      <td style={{paddingTop:6}}><span style={{fontSize:11,color:"#c8a96e"}}>{row.sku}</span></td>
      <td><input {...f("product")}/></td>
      <td><textarea value={row.description??""} onChange={e=>setRow(r=>({...r,description:e.target.value}))}
        style={{width:"100%",fontSize:11,height:52,resize:"vertical",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:"var(--input-bg)",border:"1px solid var(--border-light)",color:"var(--text)",padding:"4px 6px",lineHeight:1.4}}/></td>
      <td><input {...f("pkg")}/></td>
      <td><input {...f("pallet")}/></td>
      <td><input {...f("price","number")} step="0.01"/></td>
      <td><input {...f("palletPrice","number")} step="0.01"/></td>
      <td><input {...f("prepaid","number")} step="0.01"/></td>
      <td><input {...f("prepaidPallet","number")} step="0.01"/></td>
      <td><input {...f("truckQty")}/></td>
      <td><input {...f("truckPrice","number")} step="0.01"/></td>
      <td style={{display:"flex",gap:4,paddingTop:6}}>
        <button className="btn-gold" style={{padding:"3px 8px",fontSize:10}} onClick={onSave}>✓</button>
        <button className="btn" style={{fontSize:10}} onClick={onCancel}>✕</button>
      </td>
    </tr>
  );
}

// ─── PDF Field Component (outside PDFModal to prevent focus loss on re-render) ──
function PDFField({label, value, onChange, placeholder="", type="text"}) {
  return (
    <div style={{marginBottom:8}}>
      <div style={{fontSize:9,color:"#666",letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
      <input type={type} value={value}
        onChange={e=>onChange(e.target.value)}
        onFocus={e=>{ if(type==="number" && (e.target.value==="0"||e.target.value==="0.00")) e.target.select(); }}
        placeholder={placeholder}
        style={{width:"100%",fontSize:13,height:36,background:"#1e1e1e",border:"1px solid #333",color:"#e8e8e8",padding:"0 10px",borderRadius:2,fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}/>
    </div>
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

  const subtotal   = (q.lineItems||[]).reduce((a,li)=>a+(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0),0);
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
    const items = (q.lineItems||[]).slice(0,9);
    const rows = items.map((li,i)=>{
      const lt=(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0);
      const bg = i%2===0?"#ffffff":"#f7f7f7";
      return `<tr style="background:${bg};">
        <td style="padding:6px 8px;border-bottom:1px solid #e8e8e4;font-size:10px;color:#222;line-height:1.3;">${li.description||"—"}</td>
        <td style="padding:6px 6px;border-bottom:1px solid #e8e8e4;font-size:9px;font-family:'Courier New',monospace;color:#555;white-space:nowrap;">${li.sku||""}</td>
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
<title>Quote ${q.quoteNum} - ${q.company||q.name||'BMP Supplies'} - ${todayStr}</title>
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
      <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCARGD6ADASIAAhEBAxEB/8QAHQABAAMBAQEBAQEAAAAAAAAAAAcICQYFBAEDAv/EAGYQAQAABAMBBwwJDgwEBQMDBQABAgMEBQYHEQgSFxghVpQJMTdBUVdhdZWz0dITIjhxdIGTstMUFRYyNkJSVXKRoaSxtCMzR2JzdoKFkqLCxCQ0Q8FEU1RjpSVFg6PD8SZlhOHw/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALlgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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escJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHCRp3z8yt5XoesyRAa3cJGnfPzK3leh6xwkad8/MreV6HrMkQGt3CRp3z8yt5XoescJGnfPzK3leh6zJEBrdwkad8/MreV6HrHC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iSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDulnMLAOiSnA7pZzCwDokoMoRq9wO6WcwsA6JKcDulnMLAOiSgyhGr3A7pZzCwDokpwO6WcwsA6JKDKEavcDu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viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgHSTh10e74mAdJBI4jjh10e74mAdJOHXR7viYB0kEjiOOHXR7viYB0k4ddHu+JgHSQSOI44ddHu+JgH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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//Z" style="height:48px;width:auto;mix-blend-mode:multiply;" alt="BMP Supplies"/>
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
        <th style="padding:8px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#fff;font-weight:600;width:42%;">Description</th>
        <th style="padding:8px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#fff;font-weight:600;width:14%;">SKU</th>
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
    const company = (q.company || q.name || "BMP Supplies").trim();
    const date = q.savedDate || todayStr;
    const filename = `Quote ${q.quoteNum} - ${company} - ${date}`;
    // Get the HTML from the iframe and open a new named window
    // Chrome uses the window name / title for the PDF filename
    if(iframeRef.current){
      const idoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      const html = idoc.documentElement.outerHTML;
      // Inject the correct title into the HTML string before opening
      const titledHTML = html.replace(/<title>[^<]*<\/title>/, `<title>${filename}</title>`);
      const printWin = window.open('', filename, 'width=900,height=700');
      if(printWin){
        printWin.document.open();
        printWin.document.write(titledHTML);
        printWin.document.close();
        printWin.document.title = filename;
        setTimeout(()=>{ printWin.focus(); printWin.print(); printWin.close(); }, 500);
      }
    }
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
  // F component defined outside PDFModal for stable reference

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
            <PDFField label="Contact Name" value={contact} onChange={setContact} placeholder={q.name||"Contact person"}/>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:"#666",letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>Valid For</div>
              <select value={validDays} onChange={e=>setValidDays(parseInt(e.target.value))}
                style={{width:"100%",fontSize:13,height:36,background:"#1e1e1e",border:"1px solid #333",color:"#e8e8e8",borderRadius:2,padding:"0 10px"}}>
                {[14,21,30,45,60,90].map(d=><option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <PDFField label="Freight / Shipping ($)" value={freight} onChange={setFreight} placeholder="0.00" type="number"/>
            <PDFField label="Discount ($)" value={discount} onChange={setDiscount} placeholder="0.00" type="number"/>
            <PDFField label="Payment Terms" value={payTerms} onChange={setPayTerms} placeholder="Net 30 days..."/>
          </div>

          {/* Right col: summary */}
          <div style={{background:"#0d0d0d",border:"1px solid #1e1e1e",padding:"14px 16px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:".14em",color:"#888",marginBottom:6,fontWeight:600}}>BMP Notes (appears on quote)</div>
            <textarea value={bmpNotes} onChange={e=>setBmpNotes(e.target.value)} placeholder="Internal notes or special instructions..."
              style={{width:"100%",height:80,background:"#1e1e1e",border:"1px solid #333",color:"#e8e8e8",fontSize:13,padding:"8px 10px",resize:"vertical",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",borderRadius:2,lineHeight:1.5}}/>
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
            {(q.lineItems||[]).length} line item{(q.lineItems||[]).length!==1?"s":""}{(q.lineItems||[]).length>9?" (first 9 will print)":""}
          </div>
          <div style={{overflowX:"auto",maxHeight:160,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              {(q.lineItems||[]).slice(0,9).map((li,i)=>{
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

// ─── Shared Load Validation Rules ─────────────────────────────────────────────
const MIXED_VAN_TABLE = [
  [24,0,24],[22,2,24],[20,4,24],[18,6,24],[16,8,24],[14,10,24],[12,12,24],
  [10,16,26],[8,18,26],[6,20,26],[4,22,26],[2,24,26],[0,26,26]
];
const MIXED_FLAT_TABLE = (()=>{ const r=[]; for(let b=26;b>=0;b-=2) r.push([b,26-b,26]); return r; })();

// SKU classifiers
function isECB8(sku)  { return /BMP-.*08/.test(sku||''); }
function isECB16(sku) { return /BMP-.*16/.test(sku||''); }
function isECB(sku)   { return isECB8(sku)||isECB16(sku); }
function isWattle(sku){ return /^(STW|BSTW|AESTW)/i.test(sku||''); }
function isW9(sku)    { return isWattle(sku) && /09|0925|9x|9"/i.test(sku||''); }
function isW12(sku)   { return isWattle(sku) && /12|1220|12x/i.test(sku||''); }

// Main quote load validator — returns array of warning objects
function validateQuoteLoad(lineItems) {
  const warnings = [];
  if (!lineItems || lineItems.length === 0) return warnings;

  // Gather totals
  const qty = (sku_test) => lineItems
    .filter(li => sku_test(li.sku))
    .reduce((sum, li) => sum + (parseInt(li.qty)||0), 0);

  const totalB8  = qty(isECB8);
  const totalB16 = qty(isECB16);
  const totalW9  = qty(isW9);
  const totalW12 = qty(isW12);
  const hasECB   = totalB8 > 0 || totalB16 > 0;
  const hasWat   = totalW9 > 0 || totalW12 > 0;

  if (!hasECB && !hasWat) return warnings;

  // ── ECB Blanket checks ─────────────────────────────────────────────────
  if (hasECB) {
    // 16ft rolls: only flatbed, truck = 600 rolls (20/pal × 30 pals → but actually truck load for 16ft is 20 pals × 2 per row = different)
    // Per load calc: b16 palsPerRow=4, truck load is 26 pal equiv = but 16ft each = 2 pal equiv
    // Simplest rule: 16ft truck qty = 20 pallets × 20 rolls = 400 rolls per truck (but mixed with 8ft possible)
    // 8ft: truck = 600 rolls (24 pallets × 25 rolls)
    // Mixed: use MIXED_FLAT_TABLE by pallet count
    const palB8  = Math.ceil(totalB8  / 25);
    const palB16 = Math.ceil(totalB16 / 20);
    const palEqB8  = palB8;
    const palEqB16 = palB16 * 2;
    const totalPalEq = palEqB8 + palEqB16;

    // Pallet multiple check
    if (totalB8 > 0 && totalB8 % 25 !== 0) {
      const nextPal = Math.ceil(totalB8/25)*25;
      const prevPal = Math.floor(totalB8/25)*25;
      warnings.push({
        type:'warn', product:'ECB 8ft Blankets',
        msg:`Qty ${totalB8} is not a full pallet (25 rolls/pallet). Next pallet: ${nextPal} rolls, previous: ${prevPal} rolls.`
      });
    }
    if (totalB16 > 0 && totalB16 % 20 !== 0) {
      const nextPal = Math.ceil(totalB16/20)*20;
      warnings.push({
        type:'warn', product:'ECB 16ft Blankets',
        msg:`Qty ${totalB16} is not a full pallet (20 rolls/pallet). Next pallet: ${nextPal} rolls.`
      });
    }

    // Truck load check
    if (totalPalEq > 0 && totalPalEq < 26) {
      const remPals = 26 - totalPalEq;
      const fillB8  = remPals * 25;
      const fillB16 = Math.floor(remPals/2) * 20;
      warnings.push({
        type:'info', product:'ECB Load',
        msg:`${totalPalEq}/26 pallet equivalents — ${remPals} spots remaining. Could add ${fillB8} more 8ft rolls or ${fillB16} more 16ft rolls to fill a truck.`
      });
    } else if (totalPalEq === 26) {
      warnings.push({ type:'ok', product:'ECB Load', msg:'Full truck load — 26/26 pallet equivalents. ✓' });
    } else if (totalPalEq > 26) {
      warnings.push({
        type:'over', product:'ECB Load',
        msg:`Over by ${totalPalEq - 26} pallet equivalents (${totalPalEq}/26). Needs ${Math.ceil(totalPalEq/26)} trucks.`
      });
    }
  }

  // ── Wattle checks ──────────────────────────────────────────────────────
  if (hasWat) {
    const palW9  = Math.ceil(totalW9  / 14);
    const palW12 = Math.ceil(totalW12 / 12);
    const totalWatPals = palW9 + palW12;

    if (totalW9 > 0 && totalW9 % 14 !== 0) {
      warnings.push({
        type:'warn', product:'Wattles 9"',
        msg:`Qty ${totalW9} is not a full pallet (14/pallet). Next pallet: ${Math.ceil(totalW9/14)*14}.`
      });
    }
    if (totalW12 > 0 && totalW12 % 12 !== 0) {
      warnings.push({
        type:'warn', product:'Wattles 12"',
        msg:`Qty ${totalW12} is not a full pallet (12/pallet). Next pallet: ${Math.ceil(totalW12/12)*12}.`
      });
    }

    // Mixed load table check — only if also has blankets
    const hasECBAlso = totalB8 > 0;
    const palB8 = Math.ceil(totalB8/25);
    if (hasECBAlso) {
      const match = MIXED_VAN_TABLE.find(r => r[0]===palB8 && r[1]===totalWatPals);
      if (match) {
        warnings.push({ type:'ok', product:'Mixed Load', msg:`Valid mixed load: ${palB8} blanket pals + ${totalWatPals} wattle pals = ${match[2]} total pallets. ✓` });
      } else {
        // Find closest valid combos
        const validForBlankets = MIXED_VAN_TABLE.filter(r=>r[0]===palB8);
        const validForWattles  = MIXED_VAN_TABLE.filter(r=>r[1]===totalWatPals);
        let hint = '';
        if (validForBlankets.length) hint += ` For ${palB8} blanket pals, valid wattle pals: ${validForBlankets.map(r=>r[1]).join(' or ')}.`;
        if (validForWattles.length)  hint += ` For ${totalWatPals} wattle pals, valid blanket pals: ${validForWattles.map(r=>r[0]).join(' or ')}.`;
        warnings.push({
          type:'over', product:'Mixed Load',
          msg:`Invalid mix: ${palB8} blanket pals + ${totalWatPals} wattle pals is not on the mixed load chart.${hint}`
        });
      }
    } else {
      // Wattles only — max 26 pallets on flatbed
      if (totalWatPals > 26) {
        warnings.push({ type:'over', product:'Wattles', msg:`${totalWatPals} wattle pallets exceeds truck max of 26.` });
      } else if (totalWatPals === 26) {
        warnings.push({ type:'ok', product:'Wattles', msg:`Full truck: 26/26 wattle pallets. ✓` });
      } else {
        warnings.push({ type:'info', product:'Wattles', msg:`${totalWatPals}/26 wattle pallets — ${26-totalWatPals} spots remaining.` });
      }
    }
  }

  // ── Mixed ECB + Wattle ─────────────────────────────────────────────────
  if (hasECB && hasWat) {
    const palB8  = Math.ceil(totalB8/25);
    const palW   = Math.ceil(totalW9/14) + Math.ceil(totalW12/12);
    // Check flat table (flatbed) — all combos = 26 pals
    const flatMatch = MIXED_FLAT_TABLE.find(r=>r[0]===palB8 && r[1]===palW);
    if (flatMatch) {
      warnings.push({ type:'ok', product:'Flatbed Mixed', msg:`Valid flatbed mix: ${palB8} blanket pals + ${palW} wattle pals = 26. ✓` });
    }
  }

  return warnings;
}

// ─── Load Calculator Tab ───────────────────────────────────────────────────────
function LoadCalcTab({T}) {
  const [truck, setTruck]   = useState('flatbed');
  const [qb8,  setQb8]      = useState('');
  const [pb8,  setPb8]      = useState('');
  const [qb16, setQb16]     = useState('');
  const [pb16, setPb16]     = useState('');
  const [qw9,  setQw9]      = useState('');
  const [pw9,  setPw9]      = useState('');
  const [qw12, setQw12]     = useState('');
  const [pw12, setPw12]     = useState('');
  const deckRef = useRef(null);

  const C = { b8:'#4a90d9', b16:'#7b5ea7', w9:'#f5a623', w12:'#e8472c' };

  const MIXED_VAN  = MIXED_VAN_TABLE;
  const MIXED_FLAT = MIXED_FLAT_TABLE;

  const ROW = {
    b8:  {ft:8,  palsPerRow:4, qtyPerPal:25, wt:55 },
    b16: {ft:16, palsPerRow:4, qtyPerPal:20, wt:110},
    w9:  {ft:4,  palsPerRow:2, qtyPerPal:14, wt:40 },
    w12: {ft:4,  palsPerRow:2, qtyPerPal:12, wt:40 }
  };

  function rowCalc(pals, key) {
    if (!pals) return {rows:0, deckFt:0, openTopSlots:0};
    const r = ROW[key];
    const fullRows = Math.floor(pals/r.palsPerRow);
    const rem = pals % r.palsPerRow;
    const openSlots = rem > 0 ? r.palsPerRow - rem : 0;
    return {rows: fullRows+(rem>0?1:0), deckFt:(fullRows+(rem>0?1:0))*r.ft, openTopSlots:openSlots};
  }

  function hexA(h, a) {
    const r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // Compute all derived values
  const calc = useMemo(() => {
    const vqb8  = Math.max(0, parseInt(qb8)  || 0);
    const vqb16 = Math.max(0, parseInt(qb16) || 0);
    const vqw9  = Math.max(0, parseInt(qw9)  || 0);
    const vqw12 = Math.max(0, parseInt(qw12) || 0);

    const vpb8  = Math.ceil(vqb8  / 25);
    const vpb16 = truck==='dryvan' ? 0 : Math.ceil(vqb16 / 20);
    const vpw9  = Math.ceil(vqw9  / 14);
    const vpw12 = Math.ceil(vqw12 / 12);

    const rb8  = rowCalc(vpb8,  'b8');
    const rb16 = rowCalc(vpb16, 'b16');
    const rw9  = rowCalc(vpw9,  'w9');
    const rw12 = rowCalc(vpw12, 'w12');

    const totalDeckFt = rb8.deckFt + rb16.deckFt + rw9.deckFt + rw12.deckFt;
    const totalPals   = vpb8 + vpb16 + vpw9 + vpw12;

    const palEqB8  = vpb8;
    const palEqB16 = vpb16 * 2;
    const palEqW9  = vpw9;
    const palEqW12 = vpw12;
    const totalPalEq = palEqB8 + palEqB16 + palEqW9 + palEqW12;

    const wb8  = vqb8  * 55;
    const wb16 = vqb16 * 110;
    const ww9  = vqw9  * 40;
    const ww12 = vqw12 * 40;
    const totalWt = wb8 + wb16 + ww9 + ww12;

    const maxPalEq = truck==='flatbed' ? 26 : null;
    const remPalEq = maxPalEq !== null ? maxPalEq - totalPalEq : null;

    const isMixedVan = truck==='dryvan' && vpb8>0 && vpw9+vpw12>0;
    const blanketPals = vpb8;
    const wattlePals  = vpw9 + vpw12;
    let matchRow = null;
    if (isMixedVan) {
      for (let i=0; i<MIXED_VAN.length; i++) {
        if (MIXED_VAN[i][0]===blanketPals && MIXED_VAN[i][1]===wattlePals) { matchRow=MIXED_VAN[i]; break; }
      }
    }

    // Suppress open slots if at/over capacity
    const denom = truck==='flatbed' ? 26 : (vpb8>0 && vpw9+vpw12===0) ? 24 : 26;
    if (totalPalEq >= denom) { rb8.openTopSlots=0; rb16.openTopSlots=0; }

    let displayMax;
    if (truck==='flatbed') displayMax=26;
    else if (isMixedVan) displayMax = matchRow ? matchRow[2] : '?';
    else displayMax = (vpw9+vpw12>0 && vpb8===0) ? 26 : (vpb8>0 && vpw9+vpw12===0) ? 24 : 26;

    // Status
    let statusCls, statusTxt;
    if (truck==='dryvan' && vqb16>0) {
      statusCls='over'; statusTxt='16ft ROLLS NOT PERMITTED IN DRY VAN';
    } else if (truck==='flatbed') {
      if (totalPalEq>26) { statusCls='over'; statusTxt=`OVER BY ${totalPalEq-26} PALLET${totalPalEq-26!==1?'S':''}`; }
      else if (totalPalEq===26) { statusCls='warn'; statusTxt='TRUCK FULLY LOADED — 26 / 26 PALLETS'; }
      else { statusCls='ok'; statusTxt=`${26-totalPalEq} PALLET${26-totalPalEq!==1?'S':''} REMAINING`; }
    } else if (isMixedVan) {
      if (matchRow) { statusCls='ok'; statusTxt=`VALID MIXED LOAD — ${matchRow[2]} TOTAL PALLETS`; }
      else { statusCls='over'; statusTxt='INVALID MIX — CHECK MIXED LOAD TABLE BELOW'; }
    } else {
      const vanMax = vpw9+vpw12>0 && vpb8===0 ? 26 : 24;
      if (totalPals>vanMax) { statusCls='over'; statusTxt=`OVER BY ${totalPals-vanMax} PALLETS`; }
      else if (totalPals===vanMax) { statusCls='warn'; statusTxt=`TRUCK FULLY LOADED — ${vanMax}/${vanMax} PALLETS`; }
      else { statusCls='ok'; statusTxt=`${vanMax-totalPals} PALLETS REMAINING`; }
    }

    // Recommendations
    const recs = [];
    if (truck==='dryvan' && vqb16>0) {
      recs.push({cls:'warn', icon:'!', title:'16ft rolls cannot be loaded in a Dry Van', body:'16ft rolls are flatbed only. Switch to a flatbed or remove the 16ft rolls.'});
    }
    if (truck==='flatbed' && vpb16>0 && vpb8===0 && vpw9+vpw12===0) {
      recs.push({cls:'fill', icon:'~', title:'Tip: add 2 pallets of 8ft rolls at the end', body:'A full 16ft load leaves ~5ft of deck at the rear. You can fit 2 pallets of 8ft blankets crossways — add 50 more 8ft rolls to maximize the load.'});
    }
    if (isMixedVan) {
      if (matchRow) {
        recs.push({cls:'good', icon:'OK', title:`Valid mixed load — ${matchRow[2]} total pallets`, body:`Confirmed on the dry van mixed load chart: ${blanketPals} blanket pallets + ${wattlePals} wattle pallets = ${matchRow[2]} pallets.`});
      } else {
        const vB=MIXED_VAN.filter(r=>r[0]===blanketPals);
        const vW=MIXED_VAN.filter(r=>r[1]===wattlePals);
        let body='This combination is not on the dry van mixed load chart. ';
        if(vB.length) body+=`For ${blanketPals} blanket pallets, valid wattle counts: ${vB.map(r=>r[1]).join(' or ')}. `;
        if(vW.length) body+=`For ${wattlePals} wattle pallets, valid blanket counts: ${vW.map(r=>r[0]).join(' or ')}.`;
        recs.push({cls:'warn', icon:'!', title:'Invalid mixed load combination', body});
      }
    }
    if (remPalEq!==null && remPalEq>0) {
      const lines = [];
      if (rb8.openTopSlots>0) lines.push(`${rb8.openTopSlots} open top pallet${rb8.openTopSlots>1?'s':''} on 8ft stacks — add ${rb8.openTopSlots*25} rolls, no extra deck space needed`);
      if (truck==='flatbed' && rb16.openTopSlots>0) lines.push(`${rb16.openTopSlots} open top pallet${rb16.openTopSlots>1?'s':''} on 16ft stacks — add ${rb16.openTopSlots*20} rolls, no extra deck space`);
      if (remPalEq>=2) {
        const add8 = remPalEq%2===0 ? remPalEq : remPalEq-1;
        lines.push(`${add8} more pallets of 8ft Blankets — ${add8*25} rolls`);
      }
      if (remPalEq>=2) lines.push(`${remPalEq} more pallets of Wattles — 9in: ${remPalEq*14} units or 12in: ${remPalEq*12} units`);
      if (lines.length>0) recs.push({cls:'fill', icon:'+', title:`${remPalEq} pallets remaining — fill options`, body:lines.join('\n')});
    }
    if (recs.length===0 && remPalEq!==null && remPalEq<=0) {
      recs.push({cls:'good', icon:'OK', title:'Truck fully loaded', body:'All pallet positions used.'});
    } else if (recs.length===0) {
      recs.push({cls:'good', icon:'OK', title:'Ready to load', body:'Enter product quantities above.'});
    }

    // Mixed table
    const mixedTable = truck==='flatbed' ? MIXED_FLAT : MIXED_VAN;
    const mixedTitle = truck==='flatbed'
      ? 'MIXED LOAD REFERENCE — FLAT-BED (always 26 pallet equivalents)'
      : 'MIXED LOAD REFERENCE — DRY VAN (24 or 26 pallets)';

    return {
      vqb8,vqb16,vqw9,vqw12, vpb8,vpb16,vpw9,vpw12,
      rb8,rb16,rw9,rw12, totalDeckFt,totalPals,totalPalEq,totalWt,
      palEqB8,palEqB16,palEqW9,palEqW12, remPalEq,maxPalEq,
      isMixedVan,blanketPals,wattlePals,matchRow,
      statusCls,statusTxt,displayMax,recs,
      wb8,wb16,ww9,ww12, denom,
      mixedTable,mixedTitle,
    };
  }, [truck, qb8, qb16, qw9, qw12]);

  // Deck canvas drawing
  useEffect(() => {
    const dc = deckRef.current;
    if (!dc) return;
    dc.innerHTML = '';
    const {vpb8,vpb16,vpw9,vpw12} = calc;
    const W = dc.offsetWidth || 600;
    const totalVisualFt = 52;
    const ppf = W / totalVisualFt;

    // Crossways 8ft
    let crossways8 = 0, normal8 = vpb8;
    if (truck==='flatbed') {
      const fullRows = Math.floor(vpb8/4);
      const rem = vpb8%4;
      if (fullRows>0 && rem>0 && rem<=2) { crossways8=rem; normal8=fullRows*4; }
    }

    // Build rows
    const rows = [];
    let rem16=vpb16, rem8n=normal8;
    for (let i=0; i<3; i++) {
      let left={type:'empty',count:0}, right={type:'empty',count:0};
      if (rem16>=2)      {left={type:'b16',count:2};rem16-=2;}
      else if (rem16===1){left={type:'b16',count:1};rem16-=1;}
      else if (rem8n>=2) {left={type:'b8',count:2};rem8n-=2;}
      else if (rem8n===1){left={type:'b8',count:1};rem8n-=1;}
      if (rem16>=2)      {right={type:'b16',count:2};rem16-=2;}
      else if (rem16===1){right={type:'b16',count:1};rem16-=1;}
      else if (rem8n>=2) {right={type:'b8',count:2};rem8n-=2;}
      else if (rem8n===1){right={type:'b8',count:1};rem8n-=1;}
      if (left.type==='empty'&&right.type==='empty') break;
      rows.push({left,right});
    }

    let lpx=0;
    const colors={b8:C.b8, b16:C.b16, empty:'transparent'};

    rows.forEach(row=>{
      const wpx=16*ppf;
      const rowDiv=document.createElement('div');
      rowDiv.style.cssText=`position:absolute;left:${lpx}px;width:${wpx}px;top:4px;bottom:4px;border-left:2px solid rgba(255,255,255,0.15);border-right:1px solid rgba(0,0,0,0.3);border-radius:2px;overflow:hidden;`;
      dc.appendChild(rowDiv);

      function makeCell(topPct,hPct,cell){
        const color=colors[cell.type];
        if(cell.type==='empty'){
          const ec=document.createElement('div');
          ec.style.cssText=`position:absolute;left:0;right:0;top:${topPct}%;height:${hPct}%;background:#13161f;`;
          rowDiv.appendChild(ec); return;
        }
        const c=document.createElement('div');
        c.style.position='absolute'; c.style.left='1px'; c.style.right='1px';
        c.style.top=topPct+'%'; c.style.height=hPct+'%';
        if(cell.count===2){c.style.background=hexA(color,0.55);c.style.border='1px solid '+hexA(color,0.7);}
        else{c.style.background=`repeating-linear-gradient(45deg,${hexA(color,0.12)},${hexA(color,0.12)} 5px,${hexA(color,0.35)} 5px,${hexA(color,0.35)} 10px)`;c.style.border='1px dashed '+hexA(color,0.5);}
        rowDiv.appendChild(c);
        if(wpx>30){
          const lbl=document.createElement('div');
          lbl.style.cssText=`position:absolute;left:0;right:0;top:${topPct}%;height:${hPct}%;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none;`;
          const span=document.createElement('span');
          span.style.cssText=`background:${hexA(color,0.9)};color:#0d1210;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:9px;font-weight:800;padding:1px 4px;border-radius:2px;`;
          span.textContent=cell.count+' '+(cell.type==='b16'?"16'":"8'")+" pals";
          lbl.appendChild(span); rowDiv.appendChild(lbl);
        }
      }
      makeCell(0,50,row.left); makeCell(50,50,row.right);
      const div2=document.createElement('div');
      div2.style.cssText='position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,0.08);z-index:2;';
      rowDiv.appendChild(div2);
      lpx+=wpx;
    });

    // Wattles
    function drawWat(pals,color){
      let rw=pals;
      while(rw>0){
        const inW=Math.min(rw,2), wpx=4*ppf;
        const ws=document.createElement('div');
        ws.style.cssText=`position:absolute;left:${lpx}px;width:${wpx}px;top:4px;bottom:4px;border-left:2px solid ${color};border-right:1px solid rgba(0,0,0,0.3);border-radius:2px;overflow:hidden;`;
        ws.style.background=inW>=2?hexA(color,0.5):`repeating-linear-gradient(45deg,${hexA(color,0.1)},${hexA(color,0.1)} 5px,${hexA(color,0.3)} 5px,${hexA(color,0.3)} 10px)`;
        if(wpx>20){
          const b=document.createElement('div');
          b.style.cssText='position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:3;';
          const sp=document.createElement('span');
          sp.style.cssText=`background:${hexA(color,0.9)};color:#0d1210;font-size:9px;font-weight:800;padding:1px 4px;border-radius:2px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;`;
          sp.textContent=inW+' pals'; b.appendChild(sp); ws.appendChild(b);
        }
        dc.appendChild(ws); lpx+=wpx; rw-=inW;
      }
    }
    if(vpw9>0)  drawWat(vpw9, C.w9);
    if(vpw12>0) drawWat(vpw12, C.w12);

    // Crossways
    if(crossways8>0){
      const cwpx=4*ppf;
      const cw=document.createElement('div');
      cw.style.cssText=`position:absolute;left:${lpx}px;width:${cwpx}px;top:4px;bottom:4px;border-left:2px solid ${C.b8};border-radius:2px;overflow:hidden;`;
      cw.style.background=crossways8>=2?hexA(C.b8,0.5):`repeating-linear-gradient(45deg,${hexA(C.b8,0.1)},${hexA(C.b8,0.1)} 5px,${hexA(C.b8,0.3)} 5px,${hexA(C.b8,0.3)} 10px)`;
      if(cwpx>20){
        const b=document.createElement('div');
        b.style.cssText='position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:3;';
        const sp=document.createElement('span');
        sp.style.cssText=`background:${hexA(C.b8,0.9)};color:#0d1210;font-size:9px;font-weight:800;padding:1px 4px;border-radius:2px;`;
        sp.textContent=crossways8+" 8' pals"; b.appendChild(sp); cw.appendChild(b);
      }
      dc.appendChild(cw); lpx+=cwpx;
    }

    // Empty space
    const empPx=W-lpx;
    if(empPx>2){
      const e=document.createElement('div');
      e.style.cssText=`position:absolute;left:${lpx}px;width:${empPx}px;top:4px;bottom:4px;background:repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(255,255,255,0.02) 5px,rgba(255,255,255,0.02) 10px);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba(255,255,255,0.15);letter-spacing:1px;`;
      if(empPx>50) e.textContent=(empPx/ppf).toFixed(1)+'ft FREE';
      dc.appendChild(e);
    }
  }, [calc, truck]);

  function fromQty(key, perPal, setQ, setP) {
    return (e) => {
      const qty = Math.max(0, parseInt(e.target.value)||0);
      setQ(e.target.value);
      setP(qty>0 ? String(Math.ceil(qty/perPal)) : '');
    };
  }
  function fromPals(key, perPal, setQ, setP) {
    return (e) => {
      const pals = Math.max(0, parseInt(e.target.value)||0);
      setP(e.target.value);
      setQ(pals>0 ? String(pals*perPal) : '');
    };
  }
  function reset() {
    setQb8(''); setPb8(''); setQb16(''); setPb16('');
    setQw9(''); setPw9(''); setQw12(''); setPw12('');
  }

  const {statusCls,statusTxt,totalPals,totalPalEq,totalWt,remPalEq,
        palEqB8,palEqB16,palEqW9,palEqW12,denom,displayMax,
        rb8,rb16,rw9,rw12, vqb8,vqb16,vqw9,vqw12,vpb8,vpb16,vpw9,vpw12,
        totalDeckFt,wb8,wb16,ww9,ww12,recs,mixedTable,mixedTitle,isMixedVan,blanketPals,wattlePals,matchRow} = calc;

  const statusColors = {ok:'#34c77b', warn:'#f5a623', over:'#e8472c'};
  const sc = statusColors[statusCls];

  // Panel style
  const panel = {background:T.cardBg, border:`1.5px solid ${T.border}`, borderRadius:6, padding:'16px 20px', marginBottom:16};
  const secLabel = {fontSize:10, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:T.muted, marginBottom:10, paddingBottom:7, borderBottom:`1px solid ${T.border}`};

  function ProdBlock({label, dims, dotColor, qVal, pVal, onQ, onP, disabled}) {
    return (
      <div style={{background:T.panelBg, border:`1.5px solid ${T.border}`, borderRadius:5, padding:'12px 14px', marginBottom:10, opacity:disabled?0.35:1, pointerEvents:disabled?'none':'auto'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <div style={{display:'flex', alignItems:'center', gap:7, fontSize:13, fontWeight:700}}>
            <span style={{display:'inline-block', width:10, height:10, borderRadius:'50%', background:dotColor, flexShrink:0}}/>
            {label}
          </div>
          <div style={{fontSize:10, color:T.muted}}>{dims}</div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'end'}}>
          <div>
            <div style={{fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:T.muted, marginBottom:3}}>ROLLS / UNITS</div>
            <input type="number" min="0" value={qVal} onChange={onQ}
              style={{width:'100%', textAlign:'center', fontSize:16, fontWeight:600, padding:'6px 4px', borderRadius:4, background:T.inputBg, border:`1.5px solid ${T.borderMid}`, color:T.text}}/>
          </div>
          <div style={{fontSize:11, color:T.muted, textAlign:'center', paddingBottom:8}}>or</div>
          <div>
            <div style={{fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:T.muted, marginBottom:3}}>PALLETS</div>
            <input type="number" min="0" value={pVal} onChange={onP}
              style={{width:'100%', textAlign:'center', fontSize:16, fontWeight:600, padding:'6px 4px', borderRadius:4, background:T.inputBg, border:`1.5px solid ${T.borderMid}`, color:T.text}}/>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:'flex', height:'100%', overflow:'hidden', background:T.bg, color:T.text, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}}>
      {/* LEFT PANEL */}
      <div style={{width:340, borderRight:`2px solid ${T.border}`, overflowY:'auto', padding:16, flexShrink:0, background:T.panelBg}}>

        {/* Truck type */}
        <div style={{marginBottom:16}}>
          <div style={secLabel}>Truck Type</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {[['flatbed','FLAT-BED','53ft deck · max 26 pallets'],['dryvan','DRY VAN','53ft floor · mixed load table']].map(([id,lbl,sub])=>(
              <button key={id} onClick={()=>setTruck(id)}
                style={{background: truck===id?'rgba(245,166,35,.1)':'#1e2b24', border:`2px solid ${truck===id?'#f5a623':'#2a3d32'}`,
                  color:truck===id?'#f5a623':'#7a9088', padding:'12px 8px', borderRadius:4, cursor:'pointer', textAlign:'center',
                  fontSize:14, fontWeight:700, letterSpacing:1}}>
                {lbl}
                <div style={{fontSize:10, color: truck===id?'rgba(245,166,35,0.5)':'#7a9088', marginTop:3, fontWeight:400}}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        <ProdBlock label="8′ Blankets" dims="48×96×52in · 25 rolls/pal" dotColor={C.b8}
          qVal={qb8} pVal={pb8}
          onQ={fromQty('b8',25,setQb8,setPb8)} onP={fromPals('b8',25,setQb8,setPb8)}/>
        <ProdBlock label="16′ Blankets" dims="49×192×55in · 20 rolls/pal · flatbed only" dotColor={C.b16}
          qVal={qb16} pVal={pb16} disabled={truck==='dryvan'}
          onQ={fromQty('b16',20,setQb16,setPb16)} onP={fromPals('b16',20,setQb16,setPb16)}/>
        <ProdBlock label='Wattles 9"' dims="48×40×108in · 14/pal" dotColor={C.w9}
          qVal={qw9} pVal={pw9}
          onQ={fromQty('w9',14,setQw9,setPw9)} onP={fromPals('w9',14,setQw9,setPw9)}/>
        <ProdBlock label='Wattles 12"' dims="48×40×108in · 12/pal" dotColor={C.w12}
          qVal={qw12} pVal={pw12}
          onQ={fromQty('w12',12,setQw12,setPw12)} onP={fromPals('w12',12,setQw12,setPw12)}/>

        {/* Summary cards */}
        <div style={{marginBottom:12}}>
          <div style={secLabel}>Summary</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10}}>
            {[
              {v:totalPals,         l:'Pallets Loaded'},
              {v:displayMax,        l:'Truck Capacity'},
              {v:remPalEq!==null?(remPalEq>0?remPalEq:remPalEq===0?'FULL':Math.abs(remPalEq)+' over'):'-', l:'Spots Left',
               c:remPalEq===null?'#7a9088':remPalEq<0?'#e8472c':remPalEq===0?'#f5a623':'#34c77b'},
              {v:totalWt.toLocaleString(), l:'Est. lbs'},
            ].map(({v,l,c})=>(
              <div key={l} style={{background:T.tableHead, border:`1.5px solid ${T.border}`, borderRadius:4, padding:10, textAlign:'center'}}>
                <div style={{fontSize:22, fontWeight:700, color:c||'#e8eaf0', lineHeight:1}}>{v}</div>
                <div style={{fontSize:10, color:T.subtext, textTransform:'uppercase', letterSpacing:1, marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Status bar */}
          <div style={{padding:'11px 14px', borderRadius:4, fontWeight:700, letterSpacing:'.5px', textAlign:'center',
            background:`${sc}18`, border:`2px solid ${sc}`, color:sc, fontSize:13, marginBottom:10, borderRadius:4}}>
            {statusTxt}
          </div>
          <button onClick={reset}
            style={{width:'100%', background:'transparent', border:`1.5px solid ${T.border}`, color:T.subtext, padding:9, borderRadius:4,
              fontSize:13, fontWeight:600, letterSpacing:1, textTransform:'uppercase', cursor:'pointer'}}>
            ↺ Reset All
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{flex:1, overflowY:'auto', padding:20, background:T.bg}}>

        {/* Deck title */}
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap'}}>
          <span style={{fontSize:17, fontWeight:700, letterSpacing:1}}>DECK LAYOUT — TOP DOWN</span>
          <span style={{background:T.tableHead, border:`1px solid ${T.border}`, borderRadius:3, fontSize:11, padding:'3px 9px', color:T.subtext, letterSpacing:1}}>
            {truck==='flatbed'?'FLAT-BED · 53FT':'DRY VAN · 53FT'}
          </span>
          <span style={{background:T.tableHead, border:`1px solid ${T.border}`, borderRadius:3, fontSize:11, padding:'3px 9px', color:T.subtext, marginLeft:'auto'}}>
            {totalPals} pallets loaded
          </span>
        </div>

        {/* Deck canvas */}
        <div style={panel}>
          <div style={secLabel}>PROPORTIONAL DECK VIEW</div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:T.subtext, marginBottom:6, letterSpacing:1}}>
            <span>← FRONT</span><span>REAR →</span>
          </div>
          <div ref={deckRef} style={{background:T.tableHead, border:`2px solid ${T.border}`, borderRadius:3, width:'100%', height:130, position:'relative', overflow:'hidden'}}/>
          {/* Ruler */}
          <div style={{display:'flex', marginTop:5, fontSize:10, color:T.subtext, position:'relative', height:13}}>
            {[0,4,8,12,16,20,24,28,32,36,40,44,48,52].map(f=>(
              <span key={f} style={{position:'absolute', left:`${f/52*100}%`, transform:'translateX(-50%)' }}>{f}ft</span>
            ))}
          </div>
          {/* Legend */}
          <div style={{display:'flex', gap:14, flexWrap:'wrap', marginTop:14}}>
            {[['#4a90d9',"8' Blanket (8ft/row, 4 pals)"],['#7b5ea7',"16' Blanket (16ft/row, 4 pals)"],['#f5a623','Wattle 9" (4ft/row, 2 pals)'],['#e8472c','Wattle 12" (4ft/row, 2 pals)']].map(([c,l])=>(
              <div key={l} style={{display:'flex', alignItems:'center', gap:5, fontSize:11, color:T.subtext}}>
                <div style={{width:11, height:11, borderRadius:2, background:c, flexShrink:0}}/>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Utilization bar */}
        <div style={{...panel, border:`1.5px solid ${statusCls==='over'?'#e8472c':statusCls==='warn'?'#f5a623':'#2a3d32'}`,
          background:statusCls==='over'?'rgba(232,71,44,0.06)':T.cardBg}}>
          <div style={secLabel}>DECK UTILIZATION</div>
          <div style={{background:T.tableHead, borderRadius:3, height:24, overflow:'hidden', display:'flex', position:'relative', marginBottom:8}}>
            {[{pe:palEqB8,c:C.b8},{pe:palEqB16,c:C.b16},{pe:palEqW9,c:C.w9},{pe:palEqW12,c:C.w12}].map(({pe,c},i)=>(
              <div key={i} style={{height:'100%', width:`${(pe/denom*100).toFixed(2)}%`, background:c, transition:'width .4s',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, overflow:'hidden', whiteSpace:'nowrap'}}/>
            ))}
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:12, color:statusCls==='over'?'#e8472c':'#7a9088'}}>
            <span>{Math.round(totalPalEq/denom*100)}% ({totalPals} pallets loaded){totalPalEq>denom?` — ${totalPalEq-denom} over`:''}</span>
            <span>{remPalEq!==null?(remPalEq>=0?`${remPalEq} pallets remaining`:`${Math.abs(remPalEq)} pallets over capacity`):''}</span>
          </div>
        </div>

        {/* Recommendations */}
        <div style={panel}>
          <div style={secLabel}>LOAD RECOMMENDATIONS</div>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {recs.map((r,i)=>{
              const rc={warn:'#e8472c',fill:'#f5a623',good:'#34c77b'}[r.cls]||'#4a9e6b';
              return (
                <div key={i} style={{display:'flex', alignItems:'flex-start', gap:10, background:T.tableHead, borderRadius:4, padding:'10px 12px', borderLeft:`3px solid ${rc}`}}>
                  <div style={{fontSize:13, fontWeight:800, flexShrink:0, marginTop:2, color:rc}}>{r.icon}</div>
                  <div style={{fontSize:13, lineHeight:1.5, color:T.text}}>
                    <div style={{fontSize:14, fontWeight:700, marginBottom:2}}>{r.title}</div>
                    {r.body.split('\n').map((line,j)=><div key={j}>{line}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breakdown table */}
        <div style={panel}>
          <div style={secLabel}>LOAD BREAKDOWN</div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
            <thead>
              <tr>{['Product','Qty','Pallets','Pal. Equiv.','Deck ft','Est. Weight'].map(h=>(
                <th key={h} style={{fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:T.subtext, textAlign:h==='Product'?'left':'right', padding:'0 8px 9px', borderBottom:`1px solid ${T.border}`}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[
                {c:C.b8,  l:"8' Blanket",  q:vqb8,  p:vpb8,  pe:palEqB8,  ft:rb8.deckFt,  w:wb8},
                {c:C.b16, l:"16' Blanket", q:vqb16, p:vpb16, pe:palEqB16, ft:rb16.deckFt, w:wb16},
                {c:C.w9,  l:'Wattle 9"',   q:vqw9,  p:vpw9,  pe:palEqW9,  ft:rw9.deckFt,  w:ww9},
                {c:C.w12, l:'Wattle 12"',  q:vqw12, p:vpw12, pe:palEqW12, ft:rw12.deckFt, w:ww12},
              ].map(({c,l,q,p,pe,ft,w})=>(
                <tr key={l} style={{borderBottom:`1px solid ${T.border}`}}>
                  <td style={{padding:'8px 8px'}}><span style={{display:'inline-flex', alignItems:'center', gap:7, fontWeight:600}}>
                    <span style={{width:9, height:20, borderRadius:2, background:c, flexShrink:0}}/>
                    {l}
                  </span></td>
                  <td style={{textAlign:'right', padding:'8px 8px', fontFamily:'monospace', fontSize:14, fontWeight:600}}>{q}</td>
                  <td style={{textAlign:'right', padding:'8px 8px', fontFamily:'monospace', fontSize:14, fontWeight:600}}>{p}</td>
                  <td style={{textAlign:'right', padding:'8px 8px', fontFamily:'monospace', fontSize:14, fontWeight:600}}>{pe}</td>
                  <td style={{textAlign:'right', padding:'8px 8px', fontFamily:'monospace', fontSize:14, fontWeight:600}}>{ft>0?ft.toFixed(1)+'ft':'0ft'}</td>
                  <td style={{textAlign:'right', padding:'8px 8px', fontFamily:'monospace', fontSize:14, fontWeight:600}}>{w.toLocaleString()} lbs</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{padding:'10px 8px', fontWeight:700, borderTop:`2px solid ${T.border}`}}>TOTAL</td>
                {[vqb8+vqb16+vqw9+vqw12, totalPals, totalPalEq, totalDeckFt.toFixed(1)+'ft', totalWt.toLocaleString()+' lbs'].map((v,i)=>(
                  <td key={i} style={{textAlign:'right', padding:'10px 8px', fontWeight:700, borderTop:`2px solid ${T.border}`, fontFamily:'monospace'}}>{v}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mixed load table */}
        <div style={panel}>
          <div style={{...secLabel, marginBottom:12}}>{mixedTitle}</div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
            <thead>
              <tr>{["8′ Blanket Pallets", truck==='flatbed'?"Wattle / 8′ Pallets":"Wattle Pallets", "Total"].map(h=>(
                <th key={h} style={{fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:T.subtext, textAlign:'right', padding:'0 8px 9px', borderBottom:`1px solid ${T.border}`}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(()=>{
                let bi=-1, bd=Infinity;
                mixedTable.forEach((row,i)=>{
                  const d=Math.abs(row[0]-blanketPals)+Math.abs(row[1]-wattlePals);
                  if(d<bd){bd=d;bi=i;}
                });
                return mixedTable.map((row,i)=>{
                  const isExact=row[0]===blanketPals&&row[1]===wattlePals&&(blanketPals>0||wattlePals>0);
                  const isClose=i===bi&&(blanketPals>0||wattlePals>0)&&!isExact;
                  return (
                    <tr key={i} style={{background:isExact?'rgba(52,199,123,0.12)':isClose?'rgba(245,166,35,0.09)':T.cardBg,
                      borderBottom:`1px solid ${T.border}`, fontWeight:isExact||isClose?700:400,
                      color:isExact?'#34c77b':isClose?'#f5a623':'inherit'}}>
                      {row.map((v,j)=><td key={j} style={{padding:'7px 8px', textAlign:'right', fontFamily:'monospace', fontSize:14}}>{v}</td>)}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

// ─── Mobile Layout ─────────────────────────────────────────────────────────────
function MobileLayout({
  T, theme, setTheme,
  activeTab, setActiveTab, mobileView, setMobileView,
  quotes, allQuotes, activeQuote, setActiveQuote,
  createNewQuote, saveQuote, editQuote, deleteQuote, duplicateQuote,
  deleteConfirm, setDeleteConfirm, closeConfirm, setCloseConfirm,
  searchQ, setSearchQ, quoteSort, setQuoteSort,
  productsCAD, productsUSD, effectiveProductsUSD,
  openEmailModal, generatePDF,
  dims, setDims,
  loginName, setAuthed, setLoginName,
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const MOBILE_TABS = [
    {id:'quotes',   label:'Quotes',   icon:'quote'},
    {id:'dims',     label:'DIMS',     icon:'dims'},
    {id:'shipping', label:'Shipping', icon:'ship'},
    {id:'loadcalc', label:'Load',     icon:'truck'},
  ];

  const bg = T.bg;
  const headerH = 52;
  const tabBarH = 58;

  // ── Quote detail view ──────────────────────────────────────────────────────
  if (activeTab === 'quotes' && activeQuote) {
    return (
      <div style={{fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:bg, color:T.text, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>
        {/* Mobile quote header */}
        <div style={{background:T.headerBg, borderBottom:`1px solid ${T.border}`, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0}}>
          <button onClick={()=>{ if(!activeQuote.saved){setCloseConfirm(activeQuote);}else{setActiveQuote(null);} }}
            style={{background:'none', border:'none', color:T.accent, fontSize:22, cursor:'pointer', padding:'0 4px', lineHeight:1}}>←</button>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:700, color:T.accent}}>{activeQuote.quoteNum}</div>
            <div style={{fontSize:11, color:T.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{activeQuote.company||activeQuote.name||'New Quote'}</div>
          </div>
          {activeQuote.saved && (
            <div style={{display:'flex', gap:8}}>
              <button className="btn" style={{fontSize:11, padding:'5px 10px'}} onClick={()=>openEmailModal(activeQuote)}>✉</button>
              <button className="btn" style={{fontSize:11, padding:'5px 10px', color:T.accent}} onClick={()=>generatePDF(activeQuote)}>↓PDF</button>
            </div>
          )}
        </div>
        {/* Quote form scrollable */}
        <div style={{flex:1, overflowY:'auto', padding:12}}>
          <QuoteForm
            quote={activeQuote} setQuote={setActiveQuote}
            productsCAD={productsCAD} productsUSD={effectiveProductsUSD}
            onSave={saveQuote} onEdit={editQuote}
            onEmail={openEmailModal} onPDF={generatePDF}
            onClose={()=>{ if(!activeQuote.saved){setCloseConfirm(activeQuote);}else{setActiveQuote(null);} }}
            onNewQuote={()=>{setActiveQuote(null); setTimeout(createNewQuote,50);}}
            isMobile={true} T={T}/>
        </div>
        {/* Confirm modals */}
        {closeConfirm && (
          <div className="modal-overlay" onClick={()=>setCloseConfirm(null)}>
            <div className="modal" style={{maxWidth:340, textAlign:'center', padding:'28px 20px'}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:22, marginBottom:10}}>💾</div>
              <div style={{fontSize:15, fontWeight:600, marginBottom:6}}>Save before closing?</div>
              <div style={{fontSize:12, color:T.muted, marginBottom:20}}>{closeConfirm.quoteNum} has unsaved changes.</div>
              <div style={{display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
                <button className="btn" style={{padding:'8px 16px'}} onClick={()=>setCloseConfirm(null)}>Keep editing</button>
                <button className="btn-del" style={{padding:'8px 16px'}} onClick={()=>{setActiveQuote(null);setCloseConfirm(null);}}>Discard</button>
                <button className="btn-gold" style={{padding:'8px 16px'}} onClick={()=>{saveQuote(closeConfirm);setCloseConfirm(null);}}>Save & Close</button>
              </div>
            </div>
          </div>
        )}
        {deleteConfirm && (
          <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
            <div className="modal" style={{maxWidth:320, textAlign:'center', padding:'28px 20px'}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:22, marginBottom:10}}>🗑️</div>
              <div style={{fontSize:15, fontWeight:600, marginBottom:6}}>You sure about that?</div>
              <div style={{fontSize:12, color:T.muted, marginBottom:20}}>Delete <span style={{color:'#c8a96e'}}>{deleteConfirm.quoteNum}</span>?</div>
              <div style={{display:'flex', gap:8, justifyContent:'center'}}>
                <button className="btn" style={{padding:'8px 16px'}} onClick={()=>setDeleteConfirm(null)}>No, keep it</button>
                <button className="btn-del" style={{padding:'8px 16px'}} onClick={()=>deleteQuote(deleteConfirm.id)}>Yes, delete it</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main tab content ───────────────────────────────────────────────────────
  const tabContent = () => {
    if (activeTab === 'quotes') return (
      <div style={{flex:1, overflowY:'auto', display:'flex', flexDirection:'column'}}>
        {/* Search bar */}
        {searchOpen && (
          <div style={{padding:'8px 12px', background:T.panelBg, borderBottom:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:4}}>
            {[{k:'name',p:'Name'},{k:'company',p:'Company'},{k:'quoteNum',p:'Quote #'},{k:'sku',p:'SKU'},{k:'description',p:'Description'}].map(f=>(
              <input key={f.k} value={searchQ[f.k]} onChange={e=>setSearchQ(p=>({...p,[f.k]:e.target.value}))}
                placeholder={f.p} style={{height:32, fontSize:13, width:'100%'}}/>
            ))}
            <button className="btn" style={{fontSize:11}} onClick={()=>{setSearchQ({name:'',company:'',date:'',madeBy:'',quoteNum:'',sku:'',description:''});}}>Clear</button>
          </div>
        )}
        {/* Quote list */}
        {(quotes.length===0) && <div style={{padding:24, textAlign:'center', color:T.muted, fontSize:13}}>No quotes yet</div>}
        {[...(quotes||[])].sort((a,b)=>{
          const na=parseInt((a.quoteNum||'').replace(/\D/g,''))||0;
          const nb=parseInt((b.quoteNum||'').replace(/\D/g,''))||0;
          return quoteSort==='asc'?na-nb:nb-na;
        }).map(q=>{
          const total = (q.lineItems||[]).reduce((s,li)=>s+(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0),0);
          return (
            <div key={q.id} style={{borderBottom:`1px solid ${T.border}`, padding:'14px 16px', cursor:'pointer', background:T.cardBg, display:'flex', alignItems:'center', gap:12}}
              onClick={()=>setActiveQuote(q)}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                  <span style={{fontSize:14, fontWeight:700, color:T.accent}}>{q.quoteNum}</span>
                  <span className={`pill ${q.saved?'pill-saved':'pill-open'}`}>{q.saved?'Saved':'Open'}</span>
                </div>
                <div style={{fontSize:13, color:T.subtext, marginBottom:2}}>{q.name||'—'}</div>
                <div style={{fontSize:12, color:T.muted}}>{q.company||'—'} · {total>0?fmtCur(total)+' ':''}{q.currency}</div>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0}}>
                <button style={{background:'none', border:'none', color:T.accent, fontSize:20, cursor:'pointer', lineHeight:1}} onClick={e=>{e.stopPropagation();duplicateQuote(q);}}>⧉</button>
                <button style={{background:'none', border:'none', color:'#c84444', fontSize:18, cursor:'pointer', lineHeight:1}} onClick={e=>{e.stopPropagation();setDeleteConfirm(q);}}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    );

    if (activeTab === 'products') return (
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <ProductsTab
          products={productsCAD} setProducts={()=>{}}
          currency="CAD" setCurrency={()=>{}}
          search="" setSearch={()=>{}}
          categories={{}} setCategories={()=>{}}
          exchangeRate={0.73} setExchangeRate={()=>{}}
          T={T}/>
      </div>
    );

    if (activeTab === 'dims') return (
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <DimsTab dims={dims} setDims={setDims} T={T}/>
      </div>
    );

    if (activeTab === 'shipping') return (
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <ShippingTab T={T}/>
      </div>
    );

    if (activeTab === 'loadcalc') return (
      <div style={{flex:1, overflow:'auto'}}>
        <MobileLoadCalc T={T}/>
      </div>
    );

    return null;
  };

  return (
    <div style={{fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:bg, color:T.text, height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <style>{`
        @media (max-width: 767px) {
          .data-table th, .data-table td { padding: 5px 8px !important; font-size: 11px !important; }
          input, select, textarea { font-size: 16px !important; } /* prevents iOS zoom */
        }
      `}</style>

      {/* Mobile header */}
      <div style={{background:T.headerBg, borderBottom:`1px solid ${T.border}`, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0, height:headerH}}>
        <img src={theme==='dark' ? FAVICON_DARK : FAVICON_LIGHT}
          style={{width:28,height:28,objectFit:"contain"}} alt="BMP"/>
        <div style={{flex:1}}>
          <div style={{fontSize:12, fontWeight:700, letterSpacing:'.08em', color:T.text}}>BMP SUPPLIES</div>
          <div style={{fontSize:8, color:T.muted, letterSpacing:'.14em'}}>SALES HUB</div>
        </div>
        {/* Right actions */}
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          {activeTab==='quotes' && (
            <button onClick={()=>setSearchOpen(s=>!s)}
              style={{background:searchOpen?T.accent:'none', border:`1px solid ${T.border}`, color:searchOpen?'#fff':T.muted, width:32, height:32, borderRadius:4, cursor:'pointer', fontSize:14}}>
              🔍
            </button>
          )}
          <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}
            style={{background:'none', border:`1px solid ${T.border}`, color:T.muted, width:32, height:32, borderRadius:4, cursor:'pointer', fontSize:14}}>
            {theme==='dark'?'☀':'☾'}
          </button>
          <button onClick={()=>{setAuthed(false);setLoginName('');}}
            style={{background:'none', border:`1px solid ${T.border}`, color:T.muted, padding:'0 8px', height:32, borderRadius:4, cursor:'pointer', fontSize:11}}>
            {loginName}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column', paddingBottom:tabBarH}}>
        {tabContent()}
      </div>

      {/* New Quote FAB — only on quotes tab */}
      {activeTab==='quotes' && (
        <button onClick={createNewQuote}
          style={{position:'fixed', right:16, bottom:tabBarH+12, width:52, height:52, borderRadius:'50%',
            background:'#c8a96e', border:'none', color:'#0a0a0a', fontSize:26, fontWeight:300,
            cursor:'pointer', boxShadow:'0 3px 12px rgba(0,0,0,.25)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1}}>
          +
        </button>
      )}

      {/* Bottom tab bar */}
      <div style={{position:'fixed', bottom:0, left:0, right:0, height:tabBarH,
        background:T.headerBg, borderTop:`1px solid ${T.border}`,
        display:'flex', zIndex:40}}>
        {MOBILE_TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{flex:1, background:'none', border:'none', cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
              color: activeTab===tab.id ? '#c8a96e' : T.muted,
              borderTop: activeTab===tab.id ? '2px solid #c8a96e' : '2px solid transparent',
              padding:'6px 0'}}>
            <Icon name={tab.icon} size={20} color="currentColor"/>
            <span style={{fontSize:9, letterSpacing:'.04em', textTransform:'uppercase', fontWeight:activeTab===tab.id?600:400}}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth:320, textAlign:'center', padding:'28px 20px'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:22, marginBottom:10}}>🗑️</div>
            <div style={{fontSize:15, fontWeight:600, marginBottom:6}}>You sure about that?</div>
            <div style={{fontSize:12, color:T.muted, marginBottom:20}}>Delete <span style={{color:'#c8a96e'}}>{deleteConfirm.quoteNum}</span>?</div>
            <div style={{display:'flex', gap:8, justifyContent:'center'}}>
              <button className="btn" style={{padding:'8px 16px'}} onClick={()=>setDeleteConfirm(null)}>No, keep it</button>
              <button className="btn-del" style={{padding:'8px 16px'}} onClick={()=>deleteQuote(deleteConfirm.id)}>Yes, delete it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mobile Load Calculator (left panel only) ──────────────────────────────────
function MobileLoadCalc({T}) {
  const [truck, setTruck]   = useState('flatbed');
  const [qb8,  setQb8]      = useState('');
  const [pb8,  setPb8]      = useState('');
  const [qb16, setQb16]     = useState('');
  const [pb16, setPb16]     = useState('');
  const [qw9,  setQw9]      = useState('');
  const [pw9,  setPw9]      = useState('');
  const [qw12, setQw12]     = useState('');
  const [pw12, setPw12]     = useState('');

  const C = { b8:'#4a90d9', b16:'#7b5ea7', w9:'#f5a623', w12:'#e8472c' };

  const ROW = {
    b8:  {palsPerRow:4, qtyPerPal:25, wt:55},
    b16: {palsPerRow:4, qtyPerPal:20, wt:110},
    w9:  {palsPerRow:2, qtyPerPal:14, wt:40},
    w12: {palsPerRow:2, qtyPerPal:12, wt:40}
  };

  const calc = useMemo(()=>{
    const vqb8=parseInt(qb8)||0, vqb16=parseInt(qb16)||0;
    const vqw9=parseInt(qw9)||0, vqw12=parseInt(qw12)||0;
    const vpb8=Math.ceil(vqb8/25), vpb16=truck==='dryvan'?0:Math.ceil(vqb16/20);
    const vpw9=Math.ceil(vqw9/14), vpw12=Math.ceil(vqw12/12);
    const palEq=vpb8+vpb16*2+vpw9+vpw12;
    const totalWt=vqb8*55+vqb16*110+vqw9*40+vqw12*40;
    const denom=truck==='flatbed'?26:26;
    const rem=denom-palEq;
    let statusCls='ok', statusTxt='';
    if(truck==='dryvan'&&vqb16>0){statusCls='over';statusTxt='16ft ROLLS NOT PERMITTED IN DRY VAN';}
    else if(palEq>denom){statusCls='over';statusTxt=`OVER BY ${palEq-denom} PALLETS`;}
    else if(palEq===denom){statusCls='warn';statusTxt=`FULL — ${denom}/${denom} PALLETS`;}
    else{statusCls='ok';statusTxt=rem>0?`${rem} PALLET${rem!==1?'S':''} REMAINING`:'Ready';}
    return {vqb8,vqb16,vqw9,vqw12,vpb8,vpb16,vpw9,vpw12,palEq,totalWt,rem,denom,statusCls,statusTxt};
  },[truck,qb8,qb16,qw9,qw12]);

  const sc={ok:'#34c77b',warn:'#f5a623',over:'#e8472c'}[calc.statusCls];

  function fromQty(perPal,setQ,setP){return e=>{const q=parseInt(e.target.value)||0;setQ(e.target.value);setP(q>0?String(Math.ceil(q/perPal)):'');}}
  function fromPals(perPal,setQ,setP){return e=>{const p=parseInt(e.target.value)||0;setP(e.target.value);setQ(p>0?String(p*perPal):'');}}
  function reset(){setQb8('');setPb8('');setQb16('');setPb16('');setQw9('');setPw9('');setQw12('');setPw12('');}

  const PB = ({label,dims,dot,qv,pv,onQ,onP,disabled})=>(
    <div style={{background:T.panelBg,border:`1.5px solid ${T.border}`,borderRadius:5,padding:'12px 14px',marginBottom:10,opacity:disabled?0.35:1,pointerEvents:disabled?'none':'auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <div style={{display:'flex',alignItems:'center',gap:7,fontSize:14,fontWeight:700,color:T.text}}>
          <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:dot,flexShrink:0}}/>
          {label}
        </div>
        <div style={{fontSize:10,color:T.muted}}>{dims}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:8,alignItems:'end'}}>
        <div>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:'1.5px',color:T.muted,marginBottom:4}}>ROLLS / UNITS</div>
          <input type="number" min="0" value={qv} onChange={onQ}
            style={{width:'100%',textAlign:'center',fontSize:18,fontWeight:600,padding:'8px 4px',borderRadius:4,background:T.inputBg,border:`1.5px solid ${T.borderMid}`,color:T.text,height:48}}/>
        </div>
        <div style={{fontSize:12,color:T.muted,textAlign:'center',paddingBottom:10}}>or</div>
        <div>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:'1.5px',color:T.muted,marginBottom:4}}>PALLETS</div>
          <input type="number" min="0" value={pv} onChange={onP}
            style={{width:'100%',textAlign:'center',fontSize:18,fontWeight:600,padding:'8px 4px',borderRadius:4,background:T.inputBg,border:`1.5px solid ${T.borderMid}`,color:T.text,height:48}}/>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{background:T.bg,color:T.text,padding:16,minHeight:'100%'}}>
      {/* Truck type */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:T.muted,marginBottom:10}}>TRUCK TYPE</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[['flatbed','FLAT-BED','53ft · max 26 pallets'],['dryvan','DRY VAN','53ft · mixed load table']].map(([id,lbl,sub])=>(
            <button key={id} onClick={()=>setTruck(id)}
              style={{background:truck===id?'rgba(245,166,35,.12)':T.panelBg,border:`2px solid ${truck===id?'#f5a623':T.border}`,
                color:truck===id?'#f5a623':T.muted,padding:'12px 8px',borderRadius:4,cursor:'pointer',textAlign:'center',fontSize:14,fontWeight:700}}>
              {lbl}
              <div style={{fontSize:10,color:truck===id?'rgba(245,166,35,0.6)':T.muted,marginTop:3,fontWeight:400}}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <PB label="8′ Blankets"  dims="25 rolls/pal" dot={C.b8}  qv={qb8}  pv={pb8}  onQ={fromQty(25,setQb8,setPb8)}  onP={fromPals(25,setQb8,setPb8)}/>
      <PB label="16′ Blankets" dims="20 rolls/pal · flatbed only" dot={C.b16} qv={qb16} pv={pb16} disabled={truck==='dryvan'} onQ={fromQty(20,setQb16,setPb16)} onP={fromPals(20,setQb16,setPb16)}/>
      <PB label='Wattles 9"'   dims="14/pal"       dot={C.w9}  qv={qw9}  pv={pw9}  onQ={fromQty(14,setQw9,setPw9)}  onP={fromPals(14,setQw9,setPw9)}/>
      <PB label='Wattles 12"'  dims="12/pal"       dot={C.w12} qv={qw12} pv={pw12} onQ={fromQty(12,setQw12,setPw12)} onP={fromPals(12,setQw12,setPw12)}/>

      {/* Summary */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:T.muted,marginBottom:10}}>SUMMARY</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          {[
            {v:calc.palEq,   l:'Pallets Loaded', c:T.text},
            {v:calc.denom,   l:'Truck Capacity',  c:T.text},
            {v:calc.rem>=0?calc.rem:'OVER', l:'Spots Left', c:calc.rem<0?'#e8472c':calc.rem===0?'#f5a623':'#34c77b'},
            {v:calc.totalWt.toLocaleString(), l:'Est. lbs', c:T.text},
          ].map(({v,l,c})=>(
            <div key={l} style={{background:T.tableHead,border:`1.5px solid ${T.border}`,borderRadius:4,padding:10,textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:1,marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{padding:'12px 14px',borderRadius:4,fontWeight:700,letterSpacing:'.5px',textAlign:'center',
          background:`${sc}18`,border:`2px solid ${sc}`,color:sc,fontSize:14,marginBottom:10}}>
          {calc.statusTxt||'Enter quantities above'}
        </div>
        <button onClick={reset}
          style={{width:'100%',background:'transparent',border:`1.5px solid ${T.border}`,color:T.muted,padding:10,borderRadius:4,fontSize:13,fontWeight:600,cursor:'pointer'}}>
          ↺ Reset All
        </button>
      </div>
    </div>
  );
}

// ─── Quote Grouped List ────────────────────────────────────────────────────────
function QuoteGroupedList({quotes, activeQuote, setActiveQuote, setDeleteConfirm, duplicateQuote, searchQ, quoteSort, T}) {

  // ── Week/month helpers ───────────────────────────────────────────────────
  function getWeekBounds() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun,1=Mon...6=Sat
    const mon = new Date(now); mon.setDate(now.getDate() - ((day+6)%7)); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
    return {mon, sun};
  }

  function parseDate(savedDate) {
    if (!savedDate) return null;
    const d = new Date(savedDate);
    return isNaN(d.getTime()) ? null : d;
  }

  function getMonthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function getMonthLabel(key) {
    const [y, m] = key.split('-');
    return new Date(parseInt(y), parseInt(m)-1, 1).toLocaleDateString('en-CA', {month:'long', year:'numeric'});
  }

  // ── Apply search filter ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = searchQ || {};
    return (quotes||[]).filter(q => {
      const items = q.lineItems||[];
      const skuMatch = !s.sku || items.some(li=>(li.sku||"").toLowerCase().includes(s.sku.toLowerCase()));
      const descMatch = !s.description || items.some(li=>(li.description||"").toLowerCase().includes(s.description.toLowerCase()));
      return (
        (!s.name || (q.name||"").toLowerCase().includes(s.name.toLowerCase())) &&
        (!s.company || (q.company||"").toLowerCase().includes(s.company.toLowerCase())) &&
        (!s.date || (q.savedDate||"").includes(s.date)) &&
        (!s.madeBy || (q.savedBy||"").toLowerCase().includes(s.madeBy.toLowerCase())) &&
        (!s.quoteNum || (q.quoteNum||"").toLowerCase().includes(s.quoteNum.toLowerCase())) &&
        skuMatch && descMatch
      );
    });
  }, [quotes, searchQ]);

  // ── Group into this week / this month / past months ───────────────────────
  const {groups, thisWeekKey, thisMonthKey} = useMemo(() => {
    const {mon, sun} = getWeekBounds();
    const now = new Date();
    const thisMonthKey = getMonthKey(now);

    const thisWeek = [];
    const byMonth = {};

    const sorted = [...filtered].sort((a,b) => {
      const na = parseInt((a.quoteNum||"").replace(/\D/g,""))||0;
      const nb = parseInt((b.quoteNum||"").replace(/\D/g,""))||0;
      return quoteSort==="asc" ? na-nb : nb-na;
    });

    sorted.forEach(q => {
      const d = parseDate(q.savedDate);
      if (d && d >= mon && d <= sun) {
        thisWeek.push(q);
      } else {
        const mk = d ? getMonthKey(d) : 'unsorted';
        if (!byMonth[mk]) byMonth[mk] = [];
        byMonth[mk].push(q);
      }
    });

    // Sort month keys newest first
    const monthKeys = Object.keys(byMonth).sort((a,b) => b.localeCompare(a));

    const groups = [];
    if (thisWeek.length > 0) groups.push({id:'thisweek', label:'This Week', quotes:thisWeek, defaultOpen:true});
    monthKeys.forEach(mk => {
      const label = mk==='unsorted' ? 'Unsorted' : getMonthLabel(mk);
      const isCurrentMonth = mk === thisMonthKey;
      groups.push({id:mk, label, quotes:byMonth[mk], defaultOpen:isCurrentMonth});
    });

    return {groups, thisWeekKey:'thisweek', thisMonthKey};
  }, [filtered, quoteSort]);

  // ── Folder open/close state ────────────────────────────────────────────────
  const [open, setOpen] = useState({});

  // Auto-open new groups when groups change (and on first render)
  useEffect(() => {
    setOpen(prev => {
      const next = {...prev};
      (groups||[]).forEach(g => {
        if (g.defaultOpen && next[g.id] === undefined) next[g.id] = true;
      });
      return next;
    });
  }, [(groups||[]).map(g=>g.id).join(',')]);

  const toggle = id => setOpen(o => ({...o, [id]:!o[id]}));

  if (filtered.length === 0) {
    return <div style={{padding:16, color:T.muted, fontSize:11, textAlign:'center'}}>
      {(quotes||[]).length===0 ? 'No quotes yet' : 'No quotes match your search'}
    </div>;
  }

  return (
    <div style={{paddingBottom:8}}>
      {groups.map(group => (
        <div key={group.id}>
          {/* Folder header */}
          <div onClick={()=>toggle(group.id)}
            style={{display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
              cursor:'pointer', background:T.tableHead, borderBottom:`1px solid ${T.border}`,
              borderTop:`1px solid ${T.border}`, userSelect:'none',
              position:'sticky', top:0, zIndex:2}}
            onMouseOver={e=>e.currentTarget.style.background=T.rowHover}
            onMouseOut={e=>e.currentTarget.style.background=T.tableHead}>
            <span style={{fontSize:10, color:T.muted, width:10, flexShrink:0}}>
              {open[group.id] ? '▾' : '▸'}
            </span>
            <span style={{fontSize:10, fontWeight:600, color:T.subtext, letterSpacing:'.04em', flex:1}}>
              {group.label}
            </span>
            <span style={{fontSize:9, background:T.borderMid, color:T.muted, borderRadius:10,
              padding:'1px 7px', fontWeight:600, flexShrink:0}}>
              {group.quotes.length}
            </span>
          </div>

          {/* Quotes in folder */}
          {open[group.id] && group.quotes.map(q => {
            const isActive = activeQuote?.id === q.id;
            const total = (q.lineItems||[]).reduce((s,li)=>(parseFloat(li.unitPrice)||0)*(parseInt(li.qty)||0)+s, 0);
            return (
              <div key={q.id}
                onClick={()=>setActiveQuote(q)}
                style={{padding:'9px 12px', cursor:'pointer', borderBottom:`1px solid ${T.border}`,
                  background: isActive ? T.activeBg : T.cardBg,
                  borderLeft: isActive ? `2px solid #c8a96e` : '2px solid transparent'}}
                onMouseOver={e=>{ if(!isActive) e.currentTarget.style.background=T.rowHover; }}
                onMouseOut={e=>{ if(!isActive) e.currentTarget.style.background=T.cardBg; }}>
                <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
                      <span style={{fontSize:12, fontWeight:700, color:'#c8a96e'}}>{q.quoteNum}</span>
                      <span className={`pill ${q.saved?'pill-saved':'pill-open'}`}>{q.saved?'Saved':'Open'}</span>
                    </div>
                    <div style={{fontSize:11, color:T.subtext, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{q.name||'—'}</div>
                    <div style={{fontSize:10, color:T.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      {q.company||'—'}
                      {total>0 && <span style={{color:T.accent, fontWeight:600}}> · {fmtCur(total)}</span>}
                      {' '}{q.currency}
                    </div>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:3, flexShrink:0}}>
                    <button title="Duplicate" onClick={e=>{e.stopPropagation();duplicateQuote(q);}}
                      style={{background:'transparent', border:`1px solid ${T.borderMid}`, color:T.muted,
                        width:22, height:22, cursor:'pointer', fontSize:11, borderRadius:2, lineHeight:1,
                        display:'flex', alignItems:'center', justifyContent:'center'}}
                      onMouseOver={e=>e.currentTarget.style.color=T.accent}
                      onMouseOut={e=>e.currentTarget.style.color=T.muted}>⧉</button>
                    <button title="Delete" onClick={e=>{e.stopPropagation();setDeleteConfirm(q);}}
                      style={{background:'transparent', border:'1px solid #2a1818', color:'#774444',
                        width:22, height:22, cursor:'pointer', fontSize:11, borderRadius:2, lineHeight:1,
                        display:'flex', alignItems:'center', justifyContent:'center'}}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
