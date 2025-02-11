const OPENROUTER_API_KEY = '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';
const AI_MODEL = 'google/gemini-2.0-pro-exp-02-05:free';

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
        const messages = [{
            role: "system",
            content: `You are a battle pattern generator for the Sans Fight simulator. Generate patterns in this EXACT format with NO deviations:

DURATION: [number]
DIFFICULTY: [number]

HEART_MODES:
0.0,SET,Mode,1
0.0,HeartMode,1
0.0,SET,HeartMaxFallSpeed,750
[delay],SET,Mode,[mode]
[delay],HeartMode,[mode]
[delay],SET,HeartMaxFallSpeed,750 (only when mode=1)

BONES:
[x],[y],[type],[direction],[speed],[size],[delay]

BLASTERS:
[size],[startX],[startY],[endX],[endY],[angle],[spinTime],[blastTime],[delay]

PLATFORMS:
[x],[y],[width],[direction],[speed],[reverse],[delay]

RULES:
1. NO explanations, comments, code blocks, or extra text
2. NO markdown formatting
3. ONLY the exact headers shown above
4. ONLY comma-separated numbers on data lines
5. Start with DURATION and DIFFICULTY
6. HEART_MODES must be first section after difficulty
7. Always include at least one heart mode change
8. Empty sections should be omitted
9. For blue mode (1), ALWAYS set Mode, HeartMode, and HeartMaxFallSpeed together

VALID VALUES:
- Duration: 5-10 seconds
- Difficulty: 1-10
- Heart modes: 0=red, 1=blue
- Bone type: 0=white, 1=blue
- Direction: 0=right, 1=down, 2=left, 3=up
- Speed: bones 100-400, platforms 50-200
- Size: bones 20-150, platforms 40-120
- Coordinates: 0-640 X, 0-480 Y (platforms inside 133-508 X, 251-391 Y)
- Blaster size: always 1
- Spin time: 0.2-0.5
- Blast time: 0.5-2.0
- Platform reverse: 0=no, 1=yes`
        },
        {
            role: "user",
            content: `Create an attack pattern based on this description: ${prompt}`
        }];

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
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(`API error: ${data.error?.message || 'Unknown error'}`);
            if (!data.choices?.[0]?.message?.content) throw new Error('Invalid API response format');

            const content = data.choices[0].message.content;
            const attack = {
                heartModes: [],
                bones: [],
                blasters: [],
                platforms: [],
                duration: 3,
                difficulty: 1
            };

            const sections = content.split(/\*\*[A-Z ]+:\*\*|\n(?=[A-Z ]+:)/);
            sections.forEach(section => {
                if (!section || typeof section !== 'string') return;
                
                const durationMatch = section.match(/DURATION:?\s*(\d+)/i);
                if (durationMatch) attack.duration = Number(durationMatch[1]);
                
                const difficultyMatch = section.match(/DIFFICULTY:?\s*(\d+)/i);
                if (difficultyMatch) attack.difficulty = Number(difficultyMatch[1]);
                
                section = section.replace(/```[^\n]*\n|\n```/g, '');
                
                if (section.includes('HEART MODES') || section.includes('HEART MODE:')) {
                    section.split('\n')
                        .filter(line => line.trim() && !line.startsWith('*') && !line.startsWith('Explanation'))
                        .forEach(line => {
                            if (line.trim().startsWith('//')) return;
                            const [delay, command, param1, param2] = line.split(',').map(s => s.trim());
                            if (command === 'HeartMode') {
                                attack.heartModes.push({
                                    delay: Number(delay),
                                    mode: Number(param2) === 1 ? 1 : 0
                                });
                            }
                        });
                }
                else if (section.includes('BONES') || section.includes('BONE:')) {
                    section.split('\n')
                        .filter(line => line.trim() && !line.startsWith('*') && !line.startsWith('Wave') && !line.startsWith('Explanation'))
                        .forEach(line => {
                            if (line.trim().startsWith('//')) return;
                            const [x, y, type, direction, speed, size, delay] = line.split(',').map(s => s.trim());
                            if (!x || !y || type === undefined || !direction || !speed || !size || delay === undefined) return;
                            const dir = Number(direction);
                            attack.bones.push({
                                type: Number(type) === 1 ? "blue" : "white",
                                x: Number(x),
                                y: Number(y),
                                width: dir === 0 || dir === 2 ? Number(size) : 20,
                                height: dir === 1 || dir === 3 ? Number(size) : 20,
                                speed: Number(speed),
                                direction: ["right", "down", "left", "up"][dir],
                                delay: Number(delay)
                            });
                        });
                }
                else if (section.includes('BLASTERS') || section.includes('BLASTER:')) {
                    section.split('\n')
                        .filter(line => line.trim() && !line.startsWith('*') && !line.startsWith('Blaster') && !line.startsWith('Explanation'))
                        .forEach(line => {
                            if (line.trim().startsWith('//')) return;
                            const [size, startX, startY, endX, endY, angle, spinTime, blastTime, delay] = line.split(',').map(s => s.trim());
                            if (!size || !startX || !startY || !endX || !endY || !angle || !spinTime || !blastTime || delay === undefined) return;
                            attack.blasters.push({
                                x: Number(startX),
                                y: Number(startY),
                                endX: Number(endX),
                                endY: Number(endY),
                                direction: Number(angle),
                                spinTime: Number(spinTime),
                                duration: Number(blastTime),
                                delay: Number(delay)
                            });
                        });
                }
                else if (section.includes('PLATFORMS') || section.includes('PLATFORM:')) {
                    section.split('\n')
                        .filter(line => line.trim() && !line.startsWith('*') && !line.startsWith('Platform') && !line.startsWith('Explanation'))
                        .forEach(line => {
                            if (line.trim().startsWith('//')) return;
                            const [x, y, width, direction, speed, reverse, delay] = line.split(',').map(s => s.trim());
                            if (!x || !y || !width || !direction || !speed || !reverse || !delay) return;
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
                                delay: Number(delay)
                            });
                        });
                }
            });

            return attack;
        } catch (e) {
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
    if (!currentAttack) return;
    const csvContent = generator.convertToCSV(currentAttack);
    const blob = new Blob([csvContent], { type: 'text/csv' });
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
        const fullPrompt = durationInput ? `${prompt} (Duration: ${durationInput} seconds)` : prompt;
        currentAttack = await generator.generateAttack(fullPrompt);
        if (currentAttack) {
            if (durationInput) currentAttack.duration = Number(durationInput);
            currentAttackName = generator.generateAttackName(prompt);
            output.textContent = JSON.stringify(currentAttack, null, 2);
            csvOutput.textContent = generator.convertToCSV(currentAttack);
            downloadBtn.disabled = false;
            filenameDiv.textContent = `Filename: ${currentAttackName}.csv`;
        } else {
            throw new Error('Failed to generate attack pattern');
        }
    } catch (e) {
        output.textContent = '';
        csvOutput.textContent = '';
        error.textContent = `Error generating attack: ${e.message}. Please try again with a different prompt.`;
        currentAttack = null;
        currentAttackName = '';
    }
}