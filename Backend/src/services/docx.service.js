import {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, ImageRun, Header,
} from 'docx';
import fs   from 'fs';
import path from 'path';
import { config } from '../config/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const FONT      = 'TH Sarabun New';
const FONT_SIZE = 10;          // pt
const FULL_CM   = 17;          // page content width in cm

// ── Unit helpers ──────────────────────────────────────────────────────────────
const cmToTwips  = (cm) => Math.round(cm * 567);
const ptToHalfPt = (pt) => pt * 2;

// ── DocxElementFactory (Factory Pattern) ──────────────────────────────────────
// Centralises all primitive element construction that was previously scattered
// as module-level functions.  Hoisting the inner makeInfoRow closure (previously
// inside buildDocxBuffer) into this factory eliminates the OCP violation.
const DocxElementFactory = {
    borders() {
        const spec = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
        return { top: spec, left: spec, bottom: spec, right: spec };
    },

    textRun(text, bold = true, size = null) {
        return new TextRun({
            text,
            bold,
            font: FONT,
            size: ptToHalfPt(size ?? FONT_SIZE),
        });
    },

    paragraph(text, bold = true, size = null, spacing = 40) {
        return new Paragraph({
            children: [this.textRun(text, bold, size)],
            spacing:  { after: spacing },
        });
    },

    cell(text, bold = true, bg = null, size = null, widthCm = null) {
        const opts = {
            children: [this.paragraph(text, bold, size)],
            borders:  this.borders(),
        };
        if (bg)      opts.shading = { type: ShadingType.CLEAR, color: 'auto', fill: bg };
        if (widthCm) opts.width   = { size: cmToTwips(widthCm), type: WidthType.DXA };
        return new TableCell(opts);
    },

    infoRow(l1, v1, l2, v2, colWidths) {
        return new TableRow({
            children: [
                this.cell(l1, true, 'D9D9D9', null, colWidths[0]),
                this.cell(v1, true, null,     null, colWidths[1]),
                this.cell(l2, true, 'D9D9D9', null, colWidths[2]),
                this.cell(v2, true, null,     null, colWidths[3]),
            ],
        });
    },

    mergedRow(label, value, colWidths) {
        return new TableRow({
            children: [
                this.cell(label, true, 'D9D9D9', null, colWidths[0]),
                new TableCell({
                    children:   [this.paragraph(value, true)],
                    borders:    this.borders(),
                    columnSpan: 3,
                }),
            ],
        });
    },
};

// ── LLM Output Parsing Helpers ────────────────────────────────────────────────
function extractInfo(result, field) {
    for (const line of result.split('\n')) {
        if (line.includes('|') && line.toLowerCase().includes(field.toLowerCase())) {
            const parts = line.split('|');
            if (parts.length >= 2) return parts[1].trim();
        }
    }
    return 'ไม่ระบุ';
}

function extractSection(result, startMarker, endMarker) {
    const lines  = result.split('\n');
    const output = [];
    let active   = false;
    for (const line of lines) {
        if (line.includes(startMarker))  { active = true; continue; }
        if (active && (endMarker ? line.includes(endMarker) : line.startsWith('---'))) break;
        if (active) output.push(line);
    }
    return output;
}

