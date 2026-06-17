// Validates data/tools.json against data/schema.json.
// Exits non-zero (failing the workflow) on any schema or JSON error.
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`✗ Could not parse ${path}: ${err.message}`);
    process.exit(1);
  }
}

const schema = readJson("data/schema.json");
const data = readJson("data/tools.json");

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(data);

if (!valid) {
  console.error("✗ data/tools.json failed validation:");
  for (const err of validate.errors) {
    console.error(`  ${err.instancePath || "(root)"} ${err.message}`);
  }
  process.exit(1);
}

// Check for duplicate ids — not expressible in JSON Schema alone.
const ids = data.map((t) => t.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) {
  console.error(`✗ Duplicate tool ids found: ${[...new Set(dupes)].join(", ")}`);
  process.exit(1);
}

console.log(`✓ data/tools.json is valid (${data.length} tools).`);
