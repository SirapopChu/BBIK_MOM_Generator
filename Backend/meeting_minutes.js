// ✅ Cell 3: Generate Meeting Minutes
import Anthropic from '@anthropic-ai/sdk';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, ImageRun, Header } from 'docx';
import fs from 'fs';
import path from 'path';

const API_KEY = 'MY_API_KEY';

const SYSTEM_PROMPT = `You are a Senior PMO Analyst. Create bilingual (Thai/English) meeting minutes matching this exact template structure.

INSTRUCTIONS:
1. Extract: meeting name, location, date/time, duration, participants.
2. ALL content must be bilingual: Thai / English on same line.
3. Organize agenda items and subtopics sequentially.
4. Summarize & details topic by topic professionally, do NOT copy verbatim.
5. Mark missing info as 'ไม่ระบุ'.
6. For Action Items use EXACTLY this block format:
   [ACTION]
   Action: <Thai> / <English>
   Responsible: <names>
   Timeline: <Thai> / <English>
   [/ACTION]
7. use professional language style

OUTPUT STRUCTURE (follow exactly):
---HEADER---
รายงานการประชุม / Meeting Minutes
[Meeting Name Thai] / [Meeting Name English]

---INFO_TABLE---
ชื่อการประชุม / Meeting Name | [value]
สถานที่ / Location | [value]
วันที่และเวลา / Date & Time | [value]
ระยะเวลา / Duration | [value]
ผู้เข้าร่วม / Participants | [name1 (role)], [name2], ...

---AGENDA_TABLE---
วาระที่ / No. | หัวข้อ / Topic
1 | [Thai] / [English]
2 | [Thai] / [English]

---DISCUSSION---
## วาระที่ 1 - [Thai title] / [English title]
### วาระที่ 1.1 - [Thai subtitle] / [English subtitle]
[bilingual summary]
- [Thai bullet] / [English bullet]

ข้อสรุปจากที่ประชุม / Meeting Conclusions
- [Thai] / [English]

[ACTION]
Action: Thai / English
Responsible: Name
Timeline: Thai / English
[/ACTION]

---END---
--- ปิดการประชุม / Meeting Adjourned ---
บันทึกโดย: PMO Analyst | จัดทำจาก Meeting Transcript`;

const FONT = 'TH Sarabun New';
const FONT_SIZE = 10;
const FULL_CM = 17;

// ── Helpers ───────────────────────────────────────────────────────
function cmToTwips(cm) {
    return Math.round(cm * 567);
}

function ptToHalfPt(pt) {
    return pt * 2;
}

