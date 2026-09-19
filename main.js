const cpu = new Intel8080();
const assembler = new Assembler8080();

let runInterval = null;
let memoryStart = 0;

function updateUI() {
    // Registers
    document.getElementById('reg-a').textContent = cpu.registers.a.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-b').textContent = cpu.registers.b.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-c').textContent = cpu.registers.c.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-d').textContent = cpu.registers.d.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-e').textContent = cpu.registers.e.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-h').textContent = cpu.registers.h.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-l').textContent = cpu.registers.l.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-pc').textContent = cpu.registers.pc.toString(16).toUpperCase().padStart(4, '0');
    document.getElementById('reg-sp').textContent = cpu.registers.sp.toString(16).toUpperCase().padStart(4, '0');
    document.getElementById('reg-f').textContent = cpu.getFlagByte().toString(16).toUpperCase().padStart(2, '0');

    // Flags
    document.getElementById('flag-s').textContent = cpu.flags.s ? '1' : '0';
    document.getElementById('flag-z').textContent = cpu.flags.z ? '1' : '0';
    document.getElementById('flag-ac').textContent = cpu.flags.ac ? '1' : '0';
    document.getElementById('flag-p').textContent = cpu.flags.p ? '1' : '0';
    document.getElementById('flag-cy').textContent = cpu.flags.cy ? '1' : '0';

    document.getElementById('status-badge').textContent = cpu.halted ? 'Halted' : (runInterval ? 'Running' : 'Idle');
    document.getElementById('status-badge').style.backgroundColor = cpu.halted ? '#fee2e2' : (runInterval ? '#f0fdf4' : '#e2e8f0');

    renderMemory();
    renderStack();
    renderFPU();
}

function floatBytesToHexDec(bytes) {
    const hex = Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const dec = new DataView(bytes.buffer).getFloat32(0, true);
    return { hex, dec };
}

function renderFPU() {
    const fpu = cpu.fpu;
    if (!fpu) return;

    const a = floatBytesToHexDec(fpu.opA);
    const b = floatBytesToHexDec(fpu.opB);
    const r = floatBytesToHexDec(fpu.result);

    document.getElementById('fpu-a-hex').textContent = a.hex;
    document.getElementById('fpu-a-dec').textContent = a.dec;
    document.getElementById('fpu-b-hex').textContent = b.hex;
    document.getElementById('fpu-b-dec').textContent = b.dec;
    document.getElementById('fpu-r-hex').textContent = r.hex;
    document.getElementById('fpu-r-dec').textContent = r.dec;

    document.getElementById('fpu-flag-busy').textContent = fpu.status.busy ? '1' : '0';
    document.getElementById('fpu-flag-error').textContent = fpu.status.error ? '1' : '0';
    document.getElementById('fpu-flag-divzero').textContent = fpu.status.divZero ? '1' : '0';
    document.getElementById('fpu-flag-overflow').textContent = fpu.status.overflow ? '1' : '0';
    document.getElementById('fpu-flag-underflow').textContent = fpu.status.underflow ? '1' : '0';

    const badge = document.getElementById('fpu-ready-badge');
    badge.textContent = fpu.status.busy ? 'BUSY' : 'READY';
    badge.className = 'fpu-badge' + (fpu.status.busy ? ' busy' : '');

    const lastOpEl = document.getElementById('fpu-last-op');
    if (fpu.lastOp) {
        lastOpEl.textContent = `${fpu.lastOp.a} ${fpu.lastOp.op} ${fpu.lastOp.b} = ${fpu.lastOp.r}`;
    } else {
        lastOpEl.textContent = '—';
    }
}

function renderStack() {
    const table = document.getElementById('stack-table');
    if (!table) return;
    table.innerHTML = '';

    const currentSP = cpu.registers.sp;

    // Show 5 slots (2-byte aligned) from SP - 4 to SP + 6
    for (let offset = 6; offset >= -4; offset -= 2) {
        const addr = (currentSP + offset) & 0xFFFF;

        const row = document.createElement('div');
        row.className = 'stack-row';
        if (offset === 0) {
            row.classList.add('active');
        }

        const addrSpan = document.createElement('span');
        addrSpan.className = 'stack-addr';
        addrSpan.textContent = (offset === 0 ? 'SP ➔ ' : '     ') + addr.toString(16).toUpperCase().padStart(4, '0') + ':';

        const low = cpu.readMemory(addr);
        const high = cpu.readMemory((addr + 1) & 0xFFFF);
        const val16 = (high << 8) | low;

        const valSpan = document.createElement('span');
        valSpan.className = 'stack-val';
        valSpan.textContent = val16.toString(16).toUpperCase().padStart(4, '0') + 'H (' + high.toString(16).toUpperCase().padStart(2, '0') + ' ' + low.toString(16).toUpperCase().padStart(2, '0') + ')';

        row.appendChild(addrSpan);
        row.appendChild(valSpan);
        table.appendChild(row);
    }
}

