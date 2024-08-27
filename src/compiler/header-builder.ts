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
    const PREFIX = options.prefix.toUpperCase().replace(/[^a-z]/gi, '_');
    const DEFINE = options.headerGuard ?? `INCLUDE_${PREFIX}_H_`;

    const structure = options.spans.map((field, index) => {
      let spanField = `void* _span_pos${index};`;
      if (field.callbacks.length > 1) {
        spanField += `void* _span_cb${index};`;
      }
      return spanField;
    }).join('\n');

    const properties = options.properties.map(prop => {
      let ty: string;
      switch (prop.ty) {
        case 'i8':
          ty = 'uint8_t';
          break;
        case 'i16':
          ty = 'uint16_t';
          break;
        case 'i32':
          ty = 'uint32_t';
          break;
        case 'i64':
          ty = 'uint64_t';
          break;
        case 'ptr':
          ty = 'void*';
          break;
        default:
          throw new Error(`Unknown state property type: "${prop.ty}"`);
      }
      return `${ty} ${prop.name};`;
    }).join('\n');

    return `#ifndef ${DEFINE}\n#define ${DEFINE}\n` +
      '#ifdef __cplusplus\nextern "C" {\n#endif\n\n' +
      '#include <stdint.h>\n\n' +
      `typedef struct ${options.prefix}_s ${options.prefix}_t;\n` +
      `struct ${options.prefix}_s {\n` +
      '  int32_t _index;\n' +
      `  ${structure}\n` +
      '  int32_t error;\n' +
      '  const char* reason;\n' +
      '  const char* error_pos;\n' +
      '  void* data;\n' +
      '  void* _current;\n' +
      `  ${properties}\n` +
      '};\n\n' +
      `int ${options.prefix}_init(${options.prefix}_t* s);\n` +
      `int ${options.prefix}_execute(${options.prefix}_t* s, const char* p, const char* endp);\n\n` +
      '#ifdef __cplusplus\n}  /* extern "C" */\n#endif\n' +
      `#endif  /* ${DEFINE} */\n`;
  }
}
