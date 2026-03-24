// DOM Elements
const editor = document.getElementById('code-editor');
const outputScreen = document.getElementById('output-screen');
const regPC = document.getElementById('reg-pc');
const regACC = document.getElementById('reg-acc');
const regIR = document.getElementById('reg-ir');
const btnRun = document.getElementById('btn-run');
const btnStep = document.getElementById('btn-step');
const btnReset = document.getElementById('btn-reset');
const btnClear = document.getElementById('btn-clear');
const btnAi = document.getElementById('btn-ai');
const inputDesc = document.getElementById('code-desc');
const inputApiKey = document.getElementById('api-key');
const selectAiModel = document.getElementById('ai-model');
const statusMsg = document.getElementById('status-msg');
const ramContainer = document.getElementById('ram-container');

// Modal d'Ajuda
const btnHelp = document.getElementById('btn-help');
const modalHelp = document.getElementById('help-modal');
const btnCloseHelp = document.getElementById('btn-close-help');

// CPU State Variables
let PC = 0;
let ACC = 0;
let IR = "";
let isRunning = false;
let runInterval = null;
let instructions = [];
let currentLineSpan = null;

// Memòria RAM
let ram = new Array(16).fill(0);

// Inicialització
function init() {
    PC = 0;
    ACC = 0;
    IR = "-";
    isRunning = false;

    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
    }

    instructions = [];
    ram.fill(0);
    currentLineSpan = null;

    updateRegisters();
    renderRAM();

    outputScreen.innerHTML = '';
    statusMsg.innerText = "Preparat.";
    statusMsg.style.color = "#8b949e";
    btnStep.disabled = false;
    btnRun.innerText = "Run";
    editor.disabled = false;
}

// Actualitza les caixes de text dels registres
function updateRegisters() {
    regPC.value = PC;
    regACC.value = ACC;
    regIR.value = IR;
}

// Dibuixa l'estat actual de la RAM
function renderRAM() {
    ramContainer.innerHTML = '';
    for (let i = 0; i < ram.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'ram-cell';

        // Formateja l'adreça a 2 dígits (00, 01.. 15)
        const addr = i.toString(10).padStart(2, '0');

        cell.innerHTML = `
                    <span class="addr">[${addr}]</span>
                    <span class="val">${ram[i]}</span>
                `;
        ramContainer.appendChild(cell);
    }
}

// Imprimeix text al "terminal"
function printOutput(text) {
    currentLineSpan = null; // Reinicia per a la pròxima línia
    const span = document.createElement('span');
    span.innerText = text;
    outputScreen.appendChild(span);
    outputScreen.scrollTop = outputScreen.scrollHeight; // Auto-scroll
}

// Imprimeix text en línia sense salt
function printChar(char) {
    if (!currentLineSpan) {
        currentLineSpan = document.createElement('span');
        outputScreen.appendChild(currentLineSpan);
    }
    currentLineSpan.innerText += char;
    outputScreen.scrollTop = outputScreen.scrollHeight;
}

// Llegeix el codi de l'editor i el separa en línies vàlides
function loadProgram() {
    const rawCode = editor.value;
    // Separem per línies, eliminem ràpidament comentaris a la mateixa línia explicatius i traiem els espais
    instructions = rawCode.split('\n')
        .map(line => {
            let cleanLine = line;
            const commentIndex = cleanLine.toLowerCase().indexOf('ex:');
            if (commentIndex !== -1) {
                cleanLine = cleanLine.substring(0, commentIndex);
            }
            cleanLine = cleanLine.trim();
            // Ignora si hi ha numeració de línia al principi (ex: "00 LOAD 0" -> "LOAD 0")
            cleanLine = cleanLine.replace(/^\d+\s+/, '');
            return cleanLine;
        })
        .filter(line => line.length > 0);
}