// ── DiscussionSectionBuilder (Builder Pattern) ────────────────────────────────
// Extracts the stateful flushCell / startCell / addToCell state machine that
// was previously an IIFE-like closure in buildDocxBuffer.
class DiscussionSectionBuilder {
    constructor() {
        this._rows      = [];
        this._current   = null; // { children: Paragraph[], bg: string|null }
        this._inAction  = false;
        this._actionBuf = [];

        // Header row
        this._rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [DocxElementFactory.paragraph('ประเด็นที่หารือในที่ประชุม', true)],
                        borders:  DocxElementFactory.borders(),
                        shading:  { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' },
                    }),
                ],
            })
        );
    }

    _flush() {
        if (!this._current) return;
        this._rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: this._current.children,
                        borders:  DocxElementFactory.borders(),
                        shading:  this._current.bg
                            ? { type: ShadingType.CLEAR, color: 'auto', fill: this._current.bg }
                            : undefined,
                    }),
                ],
            })
        );
        this._current = null;
    }

    _startCell(text, bold = true, bg = null) {
        this._flush();
        this._current = { children: [DocxElementFactory.paragraph(text, bold)], bg };
    }

    _addToCell(text, bold = false) {
        if (!this._current) this._startCell(text, bold);
        else this._current.children.push(DocxElementFactory.paragraph(text, bold));
    }

    /** Feed one trimmed line from the LLM discussion section. */
    processLine(line) {
        const s = line.trim();
        if (!s) return;

        if (s.includes('[ACTION]'))  { this._inAction = true;  this._actionBuf = []; return; }
        if (s.includes('[/ACTION]')) {
            this._inAction = false;
            if (this._actionBuf.length > 0) {
                this._addToCell('[ACTION ITEMS]', true);
                for (const ab of this._actionBuf) this._addToCell(`  ${ab}`, false);
            }
            this._actionBuf = [];
            return;
        }
        if (this._inAction) { this._actionBuf.push(s); return; }

        if      (s.startsWith('## '))  this._startCell(s.slice(3), true, 'EBF3FB');
        else if (s.startsWith('### ')) this._startCell(s.slice(4), true, 'F5F5F5');
        else if (s.startsWith('- '))   this._addToCell(`• ${s.slice(2)}`, false);
        else this._addToCell(s, s.startsWith('ข้อสรุป') || s.startsWith('Meeting Conclusions'));
    }

    /** Finalise and return the assembled Table. */
    build(widthCm) {
        this._flush();
        return new Table({
            rows:  this._rows,
            width: { size: cmToTwips(widthCm), type: WidthType.DXA },
        });
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a DOCX buffer from the structured LLM result string.
 *
 * @param {string}      result   - Raw LLM output following the section markers.
 * @param {object|null} metadata - Optional meeting metadata from the frontend.
 * @returns {Promise<Buffer>}
 */
export async function buildDocxBuffer(result, metadata = null) {
    // ── Resolve meeting fields (metadata takes priority over LLM-extracted values)
    const meetingName  = metadata?.title         || extractInfo(result, 'Meeting Name');
    const meetingDate  = metadata?.date          || extractInfo(result, 'Date');
    const location     = metadata?.bu            || extractInfo(result, 'Location');
    const duration     = metadata?.startTime
        ? `${metadata.startTime} onwards`
        : extractInfo(result, 'Duration');
    const participants = metadata?.participants?.join(', ') || extractInfo(result, 'Participants');

    const agendaLines  = extractSection(result, '---AGENDA_TABLE---', '---DISCUSSION---')
        .filter(l => l.includes('|') && !l.includes('หัวข้อ') && !l.includes('Topic'));
    const discLines    = extractSection(result, '---DISCUSSION---', '---END---');
    const agendaSummary = metadata?.agenda
        || agendaLines.map(l => l.split('|').slice(1).join('|').trim()).join('  |  ');

    // ── Header (logo) ─────────────────────────────────────────────────────────
    const logoPath      = path.resolve(process.cwd(), config.paths.logo);
    const headerChildren = fs.existsSync(logoPath)
        ? [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children:  [new ImageRun({
                data:           fs.readFileSync(logoPath),
                transformation: { width: 101, height: 26 },
            })],
        })]
        : [new Paragraph({ children: [new TextRun('')] })];

    // ── Table 1: Meeting Info ─────────────────────────────────────────────────
    const COL_W = [3, 5.5, 3, 5.5];
    const table1 = new Table({
        rows: [
            DocxElementFactory.infoRow('การประชุม', meetingName, 'วันที่ประชุม', meetingDate, COL_W),
            DocxElementFactory.infoRow('สถานที่',   location,    'ระยะเวลา',     duration,    COL_W),
            DocxElementFactory.mergedRow('ผู้เข้าร่วมการประชุม', participants,  COL_W),
            DocxElementFactory.mergedRow('วาระการประชุม',         agendaSummary, COL_W),
        ],
        width: { size: cmToTwips(FULL_CM), type: WidthType.DXA },
    });

    // ── Table 2: Discussion (via Builder) ─────────────────────────────────────
    const builder = new DiscussionSectionBuilder();
    for (const line of discLines) builder.processLine(line);
    const table2  = builder.build(FULL_CM);

    // ── Assemble Document ─────────────────────────────────────────────────────
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size:   { width: cmToTwips(21), height: cmToTwips(29.7) },
                    margin: { top: cmToTwips(2), right: cmToTwips(2), bottom: cmToTwips(2), left: cmToTwips(2) },
                },
            },
            headers:  { default: new Header({ children: headerChildren }) },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing:   { after: 120 },
                    children:  [DocxElementFactory.textRun(`เอกสารสรุปการประชุม — ${meetingName}`, true, 14)],
                }),
                table1,
                new Paragraph({ spacing: { after: 80 } }),
                table2,
                new Paragraph({ spacing: { after: 80 } }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children:  [DocxElementFactory.textRun('--- ปิดการประชุม / Meeting Adjourned ---', true, 10)],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400 },
                    children: [
                        new TextRun({
                            text: `บันทึกโดย: ${metadata?.app_pmo_name || 'PMO Analyst'} | จัดทำจาก Meeting Transcript`,
                            size: 20,
                            color: '64748b'
                        }),
                    ],
                }),
            ],
        }],
    });

    return Packer.toBuffer(doc);
}
