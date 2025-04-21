const OPENROUTER_API_KEY = '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';
const AI_MODEL = 'deepseek/deepseek-r1-zero:free';

class AttackGenerator {
    generateAttackName(prompt) {
        return 'sans_' + prompt.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);
    }

    async generateAttack(prompt) {
        // --- REVISED SYSTEM PROMPT (Style Emulation) ---
        const systemPrompt = `You are a precise battle pattern generator for the Sans Fight simulator.\\nYour task is to translate a user\\'s description of an attack pattern into a sequence of commands in CSV format.\\nThe goal is to create challenging but fair attack patterns that feel like they belong in the original Sans fight.\\nDO NOT include ANY explanations, comments, code blocks, markdown formatting, headers, or any text other than the command lines.\\nThe output MUST be ONLY lines in the format: [delay],[command],[param1],[param2],...\\n\\n## Game Context ##\\n-   **Environment**: 640x480 window. Player controls a heart SOUL.\\n-   **Combat Zone**: Typically X:[133, 508], Y:[251, 391]. Attacks originate outside and move in.\\n-   **Player Start**: (320, 376).\\n-   **Heart Modes**: 0=Red (free move), 1=Blue (gravity, needs HeartMaxFallSpeed=750).\\n\\n## Output Format ##\\nFormat: delay,command,param1,param2,...\\n\\n## Mandatory Setup and Teardown ##\\nStart with these exact lines at delay 0:\\n0,CombatZoneResize,133,251,508,391,TLResume\\n0,HeartTeleport,320,376\\n0,TLPause\\nAlso include an initial heart mode setting at delay 0 (usually Red Mode):\\n0,SET,Mode,0\\n0,HeartMode,0\\nEnd with a single \\'EndAttack\\' command. Its delay determines the total attack duration and must be >= 0.5s after the last action completes.\\nExample: [final_delay],EndAttack,,\\n\\n## Allowed Commands & Parameters (USE ONLY THESE) ##\\n\\n1.  **CombatZoneResize**: \\\`delay,CombatZoneResize,left,top,right,bottom,resumeBehavior\\\` (Use ONCE at start: \\\`0,CombatZoneResize,133,251,508,391,TLResume\\\`)\\n2.  **HeartTeleport**: \\\`delay,HeartTeleport,x,y\\\` (Use ONCE at start: \\\`0,HeartTeleport,320,376\\\`)\\n3.  **TLPause / TLResume**: \\\`delay,TLPause\\\` or \\\`delay,TLResume\\\` (Use TLPause ONCE at start: \\\`0,TLPause\\\`)\\n4.  **SET Mode**: \\\`delay,SET,Mode,value\\\` (0=Red, 1=Blue)\\n5.  **HeartMode**: \\\`delay,HeartMode,mode\\\` (0=Red, 1=Blue - Use WITH SET Mode)\\n6.  **SET HeartMaxFallSpeed**: \\\`delay,SET,HeartMaxFallSpeed,speed\\\` (Use 750 when SET Mode=1)\\n7.  **BoneH**: \\\`delay,BoneH,x,y,width,direction,speed,color\\\` (width:20-150, dir:0/2, speed:100-400, color:0/1)\\n8.  **BoneV**: \\\`delay,BoneV,x,y,height,direction,speed,color\\\` (height:20-150, dir:1/3, speed:100-400, color:0/1)\\n9.  **GasterBlaster**: \\\`delay,GasterBlaster,size,startX,startY,endX,endY,angle,spinTime,blastTime\\\` (size:1, angle:0-360, spin:0.2-0.5, blast:0.5-2.0)\\n10. **Platform**: \\\`delay,Platform,x,y,width,direction,speed,reverse\\\` (width:40-120, dir:0-3, speed:50-200, rev:0/1 - Use only in Blue Mode)\\n11. **EndAttack**: \\\`delay,EndAttack,,\\\` (Use ONCE at the very end)\\n\\n## Pattern Generation Philosophy & Constraints ##\\n-   **Emulate Sans\\' Style**: Generate CSV sequences that *feel like* intense, challenging attacks from the original Sans fight. Think dense patterns, fast-moving objects (speed 200-400 for bones typical), overlapping attacks, precise dodging, and rhythmic combinations.\\n-   **Intensity & Density**: Default to high intensity. Generate a high density of attack elements. Minimize downtime. Patterns should be continuously active and demanding.\\n-   **Complexity & Overlap**: Combine different attack elements. Use overlapping patterns. Require quick reactions.\\n-   **Rhythm**: Incorporate rhythmic timing.\\n-   **STRICT Command Focus**: **ABSOLUTELY ONLY** use the 11 commands listed above. **DO NOT** use any other commands found in examples or documentation (NO scripting like JMP/RND/SET vars, NO repeats like BoneVRepeat, NO BoneStab, NO SansText, NO Sound, etc.).\\n-   **Fairness**: Patterns must be survivable. Avoid instant traps. Attacks originate outside the combat zone.\\n-   **Timing**: Ensure delays are logical. EndAttack delay must be after all actions complete (consider GasterBlaster\\'s spinTime+blastTime).\\n-   **Blue Mode**: Platforms are required for Blue Mode sections.\\n-   **Output Format**: Output ONLY the CSV lines. No extra text, headers, comments, markdown.\\n\\n## User Request ##\\nNow, generate the CSV command sequence for the following user request:\\n{prompt} <-- NOTE: Removed surrounding backticks and dollar sign\n\\n## CSV Output: ##\\n`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: [{ type: "text", text: `Generate CSV for: ${prompt}` }] }
        ];

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/einstein-coins/ai-sans', // Replace if needed
                    'X-Title': 'AI Sans Attack Generator' // Replace if needed
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: messages,
                    temperature: 0.6, // Adjust temperature as needed
                    max_tokens: 2500 // Reduced token limit as prompt is smaller now
                })
            });

            const data = await response.json();
            console.log("API Response Data:", JSON.stringify(data, null, 2)); // Log the full response
            if (!response.ok) throw new Error(`API error: ${data.error?.message || response.statusText || 'Unknown error'}`);

            let rawCsvContent = data.choices?.[0]?.message?.content;
            if (!rawCsvContent) throw new Error('Invalid API response format or empty content');

            // Clean potential markdown and trim whitespace
             rawCsvContent = rawCsvContent
                .replace(/^```(?:csv)?\s*/i, '') // Changed \\s* to \s*
                .replace(/```\s*$/, '')       // Changed \\s* to \s*
                .trim();                      // Trim whitespace

            if (!rawCsvContent || !rawCsvContent.includes(',')) {
                throw new Error('Generated content is not valid CSV data or is empty after cleaning.');
            }

            const attack = {
                heartModes: [],
                duration: 0,
                rawCsv: rawCsvContent
            };

            let maxDelay = 0;
            let foundEndAttack = false;
            const lines = rawCsvContent.split('\n');

            lines.forEach(line => {
                if (!line || line.trim().startsWith('//') || !line.includes(',')) return;
                const parts = line.split(',').map(s => s.trim());
                const delay = Number(parts[0]);
                const command = parts[1];

                if (isNaN(delay)) return;

                // Track max delay encountered before EndAttack
                if (command !== 'EndAttack') {
                   maxDelay = Math.max(maxDelay, delay);
                }

                try {
                     // Only parse HeartMode and EndAttack for basic info
                    if (command === 'HeartMode' && parts.length >= 3) {
                        const mode = Number(parts[2]);
                        if (!isNaN(mode)) {
                            attack.heartModes.push({ delay: delay, mode: mode === 1 ? 1 : 0 });
                        }
                    } else if (command === 'EndAttack') {
                        // Use the delay from the *first* EndAttack found
                        if (!foundEndAttack) {
                           attack.duration = delay;
                           foundEndAttack = true;
                        }
                    }
                } catch (parseError) {
                    console.warn(`Skipping malformed line during simplified parsing: "${line}" - Error: ${parseError.message}`);
                }
            });

            // Estimate duration if EndAttack wasn't found or had delay 0
            if (!foundEndAttack || attack.duration <= 0) {
                 const estimatedDuration = Math.max(maxDelay + 0.5, 3); // Ensure minimum duration
                 if (!foundEndAttack) {
                     console.warn("Generated CSV missing EndAttack, adding estimated one.");
                     attack.rawCsv += `\n${estimatedDuration},EndAttack,,,`;
                     attack.duration = estimatedDuration;
                 } else {
                    // Found EndAttack but it was at delay 0 or invalid
                    console.warn(`Found EndAttack at invalid delay ${attack.duration}, using estimated duration ${estimatedDuration}.`);
                    attack.duration = estimatedDuration;
                 }
            }

            attack.heartModes.sort((a, b) => a.delay - b.delay);

            return attack; // Return the object with rawCsv and basic parsed info
        } catch (e) {
            console.error("Error in generateAttack:", e);
            throw e; // Re-throw the error to be caught by the UI
        }
    }
}

