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

    // ifdef
    res += `#ifndef ${DEFINE}\n`;
    res += `#define ${DEFINE}\n`;
    res += '#ifdef __cplusplus\n';
    res += 'extern "C" {\n';
    res += '#endif\n';
    res += '\n';

    res += '#include <stdint.h>\n';
    res += '\n';

    // Structure fields
    const fields: Array<{ name: string, size: number, type: string }> = [];
    fields.push({ name: '_index', size: 4, type: 'int32_t' });

    for (const [ index, field ] of options.spans.entries()) {
      fields.push({ name: `_span_pos${index}`, size: -1, type: 'void*' });
      if (field.callbacks.length > 1) {
        fields.push({ name: `_span_cb${index}`, size: -1, type: 'void*' });
      }
    }

    fields.push({ name: 'error', size: 4, type: 'int32_t' });
    fields.push({ name: 'reason', size: -1, type: 'const char*' });
    fields.push({ name: 'error_pos', size: -1, type: 'const char*' });
    fields.push({ name: 'data', size: -1, type: 'void*' });
    fields.push({ name: '_current', size: -1, type: 'void*' });

    for (const { name, ty } of options.properties) {
      if (ty === 'i8') {
        fields.push({ name, size: 1, type: 'uint8_t' });
      } else if (ty === 'i16') {
        fields.push({ name, size: 2, type: 'uint16_t' });
      } else if (ty === 'i32') {
        fields.push({ name, size: 4, type: 'uint32_t' });
      } else if (ty === 'i64') {
        fields.push({ name, size: 8, type: 'uint64_t' });
      } else if (ty === 'ptr') {
        fields.push({ name, size: -1, type: 'void*' });
      } else {
        throw new Error(`Unknown state property type: "${ty}"`);
      }
    }

    // Sort fields from bigger size to lower.
    // Pointers are special, they should be after 8-bytes, but before 4-bytes.
    // In this case align work for 32-bit and 64-bit.
    fields.sort((a, b) => {
      if (a.name === b.name) {
        throw new Error(`Two fields with same name: "${a.name}"`);
      }

      if (a.size === b.size) {
        return a.name < b.name ? -1 : 1;
      }

      if (a.size === -1) {
        return b.size >= 8 ? 1 : -1;
      }

      if (b.size === -1) {
        return a.size >= 8 ? -1 : 1;
      }

      return b.size - a.size;
    });

    // Structure
    res += `typedef struct ${options.prefix}_s ${options.prefix}_t;\n`;
    res += `struct ${options.prefix}_s {\n`;
    for (const { name, type } of fields) {
      res += `  ${type} ${name};\n`;
    }
    res += '};\n';
    res += '\n';

    // Functions: init, execute
    res += `int ${options.prefix}_init(${options.prefix}_t* s);\n`;
    res += `int ${options.prefix}_execute(${options.prefix}_t* s, ` +
      'const char* p, const char* endp);\n';
    res += '\n';

    // endif
    res += '#ifdef __cplusplus\n';
    res += '}  /* extern "C" *\/\n';
    res += '#endif\n';
    res += `#endif  /* ${DEFINE} *\/\n`;

    return res;
  }
}
