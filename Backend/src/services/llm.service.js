import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';

// ── System Prompt ─────────────────────────────────────────────────────────────
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

// ── LLM Config ────────────────────────────────────────────────────────────────
const MAX_TOKENS = 6000;
const CHUNK_SIZE = 25000; // ~5k tokens per chunk for safe processing

const AnthropicProvider = {
    _client: new Anthropic({ apiKey: config.anthropic.apiKey }),

    async generate(transcript, systemPrompt = SYSTEM_PROMPT, modelOverride = null) {
        const message = await this._client.messages.create({
            model:       modelOverride || config.anthropic.model,
            max_tokens:  MAX_TOKENS,
            temperature: 0,
            system:      systemPrompt,
            messages:    [{ role: 'user', content: transcript }],
        });
        return {
            result: message.content[0].text,
            usage:  message.usage,
        };
    },
};

const provider = AnthropicProvider;

/**
 * Sends the transcript to the configured LLM provider.
 * Automatically handles chunking for long transcripts.
 *
 * @param {string} transcript
 * @param {string|null} modelOverride
 * @returns {Promise<{ result: string, usage: object }>}
 */
export async function generateMinutesText(transcript, modelOverride = null) {
    let activeModel = modelOverride || config.anthropic.model;
    
    // Auto-map aliases to precise Anthropic model IDs
    if (activeModel === 'claude-sonnet-4-5' || activeModel === 'claude-4-5-sonnet') {
        activeModel = 'claude-sonnet-4-5-20250929';
    }

    // 1. If transcript is short, process directly
    if (transcript.length <= CHUNK_SIZE) {
        return provider.generate(transcript, SYSTEM_PROMPT, activeModel);
    }

    // 2. Multi-chunk Processing (Map-Reduce strategy)
    console.log(`[LLM] Long transcript detected (${transcript.length} chars). Using chunked processing with model ${activeModel}...`);
    
    // Split into chunks
    const chunks = [];
    for (let i = 0; i < transcript.length; i += CHUNK_SIZE) {
        chunks.push(transcript.substring(i, i + CHUNK_SIZE));
    }

    // Process Chunks (Map)
    const chunkSummaries = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const CHUNK_PROMPT = `You are a professional scribe. Summarize this segment of a meeting transcript in high detail. 
    Keep all important decisions, action items, and participants mentioned. 
    Use bilingual (Thai/English) for key points.`;

    for (let i = 0; i < chunks.length; i++) {
        console.log(`[LLM] Processing chunk ${i + 1}/${chunks.length}...`);
        const { result, usage } = await provider.generate(chunks[i], CHUNK_PROMPT, activeModel);
        chunkSummaries.push(`--- CHUNK ${i + 1} SUMMARY ---\n${result}`);
        totalInputTokens += usage.input_tokens;
        totalOutputTokens += usage.output_tokens;
    }

    // Synthesize Final Minutes (Reduce)
    console.log(`[LLM] Synthesizing final document from ${chunks.length} summaries...`);
    const finalInput = chunkSummaries.join('\n\n');
    const { result, usage } = await provider.generate(finalInput, SYSTEM_PROMPT, activeModel);

    return {
        result,
        usage: {
            input_tokens:  totalInputTokens + usage.input_tokens,
            output_tokens: totalOutputTokens + usage.output_tokens,
        }
    };
}
