import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import { Compilation } from '../compilation';
import { Node } from './base';

const MAX_CHAR = 0xff;
const TABLE_GROUP = 16;

interface ITable {
  readonly name: string;
  readonly declaration: ReadonlyArray<string>;
}

export class TableLookup extends Node<frontend.node.TableLookup> {
  public doBuild(out: string[]): void {
    const ctx = this.compilation;

    const table = this.buildTable();
    for (const line of table.declaration) {
      out.push(line);
    }

    this.prologue(out);

    const transform = ctx.unwrapTransform(this.ref.transform!);
    const current = transform.build(ctx, `*${ctx.posArg()}`);

    out.push(`switch (${table.name}[(uint8_t) ${current}]) {`);

    for (const [ index, edge ] of this.ref.edges.entries()) {
      out.push(`  case ${index + 1}: {`);

      const tmp: string[] = [];
      const edge = this.ref.edges[index];
      this.tailTo(tmp, {
        noAdvance: edge.noAdvance,
        node: edge.node,
        value: undefined,
      });
      ctx.indent(out, tmp, '    ');

      out.push('  }');
    }

    out.push(`  default: {`);

    const tmp: string[] = [];
    this.tailTo(tmp, this.ref.otherwise!);
    ctx.indent(out, tmp, '    ');

    out.push('  }');
    out.push('}');
  }

  // TODO(indutny): reduce copy-paste between `C` and `bitcode` implementations
  private buildTable(): ITable {
    const table: number[] = new Array(MAX_CHAR + 1).fill(0);

    for (const [ index, edge ] of this.ref.edges.entries()) {
      edge.keys.forEach((key) => {
        assert.strictEqual(table[key], 0);
        table[key] = index + 1;
      });
    }

    const lines = [
      'static uint8_t lookup_table[] = {',
    ];
    for (let i = 0; i < table.length; i += TABLE_GROUP) {
      let line = `  ${table.slice(i, i + TABLE_GROUP).join(', ')}`;
      if (i + TABLE_GROUP < table.length) {
        line += ',';
      }
      lines.push(line);
    }
    lines.push('};');

    return {
      name: 'lookup_table',
      declaration: lines,
    };
  }
}
