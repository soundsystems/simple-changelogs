import { readFileSync, writeFileSync } from "node:fs";

// Single canonical version feeds every product surface in this repository.
const { canonicalVersion } = JSON.parse(
  readFileSync("release/canonical-version.json", "utf8")
);

for (const target of ["apps/mobile/app.json", "apps/web/package.json"]) {
  const contents = JSON.parse(readFileSync(target, "utf8"));
  if (contents.expo) {
    contents.expo.version = canonicalVersion;
  } else {
    contents.version = canonicalVersion;
  }
  writeFileSync(target, `${JSON.stringify(contents, null, 2)}\n`);
}
