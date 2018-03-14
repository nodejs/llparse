import * as assert from 'assert';
import { builder } from 'bitcode';

import { TransformAPI, CodeAPI } from './api';
import * as internal from './llparse/';

export interface ILLParseOptions {
  debug?: boolean;
}

export class LLParse {
  public readonly code = new CodeAPI();
  public readonly transform = new TransformAPI();
  private readonly properties: {
    set: Set<string>,
    list: internal.compiler.ICompilerStateProperty[],
  };

  public static create(public readonly prefix: string): LLparse {
    return new LLParse(prefix);
  }

  constructor(private readonly prefix: string = 'llparse') {
    this.properties = {
      set: new Set(),
      list: []
    };
  }

  public node(name: string): internal.node.Match {
    return new internal.node.Match(name);
  }

  public error(code: number, reason: string): internal.node.Error {
    return new internal.node.Error(code, reason);
  }

  public invoke(code: internal.code.Code,
                map: { [key: number]: Node } | Node | undefined,
                otherwise?: Node): internal.node.Invoke {
    if (map === undefined) {
      return new internal.node.Invoke(code, {});
    } else if (map instanceof Node) {
      return new internal.node.Invoke(code, {}, map);
    } else {
      return new internal.node.Invoke(code, map, otherwise);
    }
  }

  public span(callback: internal.Code): internal.node.Span {
    return new internal.Span(callback);
  }

  public consume(field: string): internal.node.Consume {
    return new internal.node.Consume(field);
  }

  public pause(code: number, reason: string): internal.node.Pause {
    return new internal.node.Pause(code, reason);
  }

  public property(ty: string, name: string): void {
    if (/^_/.test(name)) {
      throw new Error(`Can't use internal property name: "${name}"`);
    }

    if (this.properties.set.has(name)) {
      throw new Error(`Duplicate property with a name: "${name}"`);
    }

    if (!internal.constants.USER_TYPES.hasOwnProperty(ty)) {
      throw new Error(`Unknown property type: "${ty}"`);
    }
    const bitcodeTy = internal.constants.USER_TYPES[ty];

    props.set.add(name);
    props.list.push({ ty: bitcodeTy, name });
  }

  public build(root: internal.node.Node, options?: ILLParseOptions)
    : internal.compiler.ICompilerBuildResult {
    options = options || {};

    const c = new internal.compiler.Compiler({
      prefix: this.prefix,
      properties: this.properties.list,
      debug: options.debug === undefined ? false : options.debug
    });
    return c.build(root);
  }
}