document.body.innerHTML = `
<style>
    @font-face {
        font-family: 'Determination Mono';
        src: url('DTM-Mono.otf') format('opentype');
    }

    body {
        background: #000;
        color: #fff;
        font-family: 'Determination Mono', monospace;
        margin: 0;
        padding: 20px;
    }

    .container {
        max-width: 800px;
        margin: 20px auto;
    }

    h1 {
        text-align: center;
        font-size: 32px;
        margin-bottom: 30px;
    }

    textarea {
        width: 100%;
        height: 100px;
        background: #111;
        border: 2px solid #fff;
        color: #fff;
        font-family: 'Determination Mono', monospace;
        font-size: 16px;
        padding: 10px;
        margin: 10px 0;
        resize: vertical;
    }

    input[type="number"] {
        background: #111;
        border: 2px solid #fff;
        color: #fff;
        font-family: 'Determination Mono', monospace;
        font-size: 16px;
        padding: 5px;
        width: 80px;
    }

    button {
        background: #fff;
        color: #000;
        border: none;
        font-family: 'Determination Mono', monospace;
        font-size: 16px;
        padding: 10px 20px;
        cursor: pointer;
        transition: all 0.2s;
    }

    button:hover {
        background: #ddd;
        transform: scale(1.05);
    }

    button:disabled {
        background: #666;
        cursor: not-allowed;
        transform: none;
    }

    pre {
        background: #111;
        border: 2px solid #fff;
        padding: 20px;
        white-space: pre-wrap;
        font-family: 'Determination Mono', monospace;
        font-size: 14px;
        max-height: 300px;
        overflow-y: auto;
    }

    .error {
        color: #ff6666;
        margin-top: 10px;
        font-size: 16px;
    }

    .filename {
        font-family: 'Determination Mono', monospace;
        color: #ffff00;
        margin: 10px 0;
    }

    label {
        font-size: 16px;
    }

    .button-container {
        text-align: center;
        margin: 20px 0;
    }

    h3 {
        border-bottom: 2px solid #fff;
        padding-bottom: 5px;
    }
</style>

<div class="container">
    <h1>* Sans Attack Generator</h1>
    <p>* Enter a prompt to generate a custom attack pattern for the Bad Time Simulator.</p>
    <textarea id="prompt" placeholder="Example: A wave of bones that forms a heart shape, followed by gaster blasters in a spiral pattern"></textarea>
    <div>
        <label for="duration">* Duration (seconds, leave blank to let AI decide):</label>
        <input type="number" id="duration" min="1" max="30" step="0.5">
    </div>
    <div class="button-container">
        <button onclick="generateAttack()">* Generate Attack</button>
        <button id="downloadBtn" onclick="downloadAttack()" disabled>* Download Attack</button>
    </div>
    <div id="filename" class="filename"></div>
    <div>
        <h3>* Simplified JSON Output (Preview):</h3>
        <pre id="output"></pre>
        <h3>* Raw CSV Output (Generated by AI):</h3>
        <pre id="csvOutput"></pre>
    </div>
    <div id="error" class="error"></div>
</div>`;

