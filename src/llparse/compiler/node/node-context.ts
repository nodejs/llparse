import { Builder } from 'bitcode';

import {
  Compilation, INodePosition, Func, types, values,
} from '../compilation';
import { Node } from './base';

export class NodeContext {
  // Some generally useful types (to avoid unnecessary includes)
  public readonly INT = constants.INT;
  public readonly BOOL = constants.BOOL;
  public readonly TYPE_MATCH = constants.TYPE_MATCH;
  public readonly TYPE_REASON = constants.TYPE_REASON;
  public readonly TYPE_ERROR = constants.TYPE_ERROR;
  public readonly TYPE_INDEX = constants.TYPE_INDEX;
  public readonly TYPE_INTPTR = constants.TYPE_INTPTR;
  public readonly state: values.Value;
  public readonly pos: INodePosition;
  public readonly endPos: values.Value;
  public readonly match: values.Value;
  public readonly ir: Builder;
  public readonly stateType: types.Struct;
  public readonly signature: { [key: string]: types.Signature };
  public readonly INVARIANT_GROUP: values.constants.Metadata;

  constructor(public readonly compilation: Compilation,
              public readonly name: string,
              public readonly fn: Func,
              public readonly nodes: Map<Node, Func>) {
    this.state = this.compilation.stateArg(this.fn);
    this.pos = {
      current: this.compilation.posArg(this.fn),
      next: undefined
    };
    this.endPos = this.compilation.endPosArg(this.fn);
    this.match = this.compilation.matchArg(this.fn);

    // Re-export some properties
    this.ir = this.compilation.ir;
    this.signature = this.compilation.signature;
    this.stateType = this.compilation.state;

    this.INVARIANT_GROUP = ctx.INVARIANT_GROUP;
  }

  debug(body, message) {
    this.compilation.debug(this.fn, body, `${this.name}: ${message}`);
  }

  // Just proxy
  stateField(body, name) {
    return this.compilation.stateField(this.fn, body, name);
  }

  cstring(...args) { return this.compilation.cstring(...args); }
  blob(...args) { return this.compilation.blob(...args); }
  addGlobalConst(...args) { return this.compilation.addGlobalConst(...args); }
  truncate(...args) { return this.compilation.truncate(...args); }
  call(...args) { return this.compilation.call(...args); }
  buildSwitch(...args) { return this.compilation.buildSwitch(...args); }
  branch(...args) { return this.compilation.branch(...args); }
}