// Cicle d'Instrucció (Fetch -> Decode -> Execute)
function step() {
    // Demana carregar el programa si estem al principi
    if (PC === 0 && instructions.length === 0) {
        loadProgram();
        if (instructions.length === 0) {
            haltExecution("Error: No hi ha programa per executar.", "#f85149");
            return false;
        }
        editor.disabled = true; // Bloqueja l'edició mentre s'executa
    }

    // Si s'ha arribat al final del codi sense trobar un HLT
    if (PC >= instructions.length) {
        haltExecution("S'ha arribat al final del programa sense HLT.", "#58a6ff");
        return false;
    }

    // Fetch
    IR = instructions[PC];
    updateRegisters();

    // Decode
    const parts = IR.trim().split(/\s+/);
    const opcode = parts[0].toUpperCase();

    // Extreiem exclusivament el número de l'argument de forma segura
    // (Així passem de "RAM[3]" -> a directament int o "3" -> a directament int)
    const args = parts.slice(1).map(p => {
        const match = p.match(/\d+/);
        return match ? parseInt(match[0], 10) : NaN;
    }); // Totes les paraules següents netejades i convertides a número

    // Execute
    try {
        switch (opcode) {
            case 'IN':
                let input = prompt("Introdueix un número o un sol caràcter:");
                if (input === null || input === "") {
                    ACC = 0;
                } else if (!isNaN(input)) {
                    ACC = parseInt(input, 10);
                } else {
                    ACC = input.charCodeAt(0);
                }
                break;
            case 'INS':
                if (isNaN(args[0])) throw new Error("INS necessita una adreça de memòria inicial (ex: INS 5)");
                if (args[0] < 0 || args[0] >= 16) throw new Error("Adreça de memòria fora de límits (0-15).");
                let textInput = prompt("Introdueix un text (màxim els espais lliures de RAM):") || "";
                let startDir = args[0];
                let i = 0;
                // Guardem cada caràcter com a ASCII consecutivament fins que s'acabi el text o la RAM
                while (i < textInput.length && (startDir + i) < 15) {
                    ram[startDir + i] = textInput.charCodeAt(i);
                    i++;
                }
                // Posem un 0 al final (Caràcter Nul) per marcar el final del string
                if ((startDir + i) < 16) {
                    ram[startDir + i] = 0;
                }
                renderRAM();
                break;
            case 'LDA':
                if (isNaN(args[0])) throw new Error("LDA necessita una adreça de memòria (ex: LDA 2)");
                if (args[0] < 0 || args[0] >= 16) throw new Error("Adreça de memòria fora de límits (0-15).");
                ACC = ram[args[0]];
                break;
            case 'STA':
                if (isNaN(args[0])) throw new Error("STA necessita una adreça de memòria (ex: STA 2)");
                if (args[0] < 0 || args[0] >= 16) throw new Error("Adreça de memòria fora de límits (0-15).");
                ram[args[0]] = ACC;
                renderRAM();
                break;
            case 'ADD':
                if (isNaN(args[0])) throw new Error("ADD necessita una adreça de memòria (ex: ADD 5)");
                if (args[0] < 0 || args[0] >= 16) throw new Error("Adreça de memòria fora de límits (0-15).");
                ACC += ram[args[0]];
                break;
            case 'SUB':
                if (isNaN(args[0])) throw new Error("SUB necessita una adreça de memòria (ex: SUB 1)");
                if (args[0] < 0 || args[0] >= 16) throw new Error("Adreça de memòria fora de límits (0-15).");
                ACC -= ram[args[0]];
                break;
            case 'LOAD':
                if (isNaN(args[0])) throw new Error("LOAD necessita un número (ex: LOAD 5)");
                ACC = args[0];
                break;
            case 'JNZ':
                if (isNaN(args[0])) throw new Error("JNZ necessita un número de línia a saltar (ex: JNZ 3)");
                if (ACC !== 0) {
                    PC = args[0] - 1; // -1 perquè el pas suma 1 automàticament
                }
                break;
            case 'JMP':
                if (isNaN(args[0])) throw new Error("JMP necessita un número de línia a saltar (ex: JMP 3)");
                PC = args[0] - 1;
                break;
            case 'OUT':
                printOutput(ACC);
                break;
            case 'OUTC':
                printChar(String.fromCharCode(ACC));
                break;
            case 'OUTS':
                if (isNaN(args[0])) throw new Error("OUTS necessita una adreça de memòria inicial (ex: OUTS 5)");
                if (args[0] < 0 || args[0] >= 16) throw new Error("Adreça de memòria fora de límits (0-15).");
                let ptr = args[0];
                let outputStr = "";
                // Llegim la memòria fins a trobar un 0 (final d'string) o acabar la RAM
                while (ptr < 16 && ram[ptr] !== 0) {
                    outputStr += String.fromCharCode(ram[ptr]);
                    ptr++;
                }
                printOutput(outputStr);
                break;
            case 'OUTFMT':
                if (args.length < 3) throw new Error("OUTFMT necessita 3 arguments (ex: OUTFMT 2 3 4)");
                for (let i = 0; i < 3; i++) {
                    if (isNaN(args[i]) || args[i] < 0 || args[i] >= 16) {
                        throw new Error(`OUTFMT: Argument ${i} invàlid o fora de memòria RAM (0-15).`);
                    }
                }
                printOutput(`${ram[args[0]]} x ${ram[args[1]]} = ${ram[args[2]]}`);
                break;
            case 'HLT':
                PC++;
                updateRegisters();
                haltExecution("Programa acabat amb èxit (HLT).", "#2ea043");
                return false;
            case 'LDAI':
                if (isNaN(args[0])) throw new Error("LDAI necessita una adreça de memòria (ex: LDAI 1)");
                if (args[0] < 0 || args[0] >= 16) throw new Error("Adreça de memòria fora de límits (0-15).");
                let punter = ram[args[0]]; // Aquesta és la màgia: la RAM ens diu a quina altra RAM mirar
                if (punter < 0 || punter >= 16) throw new Error("El punter apunta a una adreça invàlida.");
                ACC = ram[punter];
                break;
            default:
                throw new Error(`Instrucció no vàlida: ${opcode}`);
        }
    } catch (error) {
        haltExecution(`Error a PC=${PC}: ${error.message}`, "#f85149");
        return false;
    }

    // PC Increment
    PC++;
    updateRegisters();
    return true;
}

