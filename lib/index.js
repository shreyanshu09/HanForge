'use strict';
/**
 * html2hwpx — Pure-JavaScript HTML to HWPX converter.
 *
 * No dependency on pandoc or pypandoc.
 *
 * Usage:
 *   const { HtmlToAst, HtmlToHwpx, HtmlRenderer, HTMLtoHWPX } = require('html2hwpx');
 *
 *   // HTML string → HWPX Buffer (mirrors HTMLtoDOCX API)
 *   const buffer = await HTMLtoHWPX(htmlString);
 *
 *   // HTML → HWPX file
 *   await HtmlToHwpx.convertToHwpx('document.html', 'output.hwpx');
 *
 *   // HTML → HTML (round-trip via AST)
 *   HtmlRenderer.convertToHtml('document.html', 'output.html');
 *
 *   // HTML → AST object
 *   const ast = HtmlToAst.parseFile('document.html');
 *   const ast = HtmlToAst.parse('<h1>Hello</h1><p>World</p>');
 */

const { HtmlToAst }    = require('./HtmlToAst');
const { HtmlToHwpx }   = require('./HtmlToHwpx');
const { HtmlRenderer } = require('./HtmlRenderer');

/**
 * Convert an HTML string to a Node.js Buffer containing a .hwpx file.
 *
 * Drop-in equivalent to HTMLtoDOCX from html-to-docx:
 *
 *   const buffer = await HTMLtoHWPX(processedHtml);
 *
 * @param {string} htmlString      - HTML content as a string
 * @param {string} [referencePath] - optional path to a custom HWPX template directory
 * @returns {Promise<Buffer>}
 */
async function HTMLtoHWPX(htmlString, referencePath = null) {
  return HtmlToHwpx.htmlToBuffer(htmlString, referencePath);
}

module.exports = { HtmlToAst, HtmlToHwpx, HtmlRenderer, HTMLtoHWPX };
