// js/qb-artifact-schema.js
// Chapter 1 / Build step 2
// Artifact content schema validator. Strict. Pure ESM. No deps.
// Works in browser and Edge runtime without modification.
// Specification: CHAPTER_01_SPEC.md section 7.

export const ARTIFACT_SCHEMA_VERSION = "1.0";

export const KNOWN_AGENT_SLUGS = [
  "soul_map_synthesizer",
  "sensescape_synthesizer",
  "visual_dna_synthesizer",
  "war_table_synthesizer",
  // Chapter 4 step 1 · Logo Direction, the first Phase 02 agent. All
  // three registration surfaces land together per the standing registry
  // merge gate (the 2026-06-10 incident class).
  "logo_direction_agent",
  // Chapter 4 step 2 · Logo Evaluation, three surfaces land together.
  "logo_evaluation_agent",
  // Chapter 4 step 3 · Voice Guide, three surfaces land together.
  "voice_guide_agent",
  // Chapter 5 step 1 · Newsletter Architecture, the first Phase 03 agent.
  // Three surfaces land together per the standing registry merge gate.
  "newsletter_architecture_agent",
  // Chapter 5 steps 2-3 · three surfaces land together per the standing gate.
  "linkedin_strategy_agent",
  "instagram_seed_agent",
  // Chapter 5 steps 4-5 · three surfaces land together per the standing gate.
  "youtube_strategy_agent",
  "content_bridge_agent",
  // Phase '00' sentinel · synthetic test agent loaded only when
  // CHAIN_TEST_AGENT=1 (per chapter-02/step-8-spec §2.2). Listed here so
  // its delivered artifact passes header.agent validation; never user-
  // visible in prod (Console filters phase '00').
  "chain_test_agent",
  // Phase '00' sentinel · synthetic test agent loaded only when
  // FILE_TEST_AGENT=1 (chapter-3 step 3E). Same precedent as
  // chain_test_agent above. Its omission here was the second half of the
  // 2026-06-10 incomplete-registration incident: run.js
  // schema-validate rejected the synthetic artifact
  // (schema_validation_failed, retry_budget 0 → artifact failed).
  "file_test_agent"
];

export const ILLUSTRATION_INVENTORY = [
  "blank-slate",
  "doubter",
  "player",
  "agency",
  "guide",
  "synergy",
  "three-steps",
  "start-building",
  "phase_4",
  "phase_5",
  "nizzarfounder"
];

export const DATA_BLOCK_TYPES = [
  "palette",
  "type_pairing",
  "positioning_map",
  "always_never",
  "priority_list",
  "descriptor_list",
  // Chapter 5 · the content-pack block family. Three deliberately generic
  // types carry every Phase 03-05 deliverable so the reading surface stays
  // one designed system instead of a bespoke renderer per agent:
  //   content_pack      · ordered compound records with long-form bodies
  //                       (posts, newsletter issues, video scripts + reels,
  //                       repurposed pieces, scheduled slots)
  //   numbered_procedure· ordered do-this-then-that steps (production
  //                       briefs, setup sequences)
  //   spec_grid         · label/value pairs (platform settings, cadence,
  //                       KPI readouts)
  "content_pack",
  "numbered_procedure",
  "spec_grid"
];

const AGENT_SLUG_RE = /^[a-z0-9_]+$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const HEADER_ALLOWED_KEYS = ["eyebrow", "title", "subtitle", "agent", "generated_at", "version"];
const BODY_SECTION_ALLOWED_KEYS = ["heading", "prose", "pull_quote", "illustration_slot"];
const DATA_BLOCK_ALLOWED_KEYS = ["type", "title", "content"];
const FOOTER_ALLOWED_KEYS = ["qbp_fields_referenced", "related_artifacts"];
const RELATED_ARTIFACT_ALLOWED_KEYS = ["id", "title"];
const TOP_LEVEL_ALLOWED_KEYS = ["schema_version", "header", "body_sections", "data_blocks", "footer"];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isString(v) {
  return typeof v === "string";
}
function isInt(v) {
  return typeof v === "number" && Number.isInteger(v);
}
function isBool(v) {
  return typeof v === "boolean";
}

function err(errors, path, message) {
  errors.push({ path, message });
}

