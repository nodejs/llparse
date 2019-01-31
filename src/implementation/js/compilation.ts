import * as assert from 'assert';
import { Buffer } from 'buffer';
import * as frontend from 'llparse-frontend';

import {
  CONTAINER_KEY, STATE_ERROR,
  ARG_BUF, ARG_OFF,
  ARG_STATE, ARG_POS, ARG_ENDPOS,
  VAR_MATCH,
  STATE_PREFIX, LABEL_PREFIX, BLOB_PREFIX,
  SEQUENCE_COMPLETE, SEQUENCE_MISMATCH, SEQUENCE_PAUSE,
} from './constants';
import { Code } from './code';
import { Node } from './node';
import { Transform } from './transform';
import { MatchSequence } from './helpers/match-sequence';

// Number of hex words per line of blob declaration
const BLOB_GROUP_SIZE = 4;

type WrappedNode = frontend.IWrap<frontend.node.Node>;

// TODO(indutny): deduplicate
export interface ICompilationOptions {
  readonly debug?: string;
}

// TODO(indutny): deduplicate
export interface ICompilationProperty {
  readonly name: string;
  readonly ty: string;
}

export class Compilation {
  private readonly stateMap: Map<string, ReadonlyArray<string>> = new Map();
  private readonly blobs: Map<Buffer, string> = new Map();
  private readonly codeMap: Map<string, Code<frontend.code.Code>> = new Map();
  private readonly matchSequence:
      Map<string, MatchSequence> = new Map();
  private readonly resumptionTargets: Set<string> = new Set();

  constructor(public readonly prefix: string,
      private readonly properties: ReadonlyArray<ICompilationProperty>,
      resumptionTargets: ReadonlySet<WrappedNode>,
      private readonly options: ICompilationOptions) {
    for (const node of resumptionTargets) {
      this.resumptionTargets.add(STATE_PREFIX + node.ref.id.name.toUpperCase());
    }
  }

  private buildStateEnum(out: string[]): void {
    let index = 0;

    out.push(`const ${STATE_ERROR} = ${index++};`);
    for (const stateName of this.stateMap.keys()) {
      if (this.resumptionTargets.has(stateName)) {
        out.push(`const ${stateName} = ${index++};`);
      }
    }
  }

  private buildBlobs(out: string[]): void {
    if (this.blobs.size === 0) {
      return;
    }

    for (const [ blob, name ] of this.blobs) {
      out.push(`const ${name} = new Uint8Array([`);

      for (let i = 0; i < blob.length; i += BLOB_GROUP_SIZE) {
        const limit = Math.min(blob.length, i + BLOB_GROUP_SIZE);
        const hex: string[] = [];
        for (let j = i; j < limit; j++) {
          const value = blob[j] as number;

          const ch = String.fromCharCode(value);
          let enc = `0x${value.toString(16)}`;

          // `'`, `\`
          if (value === 0x27 || value === 0x5c) {
            enc = `/* '\\${ch}' */ ` + enc;
          } else if (value >= 0x20 && value <= 0x7e) {
            enc = `/* '${ch}' */ ` + enc;
          }
          hex.push(enc);
        }
        let line = '  ' + hex.join(', ');
        if (limit !== blob.length) {
          line += ',';
        }
        out.push(line);
      }

      out.push(`];`);
    }
    out.push('');
  }

  private buildMatchSequence(out: string[]): void {
    if (this.matchSequence.size === 0) {
      return;
    }

    MatchSequence.buildGlobals(out);
    out.push('');

    for (const match of this.matchSequence.values()) {
      match.build(this, out);
      out.push('');
    }
  }

  public reserveSpans(spans: ReadonlyArray<frontend.SpanField>): void {
    for (const span of spans) {
      for (const callback of span.callbacks) {
        this.buildCode(this.unwrapCode(callback));
      }
    }
  }

  public debug(out: string[], message: string): void {
    if (this.options.debug === undefined) {
      return;
    }

    const args = [
      this.stateArg(),
      `(const char*) ${this.posArg()}`,
      `(const char*) ${this.endPosArg()}`,
    ];

    out.push(`${this.options.debug}(${args.join(', ')},`);
    out.push(`  ${this.cstring(message)});`);
  }

  public buildGlobals(out: string[]): void {
    if (this.options.debug !== undefined) {
      out.push(`void ${this.options.debug}(`);
      out.push(`    ${this.prefix}_t* s, const char* p, const char* endp,`);
      out.push('    const char* msg);');
    }

    this.buildBlobs(out);
    this.buildMatchSequence(out);
    this.buildStateEnum(out);

    for (const code of this.codeMap.values()) {
      out.push('');
      code.build(this, out);
    }
  }

