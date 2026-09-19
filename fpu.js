class FPUCoprocessor {
    constructor() {
        this.reset();
    }

    reset() {
        this.opA = new Uint8Array(4);
        this.opB = new Uint8Array(4);
        this.result = new Uint8Array(4);
        this.loadTarget = 'A';   // 'A' o 'B': a qué operando van los próximos bytes OUT
        this.loadIndex = 0;      // puntero de escritura (0-3)
        this.readIndex = 0;      // puntero de lectura del resultado (0-3)
        this.status = {
            busy: false,
            error: false,
            divZero: false,
            overflow: false,
            underflow: false
        };
        this.lastOp = null; // { op, a, b, r } — útil para depuración / UI
    }

    // ---- Puerto de comando (0xF1) ----
    writeCommand(cmd) {
        switch (cmd) {
            case 0x00: this.reset(); break;
            case 0x10: this.loadTarget = 'A'; this.loadIndex = 0; break;
            case 0x11: this.loadTarget = 'B'; this.loadIndex = 0; break;
            case 0x20: this.execute('ADD'); break;
            case 0x21: this.execute('SUB'); break;
            case 0x22: this.execute('MUL'); break;
            case 0x23: this.execute('DIV'); break;
            case 0x30: this.readIndex = 0; break;
            default: break; // comando desconocido: se ignora (como haría el chip real)
        }
    }

    readStatus() {
        let s = 0;
        if (this.status.busy) s |= 0x01;
        if (this.status.error) s |= 0x02;
        if (this.status.divZero) s |= 0x04;
        if (this.status.overflow) s |= 0x08;
        if (this.status.underflow) s |= 0x10;
        if (!this.status.busy) s |= 0x80;
        return s;
    }

    // ---- Puerto de datos (0xF0) ----
    writeData(byte) {
        const buf = this.loadTarget === 'A' ? this.opA : this.opB;
        buf[this.loadIndex % 4] = byte & 0xFF;
        this.loadIndex++;
    }

    readData() {
        const byte = this.result[this.readIndex % 4];
        this.readIndex++;
        return byte;
    }

    // ---- Conversión IEEE754 (float de 32 bits, little-endian) ----
    bytesToFloat(bytes) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        for (let i = 0; i < 4; i++) view.setUint8(i, bytes[i]);
        return view.getFloat32(0, true);
    }

    floatToBytes(f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        const out = new Uint8Array(4);
        for (let i = 0; i < 4; i++) out[i] = view.getUint8(i);
        return out;
    }

    execute(op) {
        this.status.error = false;
        this.status.divZero = false;
        this.status.overflow = false;
        this.status.underflow = false;

        const a = this.bytesToFloat(this.opA);
        const b = this.bytesToFloat(this.opB);
        let r = 0;

        switch (op) {
            case 'ADD': r = a + b; break;
            case 'SUB': r = a - b; break;
            case 'MUL': r = a * b; break;
            case 'DIV':
                if (b === 0) {
                    this.status.divZero = true;
                    this.status.error = true;
                    r = 0;
                } else {
                    r = a / b;
                }
                break;
        }

        if (!isFinite(r)) {
            this.status.overflow = true;
            this.status.error = true;
            r = 0;
        } else if (r !== 0 && Math.abs(r) < 1.17549435e-38) {
            this.status.underflow = true;
        }

        this.result = this.floatToBytes(r);
        this.readIndex = 0;
        this.lastOp = { op, a, b, r };
    }
}

if (typeof module !== 'undefined') {
    module.exports = FPUCoprocessor;
}