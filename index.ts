import { resolve } from "path";
import * as fs from "fs/promises";

import * as TJS from "typescript-json-schema";

import { Command } from "commander";
import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  quicktype,
} from "@nazo6/quicktype-core";
const program = new Command();

program
  .name("ts2rs")
  .description("Generate rust type from typescript");

program.argument("<input-directory>")
  // .option("-b, --bundle", "Bundle to single file in same module.", false)
  .requiredOption("-o, --output <output-file>", "output file/directory").action(
    async (input: string, opts) => {
      await progress(input, opts.output);
    },
  );

program.parse(process.argv);

async function progress(input: string, output: string) {
  const schema = await generateJsonSchema(input);
  const code = (await generateRust(JSON.stringify(schema))).lines.join("\n");
  await fs.writeFile(resolve(output), code);
}

async function generateRust(jsonSchemaString: string) {
  const inputData = new InputData();
  inputData.addSource(
    "schema",
    {
      schema: jsonSchemaString,
      name: "",
      uris: ["#/definitions/"],
      isConverted: true,
    },
    () =>
      new JSONSchemaInput(
        new FetchingJSONSchemaStore(),
        [],
      ),
  );

  return await quicktype({
    inputData,
    lang: "Rust",
    rendererOptions: {
      "edition-2018": "true",
      "derive-debug": "true",
      "visibility": "public",
    },
  });
}

async function generateJsonSchema(inputPath: string) {
  const input = resolve(inputPath);
  const input_stat = await fs.stat(input);

  let files: string[] = [];
  if (input_stat.isFile()) {
    files = [input];
  } else if (input_stat.isDirectory()) {
    files = (await fs.readdir(input)).map((v) => {
      return resolve(input, v);
    });
  } else {
    console.error("Invalid input path.");
    return;
  }

  const settings: TJS.PartialArgs = {
    required: true,
  };
  const compilerOptions: TJS.CompilerOptions = {
    strictNullChecks: true,
  };
  const program = TJS.getProgramFromFiles(
    files,
    compilerOptions,
  );

  const schema = TJS.generateSchema(program, "*", settings);

  if (!schema) {
    console.error("Failed to generate");
    return;
  }

  return schema;
}
