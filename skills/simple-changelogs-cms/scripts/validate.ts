#!/usr/bin/env bun
import { resolve } from "node:path";
import { validateRepository } from "./lib/schema.ts";

const root = resolve(process.argv[2] ?? process.cwd());
const errors = await validateRepository(root);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exitCode = 1;
} else {
  console.log(`CMS changelog validation passed: ${root}`);
}
