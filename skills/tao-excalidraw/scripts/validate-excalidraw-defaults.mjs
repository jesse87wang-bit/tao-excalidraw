#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const scriptPath = path.resolve(process.argv[1] || "validate-excalidraw-defaults.mjs");
const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error(`Usage: node "${scriptPath}" <file.excalidraw> [...]`);
  process.exit(2);
}

const failures = [];
const fail = (file, id, message) => failures.push(`${file}: ${id}: ${message}`);

for (const input of inputs) {
  const file = path.resolve(input);
  let scene;
  try {
    scene = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, "scene", `cannot parse JSON (${error.message})`);
    continue;
  }

  const elements = (scene.elements || []).filter((element) => !element.isDeleted);
  const ids = elements.map((element) => element.id);
  if (new Set(ids).size !== ids.length) fail(file, "scene", "element IDs are not unique");

  for (const element of elements) {
    const id = element.id || "<missing-id>";
    const exempt = element.customData?.taoStyleExempt === true;

    if (element.opacity !== 100) fail(file, id, `opacity must be 100, got ${element.opacity}`);

    if (element.type === "text") {
      if (element.fontFamily !== 5) fail(file, id, `fontFamily must be 5 (Excalifont), got ${element.fontFamily}`);
      if (!exempt && element.textAlign !== "center") fail(file, id, `textAlign must default to center, got ${element.textAlign}`);
      continue;
    }

    if (exempt || element.type === "image" || element.type === "frame") continue;

    if (["rectangle", "ellipse", "diamond"].includes(element.type)) {
      if (element.fillStyle !== "solid") fail(file, id, `fillStyle must be solid, got ${element.fillStyle}`);
      if (element.strokeWidth !== 2) fail(file, id, `strokeWidth must be 2, got ${element.strokeWidth}`);
      if (element.strokeStyle !== "solid") fail(file, id, `strokeStyle must be solid, got ${element.strokeStyle}`);
      if (element.roughness !== 2) fail(file, id, `roughness must be 2, got ${element.roughness}`);
      if (element.type === "rectangle" && element.roundness?.type !== 3) {
        fail(file, id, `rectangle roundness.type must be 3, got ${element.roundness?.type}`);
      }
    }

    if (element.type === "arrow") {
      if (element.strokeWidth !== 2) fail(file, id, `arrow strokeWidth must be 2, got ${element.strokeWidth}`);
      if (element.strokeStyle !== "solid") fail(file, id, `arrow strokeStyle must be solid, got ${element.strokeStyle}`);
      if (element.roughness !== 2) fail(file, id, `arrow roughness must be 2, got ${element.roughness}`);
      if (element.roundness?.type !== 2) fail(file, id, `arrow roundness.type must be 2, got ${element.roundness?.type}`);
      if (element.elbowed === true) fail(file, id, "arrow must be curved, not elbowed");
      if (element.startArrowhead !== null) fail(file, id, `startArrowhead must be null, got ${element.startArrowhead}`);
      if (element.endArrowhead !== "arrow") fail(file, id, `endArrowhead must be arrow, got ${element.endArrowhead}`);
    }
  }

  for (const element of elements.filter((item) => item.type === "image")) {
    const embedded = scene.files?.[element.fileId];
    if (!embedded || !String(embedded.dataURL || "").startsWith("data:image/")) {
      fail(file, element.id, `missing embedded data URL for fileId ${element.fileId}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`tao-excalidraw defaults OK: ${inputs.length} file(s)`);