// S'encarrega d'aturar de forma neta l'execució i mostrar un missatge
function haltExecution(message, color) {
    isRunning = false;
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
    }
    btnStep.disabled = true;
    btnRun.innerText = "Run";
    statusMsg.innerText = message;
    if (color) {
        statusMsg.style.color = color;
    }
}

// Event Listeners dels controls
btnStep.addEventListener('click', () => {
    statusMsg.innerText = "Executant pas a pas...";
    statusMsg.style.color = "#2ea043";
    step();
});

btnRun.addEventListener('click', () => {
    if (isRunning) {
        // Si ja està corrent i polsem el botó -> Pausa
        haltExecution("Pausat.", "#58a6ff");
        btnStep.disabled = false;
    } else {
        // Inicia l'execució automàtica
        isRunning = true;
        btnRun.innerText = "Pause";
        btnStep.disabled = true;
        statusMsg.innerText = "Execució automàtica...";
        statusMsg.style.color = "#2ea043";

        runInterval = setInterval(() => {
            const continueExecution = step();
            if (!continueExecution) {
                if (runInterval) {
                    clearInterval(runInterval);
                    runInterval = null;
                }
            }
        }, 100); // Temps entre instruccions: 500 ms
    }
});

btnReset.addEventListener('click', () => {
    init();
});

btnClear.addEventListener('click', () => {
    init(); // Atura si estava corrent i reinicia l'estat
    editor.value = ''; // Buidem la caixa de text
    editor.focus();
});

// Carregar models disponibles des de l'API quan l'usuari posa la clau
const fetchGeminiModels = async () => {
    const apiKey = inputApiKey.value.trim();
    if (!apiKey) {
        selectAiModel.innerHTML = '<option value="">Introdueix l\'API Key...</option>';
        selectAiModel.disabled = true;
        return;
    }

    selectAiModel.innerHTML = '<option value="">Carregant models...</option>';
    selectAiModel.disabled = true;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error("Límit de quotes excedit (Massa peticions avui)");
            } else if (response.status === 400) {
                throw new Error("La Clau API és invàlida");
            } else {
                throw new Error("Error de Xarxa general amb l'API de Gemini");
            }
        }

        const data = await response.json();

        // Filtrem només els models que siguin capaços de generar text i continguts avançats (Gemini)
        const validModels = data.models.filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'));

        selectAiModel.innerHTML = ''; // Buidem el loading

        if (validModels.length === 0) {
            selectAiModel.innerHTML = '<option value="">Cap model disponible</option>';
            return;
        }

        validModels.forEach(model => {
            const opt = document.createElement('option');
            opt.value = model.name; // Ex: 'models/gemini-2.5-flash'
            opt.innerText = model.displayName || model.name.split('/')[1];

            // Per defecte seleccionem el famós Flash ràpid
            if (model.name.includes('flash')) opt.selected = true;

            selectAiModel.appendChild(opt);
        });

        selectAiModel.disabled = false;
        selectAiModel.style.borderColor = 'var(--accent-green)'; // Feedback visual success

    } catch (err) {
        if (err.message.includes("quota") || err.message.includes("Límit")) {
            selectAiModel.innerHTML = '<option value="">Límit Diari Esgotat</option>';
        } else {
            selectAiModel.innerHTML = '<option value="">Clau invàlida</option>';
        }
        selectAiModel.style.borderColor = '#f85149'; // Feedback Error
    }
};

inputApiKey.addEventListener('blur', fetchGeminiModels);
inputApiKey.addEventListener('change', fetchGeminiModels);

