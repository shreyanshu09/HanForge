'use strict';
/**
 * HtmlRenderer.js — AST → clean HTML renderer.
 *
 * Direct JavaScript translation of HtmlRenderer.py.
 * Converts a Pandoc-compatible AST back to well-formed HTML.
 */

const fs   = require('fs');
const path = require('path');
const { HtmlToAst } = require('./HtmlToAst');

// image-size is optional; if unavailable we just skip auto-sizing
let sizeOf;
try { sizeOf = require('image-size'); } catch (_) { sizeOf = null; }

// ---------------------------------------------------------------------------
// parse a CSS/attr dimension value to pixels
// ---------------------------------------------------------------------------

function parseToPx(valStr) {
  if (!valStr) return null;
  const s = valStr.toLowerCase().trim();
  const m = s.match(/^([\d.]+)([a-z%]*)?/);
  if (!m) return null;
  const val  = parseFloat(m[1]);
  const unit = m[2] || '';
  if (unit === ''   || unit === 'px') return Math.trunc(val);
  if (unit === 'in') return Math.trunc(val * 96);
  if (unit === 'cm') return Math.trunc(val * 37.8);
  if (unit === 'mm') return Math.trunc(val * 3.78);
  if (unit === '%')  return null;
  return Math.trunc(val);
}

// ---------------------------------------------------------------------------
// HtmlRenderer
// ---------------------------------------------------------------------------

class HtmlRenderer {
  /**
   * Convert an HTML file to a cleaned HTML file via round-trip AST.
   * @param {string} inputPath
   * @param {string} outputPath
   */
  static convertToHtml(inputPath, outputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
      throw new Error(
        `Unsupported input format '${ext}'. ` +
        'This build only supports HTML input.'
      );
    }

    const jsonAst = HtmlToAst.parseFile(inputPath);
    const converter = new HtmlRenderer(jsonAst);
    const finalHtml = converter.convert();

    // Extract / copy images if needed
    const outputDir = path.dirname(outputPath) || '.';
    const imagesDir = path.join(outputDir, 'images');