function checkUnknownKeys(obj, allowed, path, errors) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) {
      err(errors, `${path}.${k}`, `unknown key`);
    }
  }
}

function validateHeader(header, errors) {
  const path = "header";
  if (!isPlainObject(header)) {
    err(errors, path, "header must be an object");
    return;
  }
  checkUnknownKeys(header, HEADER_ALLOWED_KEYS, path, errors);

  if (!isString(header.eyebrow)) {
    err(errors, `${path}.eyebrow`, "eyebrow is required and must be a string");
  } else if (header.eyebrow.length < 1 || header.eyebrow.length > 80) {
    err(errors, `${path}.eyebrow`, "eyebrow length must be 1..80");
  }

  if (!isString(header.title)) {
    err(errors, `${path}.title`, "title is required and must be a string");
  } else if (header.title.length < 1 || header.title.length > 200) {
    err(errors, `${path}.title`, "title length must be 1..200");
  }

  if (header.subtitle !== undefined) {
    if (!isString(header.subtitle)) {
      err(errors, `${path}.subtitle`, "subtitle must be a string");
    } else if (header.subtitle.length > 300) {
      err(errors, `${path}.subtitle`, "subtitle length must be <=300");
    }
  }

  if (!isString(header.agent)) {
    err(errors, `${path}.agent`, "agent is required and must be a string");
  } else {
    if (!AGENT_SLUG_RE.test(header.agent)) {
      err(errors, `${path}.agent`, "agent must match /^[a-z0-9_]+$/");
    }
    if (!KNOWN_AGENT_SLUGS.includes(header.agent)) {
      err(errors, `${path}.agent`, `agent must be one of ${KNOWN_AGENT_SLUGS.join(", ")}`);
    }
  }

  if (!isString(header.generated_at)) {
    err(errors, `${path}.generated_at`, "generated_at is required and must be a string");
  } else if (!ISO_8601_RE.test(header.generated_at) || Number.isNaN(Date.parse(header.generated_at))) {
    err(errors, `${path}.generated_at`, "generated_at must be a valid ISO 8601 timestamp");
  }

  if (!isInt(header.version)) {
    err(errors, `${path}.version`, "version is required and must be an integer");
  } else if (header.version < 1) {
    err(errors, `${path}.version`, "version must be >=1");
  }
}

function validateBodySection(section, path, errors) {
  if (!isPlainObject(section)) {
    err(errors, path, "body_section must be an object");
    return;
  }
  checkUnknownKeys(section, BODY_SECTION_ALLOWED_KEYS, path, errors);

  if (!isString(section.heading)) {
    err(errors, `${path}.heading`, "heading is required and must be a string");
  } else if (section.heading.length < 1 || section.heading.length > 200) {
    err(errors, `${path}.heading`, "heading length must be 1..200");
  }

  if (!isString(section.prose)) {
    err(errors, `${path}.prose`, "prose is required and must be a string");
  } else if (section.prose.length < 1 || section.prose.length > 8000) {
    err(errors, `${path}.prose`, "prose length must be 1..8000");
  }

  if (section.pull_quote !== undefined) {
    if (!isString(section.pull_quote)) {
      err(errors, `${path}.pull_quote`, "pull_quote must be a string");
    } else if (section.pull_quote.length > 500) {
      err(errors, `${path}.pull_quote`, "pull_quote length must be <=500");
    }
  }

  if (section.illustration_slot !== undefined) {
    if (!isString(section.illustration_slot)) {
      err(errors, `${path}.illustration_slot`, "illustration_slot must be a string");
    } else if (!ILLUSTRATION_INVENTORY.includes(section.illustration_slot)) {
      err(errors, `${path}.illustration_slot`, `illustration_slot must be one of ${ILLUSTRATION_INVENTORY.join(", ")}`);
    }
  }
}

function validateBodySections(sections, errors) {
  const path = "body_sections";
  if (!Array.isArray(sections)) {
    err(errors, path, "body_sections must be an array");
    return;
  }
  if (sections.length < 1 || sections.length > 12) {
    err(errors, path, "body_sections must have 1..12 items");
  }
  sections.forEach((s, i) => validateBodySection(s, `${path}[${i}]`, errors));
}