// Integració amb API de la IA (Gemini)
btnAi.addEventListener('click', async () => {
    const desc = inputDesc.value.trim();
    const apiKey = inputApiKey.value.trim();
    let selectedModel = selectAiModel.value || 'models/gemini-1.5-flash'; // Fallback per seguretat
    // Algunes respostes de l'endpoint model inclouen "models/" inicialment
    if (selectedModel.startsWith('models/')) selectedModel = selectedModel.replace('models/', '');

    if (!desc) {
        alert("Si us plau, escriu una descripció del programa que vols generar.");
        return;
    }
    if (!apiKey) {
        alert("És necessària una API Key de Gemini vàlida per utilitzar la generació de codi.");
        return;
    }

    const systemPrompt = `Ets un expert en programació de baix nivell. Escriu un programa en el meu llenguatge ensamblador personalitzat basat en aquesta descripció de l'usuari: "${desc}"

Aquestes són les ÚNIQUES instruccions que suporta la meva CPU:
- LOAD [num]: Guarda el número [num] a l'Acumulador (ACC).
- LDA [dir]: Llegeix el número a la memòria RAM[dir] i el guarda a l'ACC.
- LDAI [dir]: Llegeix el número a RAM[dir] (que actua com a punter), i guarda a l'ACC el valor de l'adreça RAM corresponent a aquell punter.
- STA [dir]: Guarda el valor de l'ACC a la memòria RAM[dir].
- ADD [dir]: Suma a l'ACC el valor de la RAM[dir].
- SUB [dir]: Resta a l'ACC el valor de la RAM[dir].
- JNZ [linia]: Salta a la línia especificada si l'ACC no és 0.
- JMP [linia]: Salta incondicionalment a la línia especificada.
- IN: Demana a l'usuari un número o caràcter i en guarda el seu valor (o el codi ASCII) a l'ACC.
- INS [dir]: Demana un text i el guarda lletra a lletra des de RAM[dir], afegint un 0 al final (Ex: si dir=5 i user="Hola", RAM[5]=72, RAM[6]=111, RAM[7]=108, RAM[8]=97, RAM[9]=0).
- OUT: Imprimeix el valor de l'ACC com a número.
- OUTC: Imprimeix el valor de l'ACC traduït a caràcter ASCII.
- OUTS [dir]: Llegeix caràcters de RAM consecutius començant per RAM[dir] i els imprimeix de cop com a paraula fins a trobar un 0.
- OUTFMT [dir1] [dir2] [dir3]: Imprimeix 'RAM[dir1] x RAM[dir2] = RAM[dir3]'.
- HLT: Atura l'execució.

La RAM només té direccions del 0 al 15.
IMPORTANT: 
1. Retorna NOMÉS el codi en text pla, sense format markdown de codi (\`\`\`).
2. Totes les línies de l'editor estan indexades a partir de la línia 0 (La primera instrucció).
3. Pots afegir comentaris explicatius, però han de començar sempre per "ex:" per a que el simulador els ignori.`;

    btnAi.disabled = true;
    btnAi.innerText = "Generant...";

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error("Has assolit el límit diari gratuït del model escollit (Error 429). Prova amb un de més bàsic al selector o renova la quota demà.");
            } else if (response.status === 400) {
                throw new Error("Clau d'API incorrecta (Error 400). Assegura't de copiar-la bé sense espais.");
            } else {
                throw new Error(`Error en el servidor de Gemini (Codi: ${response.status}).`);
            }
        }

        const data = await response.json();
        let generatedCode = data.candidates[0].content.parts[0].text.trim();

        // Netejar possibles decoracions markdown si la IA s'ho salta
        if (generatedCode.startsWith('\`\`\`')) {
            const lines = generatedCode.split('\n');
            lines.shift(); // Treu la primera línia (```...)
            if (lines[lines.length - 1].startsWith('\`\`\`')) {
                lines.pop(); // Trete la darrera línia (```)
            }
            generatedCode = lines.join('\n');
        }

        // Posem el nou programa generat a l'editor 
        editor.value = generatedCode;

    } catch (err) {
        alert("No s'ha pogut generar el codi: " + err.message);
    } finally {
        btnAi.disabled = false;
        btnAi.innerText = "Generar (IA)";
    }
});

// Event Listeners Modal d'Ajuda
btnHelp.addEventListener('click', () => {
    modalHelp.style.display = 'flex';
});

btnCloseHelp.addEventListener('click', () => {
    modalHelp.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modalHelp) {
        modalHelp.style.display = 'none';
    }
});

// Executar init inicial
init();