function renderMemory() {
    const table = document.getElementById('memory-table');
    table.innerHTML = '';

    // Header
    const empty = document.createElement('div');
    empty.className = 'mem-cell mem-header';
    empty.textContent = '';
    table.appendChild(empty);

    for (let i = 0; i < 16; i++) {
        const h = document.createElement('div');
        h.className = 'mem-cell mem-header';
        h.textContent = i.toString(16).toUpperCase();
        table.appendChild(h);
    }

    // Rows
    for (let row = 0; row < 8; row++) {
        const addr = (memoryStart + row * 16) & 0xFFFF;
        const h = document.createElement('div');
        h.className = 'mem-cell mem-addr';
        h.textContent = addr.toString(16).toUpperCase().padStart(4, '0');
        table.appendChild(h);

        for (let col = 0; col < 16; col++) {
            const cellAddr = (addr + col) & 0xFFFF;
            const c = document.createElement('div');
            c.className = 'mem-cell';
            if (cellAddr === cpu.registers.pc) c.style.backgroundColor = '#fde047';
            c.textContent = cpu.readMemory(cellAddr).toString(16).toUpperCase().padStart(2, '0');
            table.appendChild(c);
        }
    }
}

document.getElementById('btn-assemble').addEventListener('click', () => {
    const source = document.getElementById('code-editor').value;
    const output = document.getElementById('assembler-output');
    try {
        const result = assembler.assemble(source);
        cpu.memory.set(result.binary);
        output.textContent = 'Assembly successful! Loaded into memory.';
        output.className = 'success';
        updateUI();
    } catch (e) {
        output.textContent = 'Error: ' + e.message;
        output.className = 'error';
    }
});

document.getElementById('btn-clear-code').addEventListener('click', () => {
    document.getElementById('code-editor').value = '';
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = '';
        output.className = '';
    }
});

document.getElementById('btn-step').addEventListener('click', () => {
    cpu.step();
    updateUI();
});

document.getElementById('btn-run').addEventListener('click', () => {
    if (runInterval) return;
    runInterval = setInterval(() => {
        if (cpu.halted) {
            clearInterval(runInterval);
            runInterval = null;
            updateUI();
            return;
        }
        for (let i = 0; i < 100; i++) { // Execute in bursts
            cpu.step();
            if (cpu.halted) break;
        }
        updateUI();
    }, 10);
    updateUI();
});

document.getElementById('btn-stop').addEventListener('click', () => {
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
        updateUI();
    }
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
    }
    cpu.reset();

    // Clear assembler output
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = '';
        output.className = '';
    }

    // Reset memory start address and variable
    const memStartInput = document.getElementById('mem-start-addr');
    if (memStartInput) {
        memStartInput.value = '0000';
    }
    memoryStart = 0;

    updateUI();
});

document.getElementById('btn-mem-go').addEventListener('click', () => {
    const val = document.getElementById('mem-start-addr').value;
    memoryStart = parseInt(val, 16) || 0;
    renderMemory();
});

// Demo del coprocesador FPU8231: calcula 1.5 + 2.25 usando el protocolo
// de puertos 0xF0 (datos) / 0xF1 (comando), y guarda el resultado IEEE754
// (4 bytes little-endian) en las direcciones 3000H-3003H.
const FPU_DEMO_PROGRAM = `; ================================================================
; DEMO: Coprocesador de Punto Flotante (FPU8231) — 1.5 + 2.25 = 3.75
; ================================================================
; Protocolo: puerto 0F0H = datos, puerto 0F1H = comando/estado.
; Comandos: 10H=Sel.OpA  11H=Sel.OpB  20H=ADD  21H=SUB  22H=MUL  23H=DIV  30H=Sel.Lectura Resultado
ORG 0000H

; --- Seleccionar Operando A y cargar 1.5 (bytes IEEE754 LE: 00 00 C0 3F) ---
MVI A, 10H
OUT 0F1H
MVI A, 00H
OUT 0F0H
MVI A, 00H
OUT 0F0H
MVI A, 0C0H
OUT 0F0H
MVI A, 3FH
OUT 0F0H

; --- Seleccionar Operando B y cargar 2.25 (bytes IEEE754 LE: 00 00 10 40) ---
MVI A, 11H
OUT 0F1H
MVI A, 00H
OUT 0F0H
MVI A, 00H
OUT 0F0H
MVI A, 10H
OUT 0F0H
MVI A, 40H
OUT 0F0H

; --- Ejecutar suma en punto flotante (A = A + B) ---
MVI A, 20H
OUT 0F1H

; --- Seleccionar lectura del resultado y guardarlo en memoria ---
MVI A, 30H
OUT 0F1H
IN 0F0H
STA 3000H
IN 0F0H
STA 3001H
IN 0F0H
STA 3002H
IN 0F0H
STA 3003H

HLT`;

document.getElementById('btn-fpu-demo').addEventListener('click', () => {
    document.getElementById('code-editor').value = FPU_DEMO_PROGRAM;
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = 'Programa de demostración del FPU cargado. Presiona "Assemble & Load" y luego "Run".';
        output.className = 'success';
    }
});

// Initial UI update
updateUI();