function validatePalette(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "palette content must be an object");
    return;
  }
  checkUnknownKeys(content, ["swatches"], path, errors);
  const sw = content.swatches;
  if (!Array.isArray(sw)) {
    err(errors, `${path}.swatches`, "swatches must be an array");
    return;
  }
  if (sw.length < 1 || sw.length > 12) {
    err(errors, `${path}.swatches`, "swatches must have 1..12 items");
  }
  sw.forEach((item, i) => {
    const p = `${path}.swatches[${i}]`;
    if (!isPlainObject(item)) {
      err(errors, p, "swatch must be an object");
      return;
    }
    checkUnknownKeys(item, ["label", "hex", "rationale"], p, errors);
    if (!isString(item.label) || item.label.length < 1) err(errors, `${p}.label`, "label is required string");
    if (!isString(item.hex)) err(errors, `${p}.hex`, "hex is required string");
    else if (!HEX_RE.test(item.hex)) err(errors, `${p}.hex`, "hex must match /^#[0-9A-Fa-f]{6}$/");
    if (!isString(item.rationale) || item.rationale.length < 1) err(errors, `${p}.rationale`, "rationale is required string");
  });
}

function validateTypePairing(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "type_pairing content must be an object");
    return;
  }
  checkUnknownKeys(content, ["display", "body"], path, errors);
  for (const slot of ["display", "body"]) {
    const v = content[slot];
    const p = `${path}.${slot}`;
    if (!isPlainObject(v)) {
      err(errors, p, `${slot} is required object`);
      continue;
    }
    checkUnknownKeys(v, ["family", "weight", "rationale"], p, errors);
    if (!isString(v.family) || v.family.length < 1) err(errors, `${p}.family`, "family is required string");
    if (!isString(v.weight) || v.weight.length < 1) err(errors, `${p}.weight`, "weight is required string");
    if (!isString(v.rationale) || v.rationale.length < 1) err(errors, `${p}.rationale`, "rationale is required string");
  }
}

function validatePositioningMap(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "positioning_map content must be an object");
    return;
  }
  checkUnknownKeys(content, ["x_axis", "y_axis", "placements"], path, errors);
  for (const axis of ["x_axis", "y_axis"]) {
    const v = content[axis];
    const p = `${path}.${axis}`;
    if (!isPlainObject(v)) {
      err(errors, p, `${axis} is required object`);
      continue;
    }
    checkUnknownKeys(v, ["low", "high"], p, errors);
    if (!isString(v.low) || v.low.length < 1) err(errors, `${p}.low`, "low is required string");
    if (!isString(v.high) || v.high.length < 1) err(errors, `${p}.high`, "high is required string");
  }
  const placements = content.placements;
  const pp = `${path}.placements`;
  if (!Array.isArray(placements)) {
    err(errors, pp, "placements must be an array");
    return;
  }
  if (placements.length < 2 || placements.length > 12) {
    err(errors, pp, "placements must have 2..12 items");
  }
  let selfCount = 0;
  placements.forEach((it, i) => {
    const p = `${pp}[${i}]`;
    if (!isPlainObject(it)) {
      err(errors, p, "placement must be an object");
      return;
    }
    checkUnknownKeys(it, ["label", "x", "y", "is_self"], p, errors);
    if (!isString(it.label) || it.label.length < 1) err(errors, `${p}.label`, "label is required string");
    if (typeof it.x !== "number" || it.x < 0 || it.x > 1) err(errors, `${p}.x`, "x must be a number in 0..1");
    if (typeof it.y !== "number" || it.y < 0 || it.y > 1) err(errors, `${p}.y`, "y must be a number in 0..1");
    if (!isBool(it.is_self)) err(errors, `${p}.is_self`, "is_self must be a boolean");
    else if (it.is_self) selfCount += 1;
  });
  if (Array.isArray(placements) && selfCount !== 1) {
    err(errors, pp, `exactly one placement must have is_self=true (found ${selfCount})`);
  }
}

function validateAlwaysNever(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "always_never content must be an object");
    return;
  }
  checkUnknownKeys(content, ["always", "never"], path, errors);
  for (const slot of ["always", "never"]) {
    const arr = content[slot];
    const p = `${path}.${slot}`;
    if (!Array.isArray(arr)) {
      err(errors, p, `${slot} must be an array`);
      continue;
    }
    if (arr.length < 1 || arr.length > 10) {
      err(errors, p, `${slot} must have 1..10 items`);
    }
    arr.forEach((s, i) => {
      if (!isString(s) || s.length < 1) err(errors, `${p}[${i}]`, "must be a non-empty string");
    });
  }
}

