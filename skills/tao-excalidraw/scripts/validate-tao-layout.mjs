#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const scriptPath = path.resolve(process.argv[1] || "validate-tao-layout.mjs");
const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error(`Usage: node "${scriptPath}" <file.excalidraw> [...]`);
  process.exit(2);
}

const GAP_MIN = 0.24;
const GAP_MAX = 0.30;
const TITLE_MAX_WIDTH = 0.86;
const TITLE_CENTER_TOLERANCE = 0.03;
const TITLE_TOP_MIN = 0.04;
const TITLE_TOP_MAX = 0.06;
const TITLE_SUBTITLE_GAP_MIN = 0.018;
const TITLE_SUBTITLE_GAP_MAX = 0.03;
const SUBTITLE_MAX_WIDTH = 0.82;
const SUBTITLE_CENTER_TOLERANCE = 0.04;
const SUBTITLE_CONTENT_GAP_MIN = 0.044;
const SUBTITLE_CONTENT_GAP_MAX = 0.085;
const CONTENT_TOP_MIN = 0.17;
const CONTENT_TOP_MAX = 0.24;
const EPSILON = 1;
const failures = [];
const fail = (file, id, message) => failures.push(`${file}: ${id}: ${message}`);

const role = (element) => element.customData?.taoRole;
const sectionNumber = (element) => Number(element.customData?.taoSection);
const overlaps = (element, top, bottom) => {
  const elementTop = Number(element.y) || 0;
  const elementBottom = elementTop + (Number(element.height) || 0);
  return elementTop < bottom - EPSILON && elementBottom > top + EPSILON;
};

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
  const frames = elements
    .filter((element) => role(element) === "section-frame")
    .sort((a, b) => a.y - b.y);

  if (!frames.length) {
    fail(file, "layout", "missing section-frame elements");
    continue;
  }

  const frameWidth = Number(frames[0].width);
  const frameHeight = Number(frames[0].height);
  const frameX = Number(frames[0].x);
  const seenSections = new Set();

  for (const frame of frames) {
    const id = frame.id || "<missing-id>";
    const section = sectionNumber(frame);
    if (frame.type !== "rectangle") fail(file, id, "section-frame must be a rectangle");
    if (!Number.isInteger(section) || section < 1) fail(file, id, "taoSection must be a positive integer");
    if (seenSections.has(section)) fail(file, id, `duplicate section-frame for section ${section}`);
    seenSections.add(section);
    if (Math.abs(frame.width - frameWidth) > EPSILON || Math.abs(frame.height - frameHeight) > EPSILON) {
      fail(file, id, `section-frame must match ${frameWidth} × ${frameHeight}`);
    }
    if (Math.abs(frame.x - frameX) > EPSILON) fail(file, id, "section-frames must share the same x coordinate");
    if (frame.opacity !== 100) fail(file, id, `section-frame opacity must be 100, got ${frame.opacity}`);
    if (frame.locked !== true) fail(file, id, "section-frame must be locked");
    if (String(frame.backgroundColor).toLowerCase() !== "#ffffff") fail(file, id, "section-frame backgroundColor must be #ffffff");
    if (String(frame.strokeColor).toLowerCase() !== "#ffffff") fail(file, id, "section-frame strokeColor must be #ffffff");
    if (frame.customData?.taoStyleExempt !== true) fail(file, id, "section-frame must set taoStyleExempt: true");
  }

  for (let index = 0; index < frames.length - 1; index += 1) {
    const current = frames[index];
    const next = frames[index + 1];
    const gapTop = current.y + current.height;
    const gapBottom = next.y;
    const gap = gapBottom - gapTop;
    const ratio = gap / frameHeight;
    if (ratio < GAP_MIN - 0.001 || ratio > GAP_MAX + 0.001) {
      fail(file, `${current.id}->${next.id}`, `gap ratio must be ${GAP_MIN}–${GAP_MAX}, got ${ratio.toFixed(3)}`);
    }

    for (const element of elements) {
      if (role(element) === "section-frame" || element.customData?.taoGapExempt === true) continue;
      if (overlaps(element, gapTop, gapBottom)) {
        fail(file, element.id || "<missing-id>", `visible element overlaps blank gap after section ${sectionNumber(current)}`);
      }
    }
  }

  for (const frame of frames) {
    const section = sectionNumber(frame);
    const titles = elements.filter(
      (element) => role(element) === "section-title" && sectionNumber(element) === section,
    );
    if (titles.length !== 1) {
      fail(file, frame.id, `section ${section} must have exactly one section-title, got ${titles.length}`);
      continue;
    }

    const title = titles[0];
    const titleWidth = Number(title.width) || 0;
    const titleCenter = (Number(title.x) || 0) + titleWidth / 2;
    const frameCenter = frame.x + frame.width / 2;
    const minTitleFont = Math.max(44, Math.min(64, Math.round(frame.width * 0.036)));
    const titleTopRatio = (title.y - frame.y) / frame.height;

    if (title.type !== "text") fail(file, title.id, "section-title must be a text element");
    if (title.fontFamily !== 5) fail(file, title.id, `section-title fontFamily must be 5, got ${title.fontFamily}`);
    if (title.textAlign !== "center") fail(file, title.id, `section-title textAlign must be center, got ${title.textAlign}`);
    if (title.autoResize !== true) fail(file, title.id, "section-title must use autoResize: true");
    if (titleWidth > frame.width * TITLE_MAX_WIDTH + EPSILON) {
      fail(file, title.id, `title width must be <= ${TITLE_MAX_WIDTH}W, got ${(titleWidth / frame.width).toFixed(3)}W`);
    }
    if (Math.abs(titleCenter - frameCenter) > frame.width * TITLE_CENTER_TOLERANCE + EPSILON) {
      fail(file, title.id, "section-title must be centered within 0.03W");
    }
    if ((Number(title.fontSize) || 0) < minTitleFont) {
      fail(file, title.id, `section-title fontSize must be >= ${minTitleFont}, got ${title.fontSize}`);
    }
    if (title.x < frame.x - EPSILON || title.x + titleWidth > frame.x + frame.width + EPSILON) {
      fail(file, title.id, "section-title extends outside its section-frame");
    }
    if (title.y < frame.y - EPSILON || title.y + title.height > frame.y + frame.height + EPSILON) {
      fail(file, title.id, "section-title extends vertically outside its section-frame");
    }
    if (titleTopRatio < TITLE_TOP_MIN - 0.001 || titleTopRatio > TITLE_TOP_MAX + 0.001) {
      fail(
        file,
        title.id,
        `title top must be ${TITLE_TOP_MIN}H–${TITLE_TOP_MAX}H, got ${titleTopRatio.toFixed(3)}H`,
      );
    }

    const subtitles = elements.filter(
      (element) => role(element) === "section-subtitle" && sectionNumber(element) === section,
    );
    if (subtitles.length !== 1) {
      fail(file, frame.id, `section ${section} must have exactly one section-subtitle, got ${subtitles.length}`);
      continue;
    }

    const subtitle = subtitles[0];
    const subtitleWidth = Number(subtitle.width) || 0;
    const subtitleCenter = (Number(subtitle.x) || 0) + subtitleWidth / 2;
    const titleBottom = (Number(title.y) || 0) + (Number(title.height) || 0);
    const titleSubtitleGap = (Number(subtitle.y) || 0) - titleBottom;
    const titleSubtitleGapRatio = titleSubtitleGap / frame.height;

    if (subtitle.type !== "text") fail(file, subtitle.id, "section-subtitle must be a text element");
    if (subtitle.fontFamily !== 5) fail(file, subtitle.id, `section-subtitle fontFamily must be 5, got ${subtitle.fontFamily}`);
    if (subtitle.textAlign !== "center") fail(file, subtitle.id, `section-subtitle textAlign must be center, got ${subtitle.textAlign}`);
    if (subtitle.autoResize !== true) fail(file, subtitle.id, "section-subtitle must use autoResize: true");
    if (subtitleWidth > frame.width * SUBTITLE_MAX_WIDTH + EPSILON) {
      fail(file, subtitle.id, `subtitle width must be <= ${SUBTITLE_MAX_WIDTH}W, got ${(subtitleWidth / frame.width).toFixed(3)}W`);
    }
    if (Math.abs(subtitleCenter - frameCenter) > frame.width * SUBTITLE_CENTER_TOLERANCE + EPSILON) {
      fail(file, subtitle.id, "section-subtitle must be centered within 0.04W");
    }
    if (
      titleSubtitleGapRatio < TITLE_SUBTITLE_GAP_MIN - 0.001 ||
      titleSubtitleGapRatio > TITLE_SUBTITLE_GAP_MAX + 0.001
    ) {
      fail(
        file,
        `${title.id}->${subtitle.id}`,
        `title-to-subtitle gap must be ${TITLE_SUBTITLE_GAP_MIN}H–${TITLE_SUBTITLE_GAP_MAX}H, got ${titleSubtitleGapRatio.toFixed(3)}H`,
      );
    }

    const contentStarts = elements.filter(
      (element) => role(element) === "section-content-start" && sectionNumber(element) === section,
    );
    if (contentStarts.length !== 1) {
      fail(file, frame.id, `section ${section} must have exactly one section-content-start, got ${contentStarts.length}`);
      continue;
    }

    const contentStart = contentStarts[0];
    const subtitleBottom = (Number(subtitle.y) || 0) + (Number(subtitle.height) || 0);
    const contentTop = Number(contentStart.y) || 0;
    const subtitleContentGapRatio = (contentTop - subtitleBottom) / frame.height;
    const contentTopRatio = (contentTop - frame.y) / frame.height;

    if (
      subtitleContentGapRatio < SUBTITLE_CONTENT_GAP_MIN - 0.001 ||
      subtitleContentGapRatio > SUBTITLE_CONTENT_GAP_MAX + 0.001
    ) {
      fail(
        file,
        `${subtitle.id}->${contentStart.id}`,
        `subtitle-to-content gap must be ${SUBTITLE_CONTENT_GAP_MIN}H–${SUBTITLE_CONTENT_GAP_MAX}H, got ${subtitleContentGapRatio.toFixed(3)}H`,
      );
    }
    if (contentTopRatio < CONTENT_TOP_MIN - 0.001 || contentTopRatio > CONTENT_TOP_MAX + 0.001) {
      fail(
        file,
        contentStart.id,
        `section-content-start top must be ${CONTENT_TOP_MIN}H–${CONTENT_TOP_MAX}H, got ${contentTopRatio.toFixed(3)}H`,
      );
    }

    for (const element of elements) {
      if (
        element.id === title.id ||
        element.id === subtitle.id ||
        element.id === contentStart.id ||
        role(element) === "section-frame" ||
        role(element) === "section-number" ||
        element.customData?.taoBreathingGapExempt === true
      ) {
        continue;
      }
      if (overlaps(element, subtitleBottom, contentTop)) {
        fail(file, element.id || "<missing-id>", `visible element intrudes into title breathing gap in section ${section}`);
      }
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`tao-excalidraw layout OK: ${inputs.length} file(s)`);
