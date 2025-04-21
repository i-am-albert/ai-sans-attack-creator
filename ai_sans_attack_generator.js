const OPENROUTER_API_KEY = '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';
const AI_MODEL = 'deepseek/deepseek-r1-zero:free';

class AttackGenerator {
    generateAttackName(prompt) {
        return 'sans_' + prompt.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);
    }

    convertToCSV(attack) {
        let lines = [];
        let delay = 0;

        lines.push("0,CombatZoneResize,133,251,508,391,TLResume");
        lines.push("0,HeartTeleport,320,376");
        lines.push("0,TLPause");
        
        if (attack.heartModes?.length > 0) {
            const sortedModes = [...attack.heartModes].sort((a, b) => a.delay - b.delay);
            const initialMode = sortedModes[0].mode;
            
            lines.push("0,SET,Mode," + initialMode);
            lines.push("0,HeartMode," + initialMode);
            if (initialMode === 1) {
                lines.push("0,SET,HeartMaxFallSpeed,750");
            }
            
            for (let i = 1; i < sortedModes.length; i++) {
                const mode = sortedModes[i];
                const delay = mode.delay;
                lines.push(`${delay},SET,Mode,${mode.mode}`);
                lines.push(`${delay},HeartMode,${mode.mode}`);
                if (mode.mode === 1) {
                    lines.push(`${delay},SET,HeartMaxFallSpeed,750`);
                }
            }
        } else {
            lines.push("0,SET,Mode,0");
            lines.push("0,HeartMode,0");
        }
        
        lines.push("0,TLResume");

        attack.bones?.forEach(bone => {
            const isHorizontal = bone.direction === "left" || bone.direction === "right";
            const dirMap = { right: 0, down: 1, left: 2, up: 3 };
            lines.push([
                bone.delay,
                isHorizontal ? "BoneH" : "BoneV",
                bone.x,
                bone.y,
                isHorizontal ? bone.width : bone.height,
                dirMap[bone.direction],
                bone.speed,
                bone.type === "blue" ? 1 : 0
            ].join(","));
            delay = Math.max(delay, bone.delay);
        });

        attack.blasters?.forEach(blaster => {
            lines.push([
                blaster.delay,
                "GasterBlaster",
                1,
                blaster.x,
                blaster.y,
                blaster.endX,
                blaster.endY,
                blaster.direction,
                blaster.spinTime || 0.3,
                blaster.duration
            ].join(","));
            delay = Math.max(delay, blaster.delay + blaster.duration);
        });

        attack.platforms?.forEach(platform => {
            lines.push([
                platform.delay,
                "Platform",
                platform.x,
                platform.y,
                platform.width,
                platform.movement.direction,
                platform.movement.speed,
                platform.movement.reverse ? 1 : 0
            ].join(","));
            delay = Math.max(delay, platform.delay);
        });

        lines.push([Math.max(delay + 0.5, attack.duration), "EndAttack", "", ""].join(","));
        return lines.join("\n");
    }

    async generateAttack(prompt) {
        const systemPrompt = `You are a precise battle pattern generator for the Sans Fight simulator.\nYour task is to translate a user\\'s description of an attack pattern into a series of commands in a specific CSV format.\nThe goal is to create challenging but fair attack patterns that feel like they belong in the Sans fight.\nDO NOT include ANY explanations, comments, code blocks, markdown formatting, headers, or any text other than the command lines.\nThe output MUST be ONLY lines in the format: [delay],[command],[param1],[param2],...\n\n## Game Context ##\n-   **Environment**: The game takes place in a 640x480 window. The player controls a heart SOUL.\n-   **Combat Zone**: Player movement is restricted to the Combat Zone, typically set to X:[133, 508], Y:[251, 391]. Attacks usually originate from outside this zone and move *into* it to hit the player.\n-   **Player Start**: The player\\'s heart initially appears at (320, 376).\n-   **Heart Modes**:\n    *   Mode 0 (Red): Free movement in any direction.\n    *   Mode 1 (Blue): Affected by gravity (falling downwards unless jumping or on a platform). Jumping is possible. Requires \\\`HeartMaxFallSpeed\\\` to be set (usually 750).\n-   **Attack Elements**:\n    *   **Bones**: Obstacles the player must dodge. White bones hurt always. Blue bones only hurt if the player SOUL is moving. They should be placed to create dodgeable patterns (waves, walls with gaps, etc.). Spawning directly on the player start position is unfair.\n    *   **Gaster Blasters**: High-damage beams. They have a wind-up (spinTime) where they move into position and aim, telegraphing the attack, followed by the actual blast (blastTime). Give the player time to react during spinTime.\n    *   **Platforms**: ONLY used in Blue Mode (Mode 1). The player must land on them to avoid falling. They can be stationary or moving. Place them logically so the player can jump between them or use them to avoid ground-level attacks.\n\n## Output Format ##\nEach line represents a command executed at a specific delay (in seconds) from the start of the attack.\nFormat: delay,command,param1,param2,...\n\n## Mandatory Setup and Teardown ##\nEvery attack MUST start with these exact lines at delay 0:\n0,CombatZoneResize,133,251,508,391,TLResume\n0,HeartTeleport,320,376\n0,TLPause\n\nEvery attack MUST include an initial heart mode setting at delay 0. Usually starts with Red Mode:\n0,SET,Mode,0\n0,HeartMode,0\n\nEvery attack MUST end with a single \'EndAttack\' command. The delay for EndAttack determines the total attack duration and should be at least 0.5 seconds after the last action\\'s completion time (e.g., after a blaster finishes firing).\nExample: [final_delay],EndAttack,,\n\n## Allowed Commands and Parameters ##\n\n1.  **CombatZoneResize**: Resizes the playable area. (Used ONCE at the start)\n    *   Format: \\\`delay,CombatZoneResize,left,top,right,bottom,resumeBehavior\\\`\n    *   Example: \\\`0,CombatZoneResize,133,251,508,391,TLResume\\\` (Standard size)\n\n2.  **HeartTeleport**: Instantly moves the player\\'s heart. (Used ONCE at the start)\n    *   Format: \\\`delay,HeartTeleport,x,y\\\`\n    *   Example: \\\`0,HeartTeleport,320,376\\\` (Center of standard box)\n\n3.  **TLPause / TLResume**: Pauses/Resumes the attack timeline. (Used ONCE at the start)\n    *   Format: \\\`delay,TLPause\\\` or \\\`delay,TLResume\\\`\n    *   Example: \\\`0,TLPause\\\`\n\n4.  **SET**: Sets internal variables. Used for \'Mode\' and \'HeartMaxFallSpeed\'.\n    *   Format: \\\`delay,SET,VariableName,value\\\`\n    *   Examples: \\\`2.5,SET,Mode,1\\\` (Switch to Blue Mode), \\\`2.5,SET,HeartMaxFallSpeed,750\\\` (Set gravity for Blue Mode)\n\n5.  **HeartMode**: Changes player behavior. MUST be used with \\\`SET,Mode\\\`.\n    *   Format: \\\`delay,HeartMode,mode\\\` (0=Red, 1=Blue)\n    *   Example: \\\`2.5,HeartMode,1\\\` (Switch to Blue Mode)\n\n6.  **HeartMaxFallSpeed**: Sets fall speed for Blue Mode. MUST be set when using \\\`SET,Mode,1\\\`.\n    *   Format: \\\`delay,SET,HeartMaxFallSpeed,speed\\\` (Usually 750)\n    *   Example: \\\`2.5,SET,HeartMaxFallSpeed,750\\\`\n\n7.  **BoneH**: Single horizontal bone obstacle.\n    *   Format: \\\`delay,BoneH,x,y,width,direction,speed,color\\\`\n    *   x, y: Origin (top-left). Often starts off-screen (e.g., x<133 or x>508).\n    *   width: Length (20-150).\n    *   direction: 0=Right, 2=Left.\n    *   speed: (100-400).\n    *   color: 0=White, 1=Blue.\n    *   Example: \\\`1.0,BoneH,0,300,100,0,200,0\\\` (White bone enters from left edge)\n\n8.  **BoneV**: Single vertical bone obstacle.\n    *   Format: \\\`delay,BoneV,x,y,height,direction,speed,color\\\`\n    *   x, y: Origin (top-left). Often starts off-screen (e.g., y<251 or y>391).\n    *   height: Length (20-150).\n    *   direction: 1=Down, 3=Up.\n    *   speed: (100-400).\n    *   color: 0=White, 1=Blue.\n    *   Example: \\\`1.5,BoneV,300,480,100,3,250,1\\\` (Blue bone enters from bottom edge)\n\n9.  **GasterBlaster**: Telegraphed beam attack.\n    *   Format: \\\`delay,GasterBlaster,size,startX,startY,endX,endY,angle,spinTime,blastTime\\\`\n    *   size: Always 1.\n    *   startX, startY: Initial appearance position (can be off-screen).\n    *   endX, endY: Position where blaster aims FROM before firing.\n    *   angle: Aiming direction (0=right, 90=down, etc.).\n    *   spinTime: Aiming/wind-up time (0.2-0.5s). Player needs this time to react.\n    *   blastTime: Beam duration (0.5-2.0s). Blaster disappears after this. Total active time = spinTime + blastTime.\n    *   Example: \\\`3.0,GasterBlaster,1,100,100,200,300,90,0.3,1.0\\\`\n\n10. **Platform**: Platform for Blue Mode.\n    *   Format: \\\`delay,Platform,x,y,width,direction,speed,reverse\\\`\n    *   x, y: Initial position. MUST be reachable within the combat zone (X: 133-508, Y: 251-391). Don\\'t place platforms the player can\\'t possibly jump to.\n    *   width: (40-120).\n    *   direction: Movement (0=R, 1=D, 2=L, 3=U). Use 0 speed for stationary.\n    *   speed: (50-200).\n    *   reverse: 0=No, 1=Yes (Bounce off walls).\n    *   Example: \\\`4.0,Platform,200,350,80,0,0,0\\\` (Stationary platform)\n\n## Pattern Generation Philosophy & Constraints ##\n-   **Emulate Sans' Style**: Your primary goal is to generate CSV sequences that *feel like* intense, challenging attacks from the original Sans fight. Think dense patterns, fast-moving objects, overlapping attacks, required precise dodging, and rhythmic combinations.\n-   **Intensity & Density**: Generate a high density of attack elements (`BoneH`, `BoneV`, `GasterBlaster`, `Platform`). Minimize downtime. Patterns should be continuously active and demanding.\n-   **Complexity & Overlap**: Combine different attack elements within the same timeframe. Use overlapping patterns and require quick reactions. Create sequences that flow together cohesively but challenge the player.\n-   **Rhythm**: Incorporate rhythmic timing into the placement and movement of objects.\n-   **Allowed Commands ONLY**: **Strictly adhere** to using ONLY the commands listed in the 'Allowed Commands and Parameters' section (`CombatZoneResize`, `HeartTeleport`, `TLPause`/`TLResume`, `SET Mode`, `HeartMode`, `SET HeartMaxFallSpeed`, `BoneH`, `BoneV`, `GasterBlaster`, `Platform`, `EndAttack`). **DO NOT** use any other commands, especially no scripting (`JMP`, `RND`, `SET` for variables other than Mode/FallSpeed, `SUB`, etc.), repeated commands (`BoneVRepeat`), `SansText`, `BoneStab`, `Sound`, or any unlisted command.\n-   **Fairness**: While aiming for high difficulty, ensure patterns are technically possible to survive with skilled play. Avoid instant unavoidable traps.\n-   **Timing**: Ensure delays are logical. An action\\\'s effective duration matters (e.g., GasterBlaster lasts \\\`spinTime + blastTime\\\`). \\\`EndAttack\\\` delay MUST be after the completion of ALL actions.\n-   **Blue Mode**: Platforms are essential. Make sure they are present and usable when Mode=1. Remember \\\`SET,HeartMaxFallSpeed,750\\\` when switching to Blue Mode.\n-   **ABSOLUTE STRICTNESS**: Output ONLY the CSV lines. No introductory text, no headers, no comments, no explanations, no markdown, no code blocks. Just the raw \\\`delay,command,params...\\\` lines.\n\n## User Request ##\nNow, generate the CSV command sequence for the following user request:\n\\\`${prompt}\\\`\n\n## CSV Output: ##\n`;

        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: [
                    {
                      type: "text",
                      text: `Create an attack pattern based on this description: ${prompt}`
                    }
                ]
            }
        ];

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/einstein-coins/ai-sans',
                    'X-Title': 'AI Sans Attack Generator'
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: messages,
                    temperature: 0.6,
                    max_tokens: 2500
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(`API error: ${data.error?.message || response.statusText || 'Unknown error'}`);
            if (!data.choices?.[0]?.message?.content) throw new Error('Invalid API response format or empty content');

            const rawCsvContent = data.choices[0].message.content.trim();
            if (!rawCsvContent || !rawCsvContent.includes(',')) {
                throw new Error('Generated content is not valid CSV data.');
            }

            const attack = {
                heartModes: [],
                bones: [],
                blasters: [],
                platforms: [],
                duration: 0,
                difficulty: 5,
                rawCsv: rawCsvContent
            };

            let maxDelay = 0;
            const lines = rawCsvContent.split('\n');

            lines.forEach(line => {
                if (!line || line.trim().startsWith('//') || !line.includes(',')) return;
                const parts = line.split(',').map(s => s.trim());
                const delay = Number(parts[0]);
                const command = parts[1];

                if (isNaN(delay)) return;

                maxDelay = Math.max(maxDelay, delay);

                try {
                    switch (command) {
                        case 'HeartMode':
                            if (parts.length >= 3) {
                                const mode = Number(parts[2]);
                                if (!isNaN(mode)) {
                                    attack.heartModes.push({ delay: delay, mode: mode === 1 ? 1 : 0 });
                                }
                            }
                            break;
                        case 'BoneH':
                            if (parts.length >= 8) {
                                const [_, _cmd, x, y, width, direction, speed, color] = parts;
                                attack.bones.push({
                                    type: Number(color) === 1 ? "blue" : "white",
                                    x: Number(x),
                                    y: Number(y),
                                    width: Number(width),
                                    height: 20,
                                    speed: Number(speed),
                                    direction: Number(direction) === 0 ? "right" : "left",
                                    delay: delay
                                });
                                maxDelay = Math.max(maxDelay, delay);
                            }
                            break;
                        case 'BoneV':
                             if (parts.length >= 8) {
                                const [_, _cmd, x, y, height, direction, speed, color] = parts;
                                attack.bones.push({
                                    type: Number(color) === 1 ? "blue" : "white",
                                    x: Number(x),
                                    y: Number(y),
                                    width: 20,
                                    height: Number(height),
                                    speed: Number(speed),
                                    direction: Number(direction) === 1 ? "down" : "up",
                                    delay: delay
                                });
                                maxDelay = Math.max(maxDelay, delay);
                            }
                            break;
                        case 'GasterBlaster':
                             if (parts.length >= 10) {
                                const [_, _cmd, size, startX, startY, endX, endY, angle, spinTime, blastTime] = parts;
                                const blasterDelay = delay;
                                const blasterSpin = Number(spinTime);
                                const blasterBlast = Number(blastTime);
                                attack.blasters.push({
                                    x: Number(startX),
                                    y: Number(startY),
                                    endX: Number(endX),
                                    endY: Number(endY),
                                    direction: Number(angle),
                                    spinTime: blasterSpin,
                                    duration: blasterBlast,
                                    delay: blasterDelay
                                });
                                maxDelay = Math.max(maxDelay, blasterDelay + blasterSpin + blasterBlast);
                            }
                            break;
                        case 'Platform':
                            if (parts.length >= 8) {
                                const [_, _cmd, x, y, width, direction, speed, reverse] = parts;
                                attack.platforms.push({
                                    x: Number(x),
                                    y: Number(y),
                                    width: Number(width),
                                    height: 20,
                                    movement: {
                                        direction: Number(direction),
                                        speed: Number(speed),
                                        reverse: Number(reverse) === 1
                                    },
                                    delay: delay
                                });
                                maxDelay = Math.max(maxDelay, delay);
                            }
                            break;
                        case 'EndAttack':
                            attack.duration = delay;
                            break;
                    }
                } catch (parseError) {
                    console.warn(`Skipping malformed line during parsing: "${line}" - Error: ${parseError.message}`);
                }
            });

            if (attack.duration <= 0) {
                 attack.duration = Math.max(maxDelay + 0.5, 3);
                 if (!rawCsvContent.includes('EndAttack')) {
                    attack.rawCsv += `\n${attack.duration},EndAttack,,`;
                 }
            }

            attack.heartModes.sort((a, b) => a.delay - b.delay);

            return attack;
        } catch (e) {
            console.error("Error in generateAttack:", e);
            throw e;
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
        <h3>* JSON Output:</h3>
        <pre id="output"></pre>
        <h3>* CSV Preview:</h3>
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
    
    output.textContent = 'Generating attack...';
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
                 console.log(`User specified duration ${durationInput}s. AI generated duration (EndAttack): ${currentAttack.duration}s.`);
            }

        } else {
            throw new Error('Failed to generate valid attack pattern CSV');
        }
    } catch (e) {
        output.textContent = '';
        csvOutput.textContent = '';
        error.textContent = `Error generating attack: ${e.message}. Please check the console for details and try again. The AI might have generated invalid data.`;
        currentAttack = null;
        currentAttackName = '';
        console.error("generateAttack UI error:", e);
    }
}