function validatePriorityList(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "priority_list content must be an object");
    return;
  }
  checkUnknownKeys(content, ["items"], path, errors);
  const items = content.items;
  const ip = `${path}.items`;
  if (!Array.isArray(items)) {
    err(errors, ip, "items must be an array");
    return;
  }
  if (items.length < 1 || items.length > 10) {
    err(errors, ip, "items must have 1..10 items");
  }
  const seenRanks = new Set();
  const ranksInOrder = [];
  items.forEach((it, i) => {
    const p = `${ip}[${i}]`;
    if (!isPlainObject(it)) {
      err(errors, p, "item must be an object");
      return;
    }
    checkUnknownKeys(it, ["rank", "label", "rationale"], p, errors);
    if (!isInt(it.rank) || it.rank < 1) err(errors, `${p}.rank`, "rank must be integer >=1");
    else {
      if (seenRanks.has(it.rank)) err(errors, `${p}.rank`, `duplicate rank ${it.rank}`);
      seenRanks.add(it.rank);
      ranksInOrder.push(it.rank);
    }
    if (!isString(it.label) || it.label.length < 1) err(errors, `${p}.label`, "label is required string");
    if (!isString(it.rationale) || it.rationale.length < 1) err(errors, `${p}.rationale`, "rationale is required string");
  });
  if (ranksInOrder.length > 0) {
    const sorted = [...ranksInOrder].sort((a, b) => a - b);
    const isSequentialFrom1 = sorted.every((r, i) => r === i + 1);
    if (!isSequentialFrom1) {
      err(errors, ip, "ranks must be unique and sequential starting from 1");
    }
  }
}

function validateDescriptorList(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "descriptor_list content must be an object");
    return;
  }
  checkUnknownKeys(content, ["groups"], path, errors);
  const groups = content.groups;
  const gp = `${path}.groups`;
  if (!Array.isArray(groups)) {
    err(errors, gp, "groups must be an array");
    return;
  }
  if (groups.length < 1 || groups.length > 8) {
    err(errors, gp, "groups must have 1..8 items");
  }
  groups.forEach((g, i) => {
    const p = `${gp}[${i}]`;
    if (!isPlainObject(g)) {
      err(errors, p, "group must be an object");
      return;
    }
    checkUnknownKeys(g, ["label", "items"], p, errors);
    if (!isString(g.label) || g.label.length < 1) err(errors, `${p}.label`, "label is required string");
    if (!Array.isArray(g.items)) {
      err(errors, `${p}.items`, "items must be an array");
      return;
    }
    if (g.items.length < 1 || g.items.length > 12) {
      err(errors, `${p}.items`, "items must have 1..12 items");
    }
    g.items.forEach((s, j) => {
      if (!isString(s) || s.length < 1) err(errors, `${p}.items[${j}]`, "must be a non-empty string");
    });
  });
}

