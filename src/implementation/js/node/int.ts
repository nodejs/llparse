import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

export class Int extends Node<frontend.node.Int> {
  public doBuild(out: string[]): void {
    this.prologue(out);

    switch (this.ref.bytes) {
      case 1: {
        if (this.ref.signed) {
          this.readInt8(out);
        } else {
          this.readUInt8(out);
        }
        break;
      }

      case 2: {
        if (this.ref.littleEndian) {
          this.readUInt16LE(out);
        } else {
          this.readUInt16BE(out);
        }
        break;
      }

      case 3: {
        if (this.ref.littleEndian) {
          this.readUInt24LE(out);
        } else {
          this.readUInt24BE(out);
        }
        break;
      }

      case 4: {
        if (this.ref.littleEndian) {
          this.readUInt32LE(out);
        } else {
          this.readUInt32BE(out);
        }
        break;
      }
    }

    this.tailTo(out, this.ref.otherwise!);
  }

  private readInt8(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    out.push(`${index} = (${ctx.bufArg()}[${ctx.offArg()}] & 2 ** 7) * 0x1fffffe;`)
  }

  private readUInt8(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    out.push(`${index} = ${ctx.bufArg()}[${ctx.offArg()}];`)
  }

  private readUInt16LE(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    switch (this.ref.byteOffset) {
      case 0: {
        out.push(`${index} = ${ctx.bufArg()}[${ctx.offArg()}];`)
        break;
      }

      case 1: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 8;`);
        break;
      }
    }
  }

  private readUInt24LE(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    switch (this.ref.byteOffset) {
      case 0: {
        out.push(`${index} = ${ctx.bufArg()}[${ctx.offArg()}];`)
        break;
      }

      case 1: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 8;`);
        break;
      }

      case 2: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 16;`);
        break;
      }
    }
  }

  private readUInt32LE(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    switch (this.ref.byteOffset) {
      case 0: {
        out.push(`${index} = ${ctx.bufArg()}[${ctx.offArg()}];`)
        break;
      }

      case 1: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 8;`);
        break;
      }

      case 2: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 16;`);
        break;
      }

      case 3: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 24;`);
        break;
      }
    }
  }

  private readUInt16BE(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    switch (this.ref.byteOffset) {
      case 0: {
        out.push(`${index} = ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 8;`);
        break;
      }

      case 1: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}];`)
        break;
      }
    }
  }

  private readUInt24BE(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    switch (this.ref.byteOffset) {
      case 0: {
        out.push(`${index} = ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 16;`);
        break;
      }

      case 1: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 8;`);
        break;
      }

      case 2: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}];`)
        break;
      }
    }
  }

  private readUInt32BE(out: string[]) {
    const ctx = this.compilation;
    const index = ctx.stateField(this.ref.field);

    switch (this.ref.byteOffset) {
      case 0: {
        out.push(`${index} = ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 24;`);
        break;
      }

      case 1: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 16;`);
        break;
      }

      case 2: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}] * 2 ** 8;`);
        break;
      }

      case 3: {
        out.push(`${index} += ${ctx.bufArg()}[${ctx.offArg()}];`)
        break;
      }
    }
  }
}
