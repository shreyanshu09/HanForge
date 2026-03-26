#!/usr/bin/env node
'use strict';
/**
 * bin/html2hwpx.js — Command-line interface for html2hwpx.
 *
 * Usage:
 *   html2hwpx input.html -o output.hwpx
 *   html2hwpx input.html -o output.html
 *   html2hwpx input.html -o output.json
 *   html2hwpx input.html -o output.hwpx --template /path/to/template/dir
 */

const fs   = require('fs');
const path = require('path');
const { HtmlToAst }    = require('../lib/HtmlToAst');
const { HtmlToHwpx }   = require('../lib/HtmlToHwpx');
const { HtmlRenderer } = require('../lib/HtmlRenderer');

const HTML_EXTS = new Set(['.html', '.htm']);

function printUsage() {
  console.log(`
Usage: html2hwpx <input.html> -o <output.[hwpx|html|json]> [--template <dir>]

Arguments:
  input              Path to the source HTML file (.html or .htm)
  -o, --output       Path for the generated file (.hwpx / .html / .json)
  --template <dir>   Path to an extracted HWPX template directory
                     (default: built-in template/ folder)
                     Unzip a .hwpx file into a folder and pass that folder.

Examples:
  html2hwpx document.html -o output.hwpx
  html2hwpx document.html -o output.hwpx --template ./my_template/
  html2hwpx document.html -o output.html
  html2hwpx document.html -o ast.json
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { input: null, output: null, template: null };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '-o' || arg === '--output') {
      result.output = args[++i];
    } else if (arg === '--template') {
      result.template = args[++i];
    } else if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (!result.input) {
      result.input = arg;
    }
    i++;
  }
  return result;
}

async function main() {
  const { input: inputPath, output: outputPath, template } = parseArgs(process.argv);

  if (!inputPath || !outputPath) {
    printUsage();
    process.exit(1);
  }

  const inputExt = path.extname(inputPath).toLowerCase();
  if (!HTML_EXTS.has(inputExt)) {
    process.stderr.write(
      `Error: '${inputPath}' is not an HTML file.\n` +
      'html2hwpx accepts only .html / .htm input.\n' +
      'Convert your source document to HTML first.\n'
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`Error: Input file not found: ${inputPath}\n`);
    process.exit(1);
  }

  const outputExt = path.extname(outputPath).toLowerCase();

  try {
    if (outputExt === '.hwpx') {
      await HtmlToHwpx.convertToHwpx(inputPath, outputPath, template || undefined);
      console.log(`\n✓ Conversion successful!`);
      console.log(`  Input:  ${inputPath}`);
      console.log(`  Output: ${outputPath}`);
    }
    else if (HTML_EXTS.has(outputExt)) {
      HtmlRenderer.convertToHtml(inputPath, outputPath);
      console.log(`\n✓ Conversion successful!`);
      console.log(`  Input:  ${inputPath}`);
      console.log(`  Output: ${outputPath}`);
    }
    else if (outputExt === '.json') {
      const ast = HtmlToAst.parseFile(inputPath);
      fs.writeFileSync(outputPath, JSON.stringify(ast, null, 2), 'utf8');
      console.log(`AST written to ${outputPath}`);
    }
    else {
      process.stderr.write(
        `Error: Unsupported output format '${outputExt}'.\n` +
        'Supported output formats: .hwpx  .html  .htm  .json\n'
      );
      process.exit(1);
    }
  } catch (e) {
    process.stderr.write(`\n✗ Conversion failed: ${e.message}\n`);
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  }
}

main();