const generator = new AttackGenerator();
let currentAttack = null;
let currentAttackName = '';

function downloadAttack() {
    if (!currentAttack || !currentAttack.rawCsv) return;
    const csvContent = currentAttack.rawCsv;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentAttackName + '.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

async function generateAttack() {
    const prompt = document.getElementById('prompt').value;
    const durationInput = document.getElementById('duration').value;
    const output = document.getElementById('output');
    const csvOutput = document.getElementById('csvOutput');
    const error = document.getElementById('error');
    const downloadBtn = document.getElementById('downloadBtn');
    const filenameDiv = document.getElementById('filename');

    output.textContent = 'Generating attack (this might take a moment due to the large prompt)...';
    csvOutput.textContent = '';
    error.textContent = '';
    downloadBtn.disabled = true;
    filenameDiv.textContent = '';

    try {
        const fullPrompt = durationInput
            ? `${prompt} (Aim for a duration of roughly ${durationInput} seconds)`
            : prompt;
        currentAttack = await generator.generateAttack(fullPrompt);

        if (currentAttack && currentAttack.rawCsv) {
            currentAttackName = generator.generateAttackName(prompt);
            output.textContent = JSON.stringify(currentAttack, (key, value) => key === 'rawCsv' ? undefined : value, 2);
            csvOutput.textContent = currentAttack.rawCsv;
            downloadBtn.disabled = false;
            filenameDiv.textContent = `Filename: ${currentAttackName}.csv`;

            if (durationInput) {
                 console.log(`User requested duration ~${durationInput}s. AI determined/estimated duration: ${currentAttack.duration}s.`);
            } else {
                 console.log(`AI determined/estimated duration: ${currentAttack.duration}s.`);
            }

        } else {
            throw new Error('Failed to generate valid attack pattern CSV');
        }
    } catch (e) {
        output.textContent = '';
        csvOutput.textContent = '';
        error.textContent = `Error generating attack: ${e.message}. Please check the console for details and try again. The AI might have generated invalid data or failed due to the large context.`;
        currentAttack = null;
        currentAttackName = '';
        console.error("generateAttack UI error:", e);
    }
}