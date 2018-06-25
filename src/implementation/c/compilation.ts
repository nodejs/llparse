import * as assert from 'assert';
import * as frontend from 'llparse-frontend';

import * as constants from './constants';
import { Code } from './code';
import { Node } from './node';
import { Transform } from './transform';

export class Compilation {
  private readonly stateMap: Map<string, ReadonlyArray<string>> = new Map();

  public buildStateEnum(out: string[]): void {
    out.push('enum llparse_state_e {');
    this.stateMap.forEach((_, name) => out.push(`  ${name},`));
    out.push('};');
  }

  public buildStates(out: string[]): void {
    this.stateMap.forEach((lines, name) => {
      out.push(`case ${name}: {`);
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
    return container.get(constants.CONTAINER_KEY);
  }

  public unwrapNode(node: frontend.IWrap<frontend.node.Node>)
    : Node<frontend.node.Node> {
    const container = node as frontend.ContainerWrap<frontend.node.Node>;
    return container.get(constants.CONTAINER_KEY);
  }

  public unwrapTransform(node: frontend.IWrap<frontend.transform.Transform>)
    : Transform<frontend.transform.Transform> {
    const container =
        node as frontend.ContainerWrap<frontend.transform.Transform>;
    return container.get(constants.CONTAINER_KEY);
  }
}
