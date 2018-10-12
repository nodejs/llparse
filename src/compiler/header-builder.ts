import * as frontend from 'llparse-frontend';
import source = frontend.source;

export interface IHeaderBuilderOptions {
  readonly prefix: string;
  readonly headerGuard?: string;
  readonly properties: ReadonlyArray<source.Property>;
  readonly spans: ReadonlyArray<frontend.SpanField>;
}

export class HeaderBuilder {
  public build(options: IHeaderBuilderOptions): string {
    let res = '';
    const PREFIX = options.prefix.toUpperCase().replace(/[^a-z]/gi, '_');
    const DEFINE = options.headerGuard === undefined ?
      `INCLUDE_${PREFIX}_H_` : options.headerGuard;

    res += `#ifndef ${DEFINE}\n`;
    res += `#define ${DEFINE}\n`;
    res += '#ifdef __cplusplus\n';
    res += 'extern "C" {\n';
    res += '#endif\n';
    res += '\n';

    res += '#include <stdint.h>\n';
    res += '\n';

    // Structure
    res += `typedef struct ${options.prefix}_s ${options.prefix}_t;\n`;
    res += `struct ${options.prefix}_s {\n`;
    res += '  int32_t _index;\n';

    for (const [ index, field ] of options.spans.entries()) {
      res += `  void* _span_pos${index};\n`;
      if (field.callbacks.length > 1) {
        res += `  void* _span_cb${index};\n`;
      }
    }

    res += '  int32_t error;\n';
    res += '  const char* reason;\n';
    res += '  const char* error_pos;\n';
    res += '  void* data;\n';
    res += '  void* _current;\n';

    for (const prop of options.properties) {
      let ty: string;
      if (prop.ty === 'i8') {
        ty = 'uint8_t';
      } else if (prop.ty === 'i16') {
        ty = 'uint16_t';
      } else if (prop.ty === 'i32') {
        ty = 'uint32_t';
      } else if (prop.ty === 'i64') {
        ty = 'uint64_t';
      } else if (prop.ty === 'ptr') {
        ty = 'void*';
      } else {
        throw new Error(
          `Unknown state property type: "${prop.ty}"`);
      }
      res += `  ${ty} ${prop.name};\n`;
    }
    res += '};\n';

    res += '\n';

    res += `int ${options.prefix}_init(${options.prefix}_t* s);\n`;
    res += `int ${options.prefix}_execute(${options.prefix}_t* s, ` +
      'const char* p, const char* endp);\n';

    res += '\n';
    res += '#ifdef __cplusplus\n';
    res += '}  /* extern "C" *\/\n';
    res += '#endif\n';
    res += `#endif  /* ${DEFINE} *\/\n`;

    return res;
  }
}