  public buildResumptionStates(out: string[]): void {
    this.stateMap.forEach((lines, name) => {
      if (!this.resumptionTargets.has(name)) {
        return;
      }
      out.push(`case ${name}:`);
      out.push(`${LABEL_PREFIX}${name}: {`);
      lines.forEach((line) => out.push(`  ${line}`));
      out.push('  /* UNREACHABLE */;');
      out.push('  abort();');
      out.push('}');
    });
  }

  public buildInternalStates(out: string[]): void {
    this.stateMap.forEach((lines, name) => {
      if (this.resumptionTargets.has(name)) {
        return;
      }
      out.push(`${LABEL_PREFIX}${name}: {`);
      lines.forEach((line) => out.push(`  ${line}`));
      out.push('  /* UNREACHABLE */;');
      out.push('  abort();');
      out.push('}');
    });
  }

  public addState(state: string, lines: ReadonlyArray<string>): void {
    assert(!this.stateMap.has(state));
    this.stateMap.set(state, lines);
  }

  public buildCode(code: Code<frontend.code.Code>): string {
    if (this.codeMap.has(code.ref.name)) {
      assert.strictEqual(this.codeMap.get(code.ref.name)!, code,
          `Code name conflict for "${code.ref.name}"`);
    } else {
      this.codeMap.set(code.ref.name, code);
    }
    return code.ref.name;
  }

  public getFieldType(field: string): string {
    for (const property of this.properties) {
      if (property.name === field) {
        return property.ty;
      }
    }
    throw new Error(`Field "${field}" not found`);
  }

  // Helpers

  public unwrapCode(code: frontend.IWrap<frontend.code.Code>)
    : Code<frontend.code.Code> {
    const container = code as frontend.ContainerWrap<frontend.code.Code>;
    return container.get(CONTAINER_KEY);
  }

  public unwrapNode(node: WrappedNode): Node<frontend.node.Node> {
    const container = node as frontend.ContainerWrap<frontend.node.Node>;
    return container.get(CONTAINER_KEY);
  }

  public unwrapTransform(node: frontend.IWrap<frontend.transform.Transform>)
    : Transform<frontend.transform.Transform> {
    const container =
        node as frontend.ContainerWrap<frontend.transform.Transform>;
    return container.get(CONTAINER_KEY);
  }

  public indent(out: string[], lines: ReadonlyArray<string>, pad: string) {
    for (const line of lines) {
      out.push(`${pad}${line}`);
    }
  }

  // MatchSequence cache

  // TODO(indutny): this is practically a copy from `bitcode/compilation.ts`
  // Unify it somehow?
  public getMatchSequence(
    transform: frontend.IWrap<frontend.transform.Transform>, select: Buffer)
    : string {
    const wrap = this.unwrapTransform(transform);

    let res: MatchSequence;
    if (this.matchSequence.has(wrap.ref.name)) {
      res = this.matchSequence.get(wrap.ref.name)!;
    } else {
      res = new MatchSequence(wrap);
      this.matchSequence.set(wrap.ref.name, res);
    }

    return res.getName();
  }

  // Arguments

  public bufArg(): string {
    return ARG_BUF;
  }

  public offArg(): string {
    return ARG_OFF;
  }

  public stateArg(): string {
    return ARG_STATE;
  }

  public posArg(): string {
    return ARG_POS;
  }

  public endPosArg(): string {
    return ARG_ENDPOS;
  }

  public matchVar(): string {
    return VAR_MATCH;
  }

  // State fields

  public indexField(): string {
    return this.stateField('_index');
  }

  public currentField(): string {
    return this.stateField('_current');
  }

  public errorField(): string {
    return this.stateField('error');
  }

  public reasonField(): string {
    return this.stateField('reason');
  }

  public errorPosField(): string {
    return this.stateField('error_pos');
  }

  public spanPosField(index: number): string {
    return this.stateField(`_span_pos${index}`);
  }

  public spanCbField(index: number): string {
    return this.stateField(`_span_cb${index}`);
  }

  public stateField(name: string): string {
    return `this.${name}`;
  }

  // Globals

  public cstring(value: string): string {
    return JSON.stringify(value);
  }

  public blob(value: Buffer): string {
    if (this.blobs.has(value)) {
      return this.blobs.get(value)!;
    }
    const res = BLOB_PREFIX + this.blobs.size;
    this.blobs.set(value, res);
    return res;
  }
}
