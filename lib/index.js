'use strict';
/**
 * html2hwpx — Pure-JavaScript HTML to HWPX converter.
 *
 * No dependency on pandoc or pypandoc.
 *
 * Usage:
 *   const { HtmlToAst, HtmlToHwpx, HtmlRenderer } = require('html2hwpx');
 *
 *   // HTML → HWPX
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

module.exports = { HtmlToAst, HtmlToHwpx, HtmlRenderer };
