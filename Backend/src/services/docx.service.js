import {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, ImageRun, Header,
} from 'docx';
import fs from 'fs';
import { config } from '../config/index.js';

// ── Constants ────────────────────────────────────────────────
const FONT      = 'TH Sarabun New';
const FONT_SIZE = 10;
const FULL_CM   = 17;

// ── Unit helpers ─────────────────────────────────────────────
const cmToTwips = (cm)  => Math.round(cm * 567);
const ptToHalfPt = (pt) => pt * 2;

// ── Border factory ───────────────────────────────────────────
function makeBorders() {
    return {
        top:    { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left:   { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right:  { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    };
}

// ── Text/Paragraph helpers ───────────────────────────────────
function makeTextRun(text, bold = true, size = null) {
    return new TextRun({ text, bold, font: FONT, size: ptToHalfPt(size ?? FONT_SIZE) });
}

function makeParagraph(text, bold = true, size = null, spacing = 40) {
    return new Paragraph({ children: [makeTextRun(text, bold, size)], spacing: { after: spacing } });
}

function makeCell(text, bold = true, bg = null, size = null, width = null) {
    const opts = {
        children: [makeParagraph(text, bold, size)],
        borders:  makeBorders(),
    };
    if (bg)    opts.shading = { type: ShadingType.CLEAR, color: 'auto', fill: bg };
    if (width) opts.width   = { size: cmToTwips(width), type: WidthType.DXA };
    return new TableCell(opts);
}

// ── Parsing helpers ──────────────────────────────────────────
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
        if (line.includes(startMarker)) { active = true; continue; }
        if (active && (endMarker ? line.includes(endMarker) : line.startsWith('---'))) break;
        if (active) output.push(line);
    }
    return output;
}

// ── Build the DOCX buffer from LLM result ────────────────────
export async function buildDocxBuffer(result, metadata = null) {
    const meetingName  = metadata?.title || extractInfo(result, 'Meeting Name');
    const meetingDate  = metadata?.date  || extractInfo(result, 'Date');
    const location     = metadata?.bu    || extractInfo(result, 'Location');
    const duration     = metadata?.startTime ? `${metadata.startTime} onwards` : extractInfo(result, 'Duration');
    const participants = metadata?.participants?.join(', ') || extractInfo(result, 'Participants');

    const agendaLines = extractSection(result, '---AGENDA_TABLE---', '---DISCUSSION---')
        .filter(l => l.includes('|') && !l.includes('หัวข้อ') && !l.includes('Topic'));

    const discLines = extractSection(result, '---DISCUSSION---', '---END---');

    let agendaSummary = metadata?.agenda || agendaLines
        .map(l => l.split('|').slice(1).join('|').trim())
        .join('  |  ');

    // ── Header: logo ─────────────────────────────────────────
    let headerChildren;
    if (fs.existsSync(config.paths.logo)) {
        const logoData = fs.readFileSync(config.paths.logo);
        headerChildren = [
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children:  [new ImageRun({ data: logoData, transformation: { width: 108, height: 42 } })],
            }),
        ];
    } else {
        headerChildren = [new Paragraph({ children: [new TextRun('')] })];
    }

    // ── Table 1: Meeting Info ─────────────────────────────────
    const COL_W = [3, 5.5, 3, 5.5];

    function makeInfoRow(l1, v1, l2, v2) {
        return new TableRow({
            children: [
                makeCell(l1, true, 'D9D9D9', null, COL_W[0]),
                makeCell(v1, true, null,     null, COL_W[1]),
                makeCell(l2, true, 'D9D9D9', null, COL_W[2]),
                makeCell(v2, true, null,     null, COL_W[3]),
            ],
        });
    }

    const mergedRow = (label, value) => new TableRow({
        children: [
            makeCell(label, true, 'D9D9D9', null, COL_W[0]),
            new TableCell({
                children: [makeParagraph(value, true)],
                borders:  makeBorders(),
                columnSpan: 3,
            }),
        ],
    });

    const table1 = new Table({
        rows: [
            makeInfoRow('การประชุม', meetingName, 'วันที่ประชุม', meetingDate),
            makeInfoRow('สถานที่',   location,    'ระยะเวลา',     duration),
            mergedRow('ผู้เข้าร่วมการประชุม', participants),
            mergedRow('วาระการประชุม',        agendaSummary),
        ],
        width: { size: cmToTwips(FULL_CM), type: WidthType.DXA },
    });

    // ── Table 2: Discussion ───────────────────────────────────
    const discussionRows = [
        new TableRow({
            children: [
                new TableCell({
                    children: [makeParagraph('ประเด็นที่หารือในที่ประชุม', true)],
                    borders:  makeBorders(),
                    shading:  { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' },
                }),
            ],
        }),
    ];

    let inAction = false;
    let actionBuf = [];
    let currentCell = null; // { children: [], bg: string|null }

    const flushCell = () => {
        if (!currentCell) return;
        discussionRows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: currentCell.children,
                        borders:  makeBorders(),
                        shading:  currentCell.bg
                            ? { type: ShadingType.CLEAR, color: 'auto', fill: currentCell.bg }
                            : undefined,
                    }),
                ],
            })
        );
        currentCell = null;
    };

    const startCell = (text, bold = true, bg = null) => {
        flushCell();
        currentCell = { children: [makeParagraph(text, bold)], bg };
    };

    const addToCell = (text, bold = false) => {
        if (!currentCell) startCell(text, bold);
        else currentCell.children.push(makeParagraph(text, bold));
    };

    for (const line of discLines) {
        const s = line.trim();
        if (!s) continue;

        if (s.includes('[ACTION]'))  { inAction = true; actionBuf = []; continue; }
        if (s.includes('[/ACTION]')) {
            inAction = false;
            if (actionBuf.length > 0) {
                addToCell('📌 Action Items:', true);
                actionBuf.forEach(ab => addToCell(`  ${ab}`, false));
            }
            actionBuf = [];
            continue;
        }
        if (inAction) { actionBuf.push(s); continue; }

        if      (s.startsWith('## '))  startCell(s.slice(3), true, 'EBF3FB');
        else if (s.startsWith('### ')) startCell(s.slice(4), true, 'F5F5F5');
        else if (s.startsWith('- '))   addToCell(`• ${s.slice(2)}`, false);
        else                           addToCell(s, s.startsWith('ข้อสรุป') || s.startsWith('Meeting Conclusions'));
    }
    flushCell();

    const table2 = new Table({
        rows:  discussionRows,
        width: { size: cmToTwips(FULL_CM), type: WidthType.DXA },
    });

    // ── Assemble Document ─────────────────────────────────────
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size:   { width: cmToTwips(21), height: cmToTwips(29.7) },
                    margin: { top: cmToTwips(2), right: cmToTwips(2), bottom: cmToTwips(2), left: cmToTwips(2) },
                },
            },
            headers: { default: new Header({ children: headerChildren }) },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing:   { after: 120 },
                    children:  [makeTextRun(`เอกสารสรุปการประชุม — ${meetingName}`, true, 14)],
                }),
                table1,
                new Paragraph({ spacing: { after: 80 } }),
                table2,
                new Paragraph({ spacing: { after: 80 } }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children:  [makeTextRun('--- ปิดการประชุม / Meeting Adjourned ---', true, 10)],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children:  [makeTextRun('บันทึกโดย: PMO Analyst | จัดทำจาก Meeting Transcript', false, 9)],
                }),
            ],
        }],
    });

    return Packer.toBuffer(doc);
}
