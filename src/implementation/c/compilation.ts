import * as assert from 'assert';
import { Buffer } from 'buffer';
import * as frontend from 'llparse-frontend';

import {
  CONTAINER_KEY, STATE_NULL,
  ARG_STATE, ARG_POS, ARG_ENDPOS,
  VAR_MATCH,
  LABEL_PREFIX, BLOB_PREFIX,
} from './constants';
import { Code } from './code';
import { Node } from './node';
import { Transform } from './transform';

const BLOB_GROUP_SIZE = 11;

export class Compilation {
  private readonly stateMap: Map<string, ReadonlyArray<string>> = new Map();
  private readonly blobs: Map<Buffer, string> = new Map();

  public buildStateEnum(out: string[]): void {
    out.push('enum llparse_state_e {');
    out.push(`  ${STATE_NULL},`);
    for (const stateName of this.stateMap.keys()) {
      out.push(`  ${stateName},`);
    }
    out.push('};');
  }

  public buildGlobals(out: string[]): void {
    for (const [ blob, name ] of this.blobs) {
      out.push(`static const unsigned char ${name}[] = {`);

      for (let i = 0; i < blob.length; i += BLOB_GROUP_SIZE) {
        const limit = Math.min(blob.length, i + BLOB_GROUP_SIZE);
        const hex: string[] = [];
        for (let j = i; j < limit; j++) {
          const value = blob[j] as number;

          // TODO(indutny): printable ASCII should be emitted verbatim
          hex.push(`0x${value.toString(16)}`);
        }
        let line = '  ' + hex.join(', ');
        if (limit !== blob.length) {
          line += ',';
        }
        out.push(line);
      }

      out.push(`};`);
    }
  }

  public buildStates(out: string[]): void {
    this.stateMap.forEach((lines, name) => {
      out.push(`case ${name}:`);
      out.push(`${LABEL_PREFIX}${name}: {`);
      lines.forEach((line) => out.push(`  ${line}`));
      out.push('  break;');
      out.push('}');
    });
  }

  public addState(state: string, lines: ReadonlyArray<string>): void {
    assert(!this.stateMap.has(state));
    this.stateMap.set(state, lines);
  }

  // Helpers

  public unwrapCode(code: frontend.IWrap<frontend.code.Code>)
    : Code<frontend.code.Code> {
    const container = code as frontend.ContainerWrap<frontend.code.Code>;
    return container.get(CONTAINER_KEY);
  }

  public unwrapNode(node: frontend.IWrap<frontend.node.Node>)
    : Node<frontend.node.Node> {
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

  public getMatchSequence(
    transform: frontend.IWrap<frontend.transform.Transform>, select: Buffer)
    : string {
    const wrap = this.unwrapTransform(transform);

    // TODO(indutny): implement me
    return 'todo_match_sequence';
  }

  // Arguments

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
    return `${this.stateArg()}->${name}`;
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