function makeBorders() {
    return {
        top:    { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left:   { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right:  { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    };
}

function makeTextRun(text, bold = true, size = null) {
    return new TextRun({
        text,
        bold,
        size: ptToHalfPt(size !== null ? size : FONT_SIZE),
        font: FONT,
    });
}

function makeCellParagraph(text, bold = true, size = null) {
    return new Paragraph({
        children: [makeTextRun(text, bold, size)],
        spacing: { after: 40 },
    });
}

function makeAdditionalParagraph(text, bold = false, size = null) {
    return new Paragraph({
        children: [makeTextRun(text, bold, size)],
        spacing: { after: 40 },
    });
}

function makeCell(text, bold = true, bg = null, size = null, width = null) {
    const cellOptions = {
        children: [makeCellParagraph(text, bold, size)],
        borders: makeBorders(),
    };
    if (bg) {
        cellOptions.shading = { type: ShadingType.CLEAR, color: 'auto', fill: bg };
    }
    if (width) {
        cellOptions.width = { size: cmToTwips(width), type: WidthType.DXA };
    }
    return new TableCell(cellOptions);
}

// ── Extract helpers ───────────────────────────────────────────────
function extractInfo(result, field) {
    for (const line of result.split('\n')) {
        if (line.includes('|') && line.toLowerCase().includes(field.toLowerCase())) {
            const parts = line.split('|');
            if (parts.length >= 2) return parts[1].trim();
        }
    }
    return 'ไม่ระบุ';
}

function extractAgendaLines(result) {
    const lines = [];
    let active = false;
    for (const line of result.split('\n')) {
        if (line.includes('---AGENDA_TABLE---')) { active = true; continue; }
        if (active && line.startsWith('---')) break;
        if (active && line.includes('|')) lines.push(line);
    }
    return lines;
}

function extractDiscussion(result) {
    const lines = [];
    let active = false;
    for (const line of result.split('\n')) {
        if (line.includes('---DISCUSSION---')) { active = true; continue; }
        if (line.includes('---END---')) break;
        if (active) lines.push(line);
    }
    return lines;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
    // NOTE: This script expects a transcript .txt file as the first argument.
    // e.g. node meeting_minutes.js transcript.txt
    const transcriptPath = process.argv[2] || 'transcript.txt';
    const filename = path.basename(transcriptPath);
    let transcript = '';

    if (fs.existsSync(transcriptPath)) {
        transcript = fs.readFileSync(transcriptPath, 'utf8');
    }

    if (!transcript.trim()) {
        console.error('Error: transcript is empty or missing. Provide a valid .txt file as the first argument.');
        process.exit(1);
    }

    console.log('🤖 Claude กำลังวิเคราะห์ transcript...');
    console.log('⏳ กรุณารอสักครู่...');

    const client = new Anthropic({ apiKey: API_KEY });

    const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
            { role: 'user', content: transcript }
        ],
    });

    const result = message.content[0].text;

    console.log('='.repeat(60));
    console.log(result);
    console.log('='.repeat(60));
    console.log(`✅ สำเร็จ! ใช้ ${message.usage.input_tokens} input tokens, ${message.usage.output_tokens} output tokens`);

    // ── Parse data ────────────────────────────────────────────────────
    const meetingName  = extractInfo(result, 'Meeting Name');
    const meetingDate  = extractInfo(result, 'Date');
    const location     = extractInfo(result, 'Location');
    const duration     = extractInfo(result, 'Duration');
    const participants = extractInfo(result, 'Participants');
    const agendaLines  = extractAgendaLines(result);
    const discLines    = extractDiscussion(result);

    // ── HEADER: logo ──────────────────────────────────────────────────
    const path = require('path');
    const LOGO_PATH = path.join(__dirname,'Bluebik_Logo_2025_Horizontal_Primary_Logo_Black.png'); // ← แก้ path ตรงนี้
    let headerChildren = [];
    if (fs.existsSync(LOGO_PATH)) {
        const logoData = fs.readFileSync(LOGO_PATH);
        headerChildren = [
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new ImageRun({
                        data: logoData,
                        transformation: { width: 108, height: 42 }, // ~1.13 x 0.44 inches in pt (approx)
                    }),
                ],
            }),
        ];
    } else {
        headerChildren = [new Paragraph({ children: [new TextRun('')] })];
    }

    // ── TABLE 1: Meeting Info ─────────────────────────────────────────
    const COL_W = [3, 5.5, 3, 5.5];

    function makeInfoRow(label1, val1, label2, val2) {
        return new TableRow({
            children: [
                makeCell(label1, true, 'D9D9D9', null, COL_W[0]),
                makeCell(val1,   true, null,     null, COL_W[1]),
                makeCell(label2, true, 'D9D9D9', null, COL_W[2]),
                makeCell(val2,   true, null,     null, COL_W[3]),
            ],
        });
    }

    const agendaSummary = agendaLines
        .filter(line => line.includes('|') && !line.includes('หัวข้อ') && !line.includes('Topic'))
        .map(line => line.split('|').slice(1).join('|').trim())
        .join('  |  ');

    // Row 2: ผู้เข้าร่วม (merged)
    const row2 = new TableRow({
        children: [
            makeCell('ผู้เข้าร่วมการประชุม', true, 'D9D9D9', null, COL_W[0]),
            new TableCell({
                children: [makeCellParagraph(participants, true)],
                borders: makeBorders(),
                columnSpan: 3,
            }),
        ],
    });

    // Row 3: วาระ (merged)
    const row3 = new TableRow({
        children: [
            makeCell('วาระการประชุม', true, 'D9D9D9', null, COL_W[0]),
            new TableCell({
                children: [makeCellParagraph(agendaSummary, true)],
                borders: makeBorders(),
                columnSpan: 3,
            }),
        ],
    });

    const table1 = new Table({
        rows: [
            makeInfoRow('การประชุม', meetingName, 'วันที่ประชุม', meetingDate),
            makeInfoRow('สถานที่',   location,    'ระยะเวลา',     duration),
            row2,
            row3,
        ],
        width: { size: cmToTwips(FULL_CM), type: WidthType.DXA },
    });

    // ── TABLE 2: Discussion ───────────────────────────────────────────
    const discussionRows = [
        new TableRow({
            children: [
                new TableCell({
                    children: [makeCellParagraph('ประเด็นที่หารือในที่ประชุม', true)],
                    borders: makeBorders(),
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' },
                }),
            ],
        }),
    ];

    let inAction   = false;
    let actionBuf  = [];
    let currentCellParagraphs = null;

    function flushCurrentCell() {
        if (currentCellParagraphs !== null) {
            discussionRows.push(
                new TableRow({
                    children: [
                        new TableCell({
                            children: currentCellParagraphs.children,
                            borders: makeBorders(),
                            shading: currentCellParagraphs.bg
                                ? { type: ShadingType.CLEAR, color: 'auto', fill: currentCellParagraphs.bg }
                                : undefined,
                        }),
                    ],
                })
            );
            currentCellParagraphs = null;
        }
    }

    function startBodyRow(text, bold = true, bg = null) {
        flushCurrentCell();
        currentCellParagraphs = {
            children: [makeCellParagraph(text, bold)],
            bg,
        };
    }

    function addToCurrentCell(text, bold = false) {
        if (currentCellParagraphs !== null) {
            currentCellParagraphs.children.push(makeAdditionalParagraph(text, bold));
        } else {
            startBodyRow(text, bold);
        }
    }

    for (const line of discLines) {
        const s = line.trim();
        if (!s) continue;

        if (s.includes('[ACTION]')) {
            inAction = true; actionBuf = []; continue;
        }

        if (s.includes('[/ACTION]')) {
            inAction = false;
            if (actionBuf.length > 0 && currentCellParagraphs !== null) {
                addToCurrentCell('📌 Action Items:', true);
                for (const ab of actionBuf) {
                    addToCurrentCell(`  ${ab}`, false);
                }
            }
            actionBuf = [];
            continue;
        }

        if (inAction) {
            actionBuf.push(s); continue;
        }

        if (s.startsWith('## ')) {
            startBodyRow(s.slice(3), true, 'EBF3FB');
        } else if (s.startsWith('### ')) {
            startBodyRow(s.slice(4), true, 'F5F5F5');
        } else if (s.startsWith('- ')) {
            addToCurrentCell(`• ${s.slice(2)}`, false);
        } else if (s.startsWith('ข้อสรุปจากที่ประชุม') || s.startsWith('Meeting Conclusions')) {
            addToCurrentCell(s, true);
        } else {
            addToCurrentCell(s, false);
        }
    }
    flushCurrentCell();

    const table2 = new Table({
        rows: discussionRows,
        width: { size: cmToTwips(FULL_CM), type: WidthType.DXA },
    });

    // ── Build Document ────────────────────────────────────────────────
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        size: { width: cmToTwips(21), height: cmToTwips(29.7) },
                        margin: { top: cmToTwips(2), right: cmToTwips(2), bottom: cmToTwips(2), left: cmToTwips(2) },
                    },
                },
                headers: {
                    default: new Header({ children: headerChildren }),
                },
                children: [
                    // Title
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 120 },
                        children: [
                            new TextRun({
                                text: `เอกสารสรุปการประชุม — ${meetingName}`,
                                bold: true,
                                size: ptToHalfPt(14),
                                font: FONT,
                            }),
                        ],
                    }),
                    // Table 1
                    table1,
                    // Spacer
                    new Paragraph({ spacing: { after: 80 } }),
                    // Table 2
                    table2,
                    // Footer
                    new Paragraph({ spacing: { after: 80 } }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [makeTextRun('--- ปิดการประชุม / Meeting Adjourned ---', true, 10)],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [makeTextRun('บันทึกโดย: PMO Analyst | จัดทำจาก Meeting Transcript', false, 9)],
                    }),
                ],
            },
        ],
    });

    // ── Save File ─────────────────────────────────────────────────────
    const outputFilename = filename.replace('.txt', '_meeting_minutes.docx');
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputFilename, buffer);
    console.log(`✅ ดาวน์โหลดไฟล์ ${outputFilename} สำเร็จ!`);
}

main().catch(console.error);