    if (converter.images.length) {
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

      for (const img of converter.images) {
        const srcPath   = img.src_path;
        const fname     = img.filename;
        const targetPath = path.join(imagesDir, fname);

        const candidates = [
          srcPath,
          path.join(path.dirname(path.resolve(inputPath)), srcPath),
        ];
        let embedded = false;
        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            fs.copyFileSync(cand, targetPath);
            embedded = true;
            break;
          }
        }
        if (!embedded) {
          process.stderr.write(`[Warn] Image not found: ${srcPath}\n`);
        }
      }
    }

    fs.writeFileSync(outputPath, finalHtml, 'utf8');
    console.log(`Successfully converted to ${outputPath}`);
  }

  constructor(jsonAst) {
    this.ast       = jsonAst;
    this.output    = [];
    this.footnotes = [];   // Footnotes list
    this.images    = [];   // metadata for images
    this.title     = null;
    this._extractMetadata();
  }

  _extractMetadata() {
    if (!this.ast) return;
    const meta = this.ast.meta || {};
    if (meta.title) {
      const tObj = meta.title;
      if (tObj.t === 'MetaInlines') this.title = this._getPlainText(tObj.c || []);
      else if (tObj.t === 'MetaString') this.title = tObj.c || '';
    }
  }

  _getPlainText(inlines) {
    if (!Array.isArray(inlines)) return '';
    const text = [];
    for (const item of inlines) {
      const t = item.t;
      const c = item.c;
      if (t === 'Str')   text.push(c);
      else if (t === 'Space') text.push(' ');
      else if (['Strong','Emph','Underline','Strikeout','Superscript','Subscript','SmallCaps'].includes(t))
        text.push(this._getPlainText(c));
      else if (t === 'Link')  text.push(this._getPlainText(c[1]));
      else if (t === 'Image') text.push(this._getPlainText(c[1]));
      else if (t === 'Code')  text.push(c[1]);
      else if (t === 'Quoted') text.push('"' + this._getPlainText(c[1]) + '"');
    }
    return text.join('');
  }

  convert() {
    const blocks = this.ast.blocks || [];
    let bodyContent = this._processBlocks(blocks);

    // Footnotes
    if (this.footnotes.length) {
      bodyContent += "\n<hr />\n<div class='footnotes'>\n<ol>\n";
      for (let idx = 0; idx < this.footnotes.length; idx++) {
        const noteHtml = this._processBlocks(this.footnotes[idx]);
        bodyContent += `<li id='fn${idx + 1}'>${noteHtml}</li>\n`;
      }
      bodyContent += '</ol>\n</div>';
    }

    const titleTag = this.title
      ? `<title>${this.title}</title>`
      : '<title>Document</title>';

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
${titleTag}
<style>
  body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px; }
  th { background-color: #f2f2f2; }
  code { background-color: #f0f0f0; padding: 2px 4px; border-radius: 4px; }
  pre { background-color: #f0f0f0; padding: 1rem; overflow-x: auto; }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
  }

  _processBlocks(blocks) {
    const result = [];
    for (const block of blocks) {
      const bType    = block.t;
      const bContent = block.c;
      if      (bType === 'Header')        result.push(this._handleHeader(bContent));
      else if (bType === 'Para')          result.push(this._handlePara(bContent));
      else if (bType === 'Plain')         result.push(this._handlePlain(bContent));
      else if (bType === 'BulletList')    result.push(this._handleBulletList(bContent));
      else if (bType === 'OrderedList')   result.push(this._handleOrderedList(bContent));
      else if (bType === 'CodeBlock')     result.push(this._handleCodeBlock(bContent));
      else if (bType === 'Table')         result.push(this._handleTable(bContent));
      else if (bType === 'BlockQuote')    result.push(this._handleBlockQuote(bContent));
      else if (bType === 'HorizontalRule') result.push('<hr />');
      else if (bType === 'Div')           result.push(this._processBlocks(bContent.length > 1 ? bContent[1] : []));
      else if (bType === 'RawBlock')      { /* silently skip */ }
      else process.stderr.write(`[Warn] Unhandled Block Type: ${bType}\n`);
    }
    return result.join('\n');
  }

  _processInlines(inlines) {
    const result = [];
    if (!Array.isArray(inlines)) return '';
    for (const inline of inlines) {
      const iType    = inline.t;
      const iContent = inline.c;
      if      (iType === 'Str')        result.push(iContent);
      else if (iType === 'Space')      result.push(' ');
      else if (iType === 'Strong')     result.push(`<strong>${this._processInlines(iContent)}</strong>`);
      else if (iType === 'Emph')       result.push(`<em>${this._processInlines(iContent)}</em>`);
      else if (iType === 'Link') {
        const textContent = iContent[1];
        const targetUrl   = iContent[2][0];
        result.push(`<a href="${targetUrl}">${this._processInlines(textContent)}</a>`);
      }
      else if (iType === 'Code')       result.push(`<code>${iContent[1]}</code>`);
      else if (iType === 'SoftBreak')  result.push(' ');   // SoftBreak as Space in HTML
      else if (iType === 'LineBreak')  result.push('<br />');
      else if (iType === 'Underline')  result.push(`<u>${this._processInlines(iContent)}</u>`);
      else if (iType === 'Strikeout')  result.push(`<s>${this._processInlines(iContent)}</s>`);
      else if (iType === 'Span')       result.push(this._processInlines(iContent[1]));
      else if (iType === 'Superscript') result.push(`<sup>${this._processInlines(iContent)}</sup>`);
      else if (iType === 'Subscript')  result.push(`<sub>${this._processInlines(iContent)}</sub>`);
      else if (iType === 'Image')      result.push(this._handleImage(iContent));
      else if (iType === 'Note')       result.push(this._handleNote(iContent));
      else process.stderr.write(`[Warn] Unhandled Inline Type: ${iType}\n`);
    }
    return result.join('');
  }

  _handleHeader(content) {
    const level = content[0];
    const text  = this._processInlines(content[2]);
    return `<h${level}>${text}</h${level}>`;
  }

  _handlePara(content) {
    return `<p>${this._processInlines(content)}</p>`;
  }

  _handlePlain(content) {
    return this._processInlines(content);
  }

  _handleBulletList(content) {
    const itemsHtml = content.map(item => `<li>${this._processBlocks(item)}</li>`);
    return '<ul>\n' + itemsHtml.join('\n') + '\n</ul>';
  }

  _handleOrderedList(content) {
    const itemsHtml = content[1].map(item => `<li>${this._processBlocks(item)}</li>`);
    return '<ol>\n' + itemsHtml.join('\n') + '\n</ol>';
  }

  _handleCodeBlock(content) {
    return `<pre><code>${content[1]}</code></pre>`;
  }

  _handleImage(content) {
    // content = [attr, caption_inlines, [src, title]]
    const attr     = content[0];
    const attrDict = (attr && attr.length > 2) ? Object.fromEntries(attr[2]) : {};

    const altText = this._processInlines(content[1]);
    const srcPath = content[2][0];
    const title   = content[2][1];

    const filename = path.basename(srcPath);

    // Store for extraction
    this.images.push({ src_path: srcPath, filename });

    // Update src to point to images/ folder
    const newSrc = `images/${filename}`;

    let wInt = null, hInt = null;

    if (attrDict.width)  wInt = parseToPx(attrDict.width);
    if (attrDict.height) hInt = parseToPx(attrDict.height);

    // Auto-size via image-size if dimensions not supplied
    if (wInt === null && sizeOf) {
      try {
        if (fs.existsSync(srcPath)) {
          const dims = sizeOf(srcPath);
          wInt = dims.width;
          hInt = dims.height;
        }
      } catch (_) { /* silently ignore */ }
    }

    // Max-width cap (~600px)
    const MAX_WIDTH_PX = 600;
    if (wInt && wInt > MAX_WIDTH_PX) {
      const ratio = MAX_WIDTH_PX / wInt;
      wInt = MAX_WIDTH_PX;
      if (hInt) hInt = Math.trunc(hInt * ratio);
    }

    const widthAttr  = wInt ? ` width="${wInt}"`  : '';
    const heightAttr = hInt ? ` height="${hInt}"` : '';
    const titleAttr  = title ? ` title="${title}"` : '';
    return `<img src="${newSrc}" alt="${altText}"${titleAttr}${widthAttr}${heightAttr} />`;
  }

  _handleNote(content) {
    this.footnotes.push(content);
    const fnNum = this.footnotes.length;
    return `<sup><a href="#fn${fnNum}">[${fnNum}]</a></sup>`;
  }

  _handleBlockQuote(content) {
    return `<blockquote>\n${this._processBlocks(content)}\n</blockquote>`;
  }

  _handleTable(content) {
    const tableHead   = content[3];
    const tableBodies = content[4];
    const htmlParts   = ["<table border='1'>"];

    const headRows = tableHead[1];
    if (headRows.length) {
      htmlParts.push('<thead>');
      for (const row of headRows) {
        htmlParts.push(this._processTableRow(row, true));
      }
      htmlParts.push('</thead>');
    }

    if (tableBodies.length) {
      htmlParts.push('<tbody>');
      for (const body of tableBodies) {
        const bodyRows = body[3];
        for (const row of bodyRows) {
          htmlParts.push(this._processTableRow(row, false));
        }
      }
      htmlParts.push('</tbody>');
    }

    htmlParts.push('</table>');
    return htmlParts.join('\n');
  }

  _processTableRow(row, isHeader = false) {
    const cells   = row[1];
    const rowHtml = ['<tr>'];
    const tag     = isHeader ? 'th' : 'td';

    for (const cell of cells) {
      const cellBlocks  = cell[4];
      const cellContent = this._processBlocks(cellBlocks);
      const rowSpan     = cell[2];
      const colSpan     = cell[3];

      let attrs = '';
      if (rowSpan > 1) attrs += ` rowspan="${rowSpan}"`;
      if (colSpan > 1) attrs += ` colspan="${colSpan}"`;

      rowHtml.push(`<${tag}${attrs}>${cellContent}</${tag}>`);
    }

    rowHtml.push('</tr>');
    return rowHtml.join('');
  }
}

module.exports = { HtmlRenderer };
