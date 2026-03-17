import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';

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

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

/**
 * Sends the transcript to Claude and returns the raw structured response text.
 * @param {string} transcript
 * @returns {Promise<{ result: string, usage: object }>}
 */
export async function generateMinutesText(transcript) {
    const message = await client.messages.create({
        model:       config.anthropic.model,
        max_tokens:  6000,
        temperature: 0,
        system:      SYSTEM_PROMPT,
        messages:    [{ role: 'user', content: transcript }],
    });

    return {
        result: message.content[0].text,
        usage:  message.usage,
    };
}