function validateContentPack(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "content_pack content must be an object");
    return;
  }
  checkUnknownKeys(content, ["items"], path, errors);
  const items = content.items;
  const ip = `${path}.items`;
  if (!Array.isArray(items)) {
    err(errors, ip, "items must be an array");
    return;
  }
  if (items.length < 1 || items.length > 20) {
    err(errors, ip, "items must have 1..20 items");
  }
  items.forEach((it, i) => {
    const p = `${ip}[${i}]`;
    if (!isPlainObject(it)) {
      err(errors, p, "item must be an object");
      return;
    }
    checkUnknownKeys(it, ["kicker", "title", "meta", "body", "specs", "tags", "extras"], p, errors);
    if (it.kicker !== undefined) {
      if (!isString(it.kicker) || it.kicker.length < 1 || it.kicker.length > 60) err(errors, `${p}.kicker`, "kicker must be a string 1..60");
    }
    if (!isString(it.title) || it.title.length < 1 || it.title.length > 200) err(errors, `${p}.title`, "title is required string 1..200");
    if (it.meta !== undefined) {
      if (!Array.isArray(it.meta) || it.meta.length > 6) err(errors, `${p}.meta`, "meta must be an array of <=6");
      else it.meta.forEach((s, j) => { if (!isString(s) || s.length < 1 || s.length > 40) err(errors, `${p}.meta[${j}]`, "must be a string 1..40"); });
    }
    if (!isString(it.body) || it.body.length < 1 || it.body.length > 6000) err(errors, `${p}.body`, "body is required string 1..6000");
    if (it.specs !== undefined) {
      if (!Array.isArray(it.specs) || it.specs.length > 10) err(errors, `${p}.specs`, "specs must be an array of <=10");
      else it.specs.forEach((s, j) => { if (!isString(s) || s.length < 1 || s.length > 300) err(errors, `${p}.specs[${j}]`, "must be a string 1..300"); });
    }
    if (it.tags !== undefined) {
      if (!Array.isArray(it.tags) || it.tags.length > 15) err(errors, `${p}.tags`, "tags must be an array of <=15");
      else it.tags.forEach((s, j) => { if (!isString(s) || s.length < 1 || s.length > 40) err(errors, `${p}.tags[${j}]`, "must be a string 1..40"); });
    }
    if (it.extras !== undefined) {
      if (!Array.isArray(it.extras) || it.extras.length > 6) { err(errors, `${p}.extras`, "extras must be an array of <=6"); return; }
      it.extras.forEach((ex, j) => {
        const ep = `${p}.extras[${j}]`;
        if (!isPlainObject(ex)) { err(errors, ep, "extra must be an object"); return; }
        checkUnknownKeys(ex, ["label", "body"], ep, errors);
        if (!isString(ex.label) || ex.label.length < 1 || ex.label.length > 80) err(errors, `${ep}.label`, "label is required string 1..80");
        if (!isString(ex.body) || ex.body.length < 1 || ex.body.length > 2000) err(errors, `${ep}.body`, "body is required string 1..2000");
      });
    }
  });
}

function validateNumberedProcedure(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "numbered_procedure content must be an object");
    return;
  }
  checkUnknownKeys(content, ["steps"], path, errors);
  const steps = content.steps;
  const sp = `${path}.steps`;
  if (!Array.isArray(steps)) {
    err(errors, sp, "steps must be an array");
    return;
  }
  if (steps.length < 1 || steps.length > 15) {
    err(errors, sp, "steps must have 1..15 items");
  }
  steps.forEach((st, i) => {
    const p = `${sp}[${i}]`;
    if (!isPlainObject(st)) {
      err(errors, p, "step must be an object");
      return;
    }
    checkUnknownKeys(st, ["action", "detail"], p, errors);
    if (!isString(st.action) || st.action.length < 1 || st.action.length > 200) err(errors, `${p}.action`, "action is required string 1..200");
    if (st.detail !== undefined) {
      if (!isString(st.detail) || st.detail.length < 1 || st.detail.length > 600) err(errors, `${p}.detail`, "detail must be a string 1..600");
    }
  });
}

function validateSpecGrid(content, path, errors) {
  if (!isPlainObject(content)) {
    err(errors, path, "spec_grid content must be an object");
    return;
  }
  checkUnknownKeys(content, ["specs"], path, errors);
  const specs = content.specs;
  const sp = `${path}.specs`;
  if (!Array.isArray(specs)) {
    err(errors, sp, "specs must be an array");
    return;
  }
  if (specs.length < 1 || specs.length > 12) {
    err(errors, sp, "specs must have 1..12 items");
  }
  specs.forEach((s, i) => {
    const p = `${sp}[${i}]`;
    if (!isPlainObject(s)) {
      err(errors, p, "spec must be an object");
      return;
    }
    checkUnknownKeys(s, ["label", "value"], p, errors);
    if (!isString(s.label) || s.label.length < 1 || s.label.length > 60) err(errors, `${p}.label`, "label is required string 1..60");
    if (!isString(s.value) || s.value.length < 1 || s.value.length > 300) err(errors, `${p}.value`, "value is required string 1..300");
  });
}

const TYPE_VALIDATORS = {
  palette: validatePalette,
  type_pairing: validateTypePairing,
  positioning_map: validatePositioningMap,
  always_never: validateAlwaysNever,
  priority_list: validatePriorityList,
  descriptor_list: validateDescriptorList,
  content_pack: validateContentPack,
  numbered_procedure: validateNumberedProcedure,
  spec_grid: validateSpecGrid
};

