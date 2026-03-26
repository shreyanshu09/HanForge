#!/usr/bin/env node
'use strict';
/**
 * convert.js — Standalone conversion script for html2hwpx.
 *
 * Usage:
 *   node convert.js <input.html> <output.hwpx> [template_dir]
 *   node convert.js <input.html> <output.html>
 *   node convert.js <input.html> <output.json>
 *
 * Arguments:
 *   input        Path to the source HTML file.
 *   output       Path for the generated file (.hwpx / .html / .json).
 *   template_dir (optional) Path to an extracted HWPX template directory.
 *                Defaults to the built-in html2hwpx/template/ folder.
 *                To use a custom template: unzip a .hwpx file into a folder
 *                and pass that folder path as the third argument.
 *
 * Examples:
 *   node convert.js document.html document.hwpx
 *   node convert.js document.html document.hwpx ./my_template/
 *   node convert.js document.html document.html
 *   node convert.js document.html ast.json
 */

const fs   = require('fs');
const path = require('path');

const { HtmlToAst }    = require('./lib/HtmlToAst');
const { HtmlToHwpx }   = require('./lib/HtmlToHwpx');
const { HtmlRenderer } = require('./lib/HtmlRenderer');

function usage() {
  console.log(__filename.replace(/.*[\\/]/, '') + ': ' + module.exports.toString().split('\n').slice(1, 20).join('\n'));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(`
Usage: node convert.js <input.html> <output.[hwpx|html|json]> [template_dir]

Examples:
  node convert.js document.html document.hwpx
  node convert.js document.html document.hwpx ./my_template/
  node convert.js document.html document.html
  node convert.js document.html ast.json
`);
    process.exit(1);
  }

  const inputPath  = args[0];
  const outputPath = args[1];
  const template   = args[2] || null;

  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`Error: Input file not found: ${inputPath}\n`);
    process.exit(1);
  }

  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== '.html' && ext !== '.htm') {
    process.stderr.write(
      `Error: Input must be an HTML file, got '${ext}'.\n` +
      'Convert your source to HTML first.\n'
    );
    process.exit(1);
  }

  const outExt = path.extname(outputPath).toLowerCase();

  try {
    if (outExt === '.hwpx') {
      await HtmlToHwpx.convertToHwpx(inputPath, outputPath, template || undefined);
    }
    else if (outExt === '.html' || outExt === '.htm') {
      HtmlRenderer.convertToHtml(inputPath, outputPath);
    }
    else if (outExt === '.json') {
      const ast = HtmlToAst.parseFile(inputPath);
      fs.writeFileSync(outputPath, JSON.stringify(ast, null, 2), 'utf8');
    }
    else {
      process.stderr.write(
        `Error: Unsupported output format '${outExt}'.\n` +
        'Supported: .hwpx  .html  .htm  .json\n'
      );
      process.exit(1);
    }

    console.log(`\n✓ Conversion successful!`);
    console.log(`  Input:  ${inputPath}`);
    console.log(`  Output: ${outputPath}`);

  } catch (e) {
    process.stderr.write(`\n✗ Conversion failed: ${e.message}\n`);
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  }
}

main();