function validateDataBlock(block, path, errors) {
  if (!isPlainObject(block)) {
    err(errors, path, "data_block must be an object");
    return;
  }
  checkUnknownKeys(block, DATA_BLOCK_ALLOWED_KEYS, path, errors);
  if (!isString(block.type)) {
    err(errors, `${path}.type`, "type is required and must be a string");
  } else if (!DATA_BLOCK_TYPES.includes(block.type)) {
    err(errors, `${path}.type`, `type must be one of ${DATA_BLOCK_TYPES.join(", ")}`);
  }
  if (!isString(block.title)) {
    err(errors, `${path}.title`, "title is required and must be a string");
  } else if (block.title.length < 1 || block.title.length > 200) {
    err(errors, `${path}.title`, "title length must be 1..200");
  }
  if (DATA_BLOCK_TYPES.includes(block.type)) {
    TYPE_VALIDATORS[block.type](block.content, `${path}.content`, errors);
  }
}

function validateDataBlocks(blocks, errors) {
  const path = "data_blocks";
  if (!Array.isArray(blocks)) {
    err(errors, path, "data_blocks must be an array");
    return;
  }
  if (blocks.length > 8) {
    err(errors, path, "data_blocks must have <=8 items");
  }
  blocks.forEach((b, i) => validateDataBlock(b, `${path}[${i}]`, errors));
}

function validateFooter(footer, errors) {
  const path = "footer";
  if (!isPlainObject(footer)) {
    err(errors, path, "footer must be an object");
    return;
  }
  checkUnknownKeys(footer, FOOTER_ALLOWED_KEYS, path, errors);

  if (!Array.isArray(footer.qbp_fields_referenced)) {
    err(errors, `${path}.qbp_fields_referenced`, "qbp_fields_referenced is required and must be an array");
  } else {
    footer.qbp_fields_referenced.forEach((s, i) => {
      if (!isString(s)) err(errors, `${path}.qbp_fields_referenced[${i}]`, "must be a string");
    });
  }

  if (footer.related_artifacts !== undefined) {
    if (!Array.isArray(footer.related_artifacts)) {
      err(errors, `${path}.related_artifacts`, "related_artifacts must be an array");
    } else {
      if (footer.related_artifacts.length > 8) {
        err(errors, `${path}.related_artifacts`, "related_artifacts must have <=8 items");
      }
      footer.related_artifacts.forEach((it, i) => {
        const p = `${path}.related_artifacts[${i}]`;
        if (!isPlainObject(it)) {
          err(errors, p, "related_artifact must be an object");
          return;
        }
        checkUnknownKeys(it, RELATED_ARTIFACT_ALLOWED_KEYS, p, errors);
        if (!isString(it.id)) err(errors, `${p}.id`, "id is required string");
        else if (!UUID_RE.test(it.id)) err(errors, `${p}.id`, "id must be a uuid");
        if (!isString(it.title) || it.title.length < 1) err(errors, `${p}.title`, "title is required string");
      });
    }
  }
}

export function validateArtifact(content) {
  const errors = [];

  if (!isPlainObject(content)) {
    return { valid: false, errors: [{ path: "", message: "artifact content must be an object" }] };
  }

  checkUnknownKeys(content, TOP_LEVEL_ALLOWED_KEYS, "", errors);

  if (content.schema_version === undefined) {
    err(errors, ".schema_version", "schema_version is required");
  } else if (content.schema_version !== ARTIFACT_SCHEMA_VERSION) {
    err(errors, ".schema_version", `schema_version must equal "${ARTIFACT_SCHEMA_VERSION}"`);
  }

  if (content.header === undefined) {
    err(errors, "header", "header is required");
  } else {
    validateHeader(content.header, errors);
  }

  if (content.body_sections === undefined) {
    err(errors, "body_sections", "body_sections is required");
  } else {
    validateBodySections(content.body_sections, errors);
  }

  if (content.data_blocks !== undefined) {
    validateDataBlocks(content.data_blocks, errors);
  }

  if (content.footer === undefined) {
    err(errors, "footer", "footer is required");
  } else {
    validateFooter(content.footer, errors);
  }

  if (errors.length === 0) {
    return { valid: true, content };
  }
  return { valid: false, errors };
}
