import * as frontend from 'llparse-frontend';
import { IStructStateFields } from './struct-state-fields-builder';

export class HeaderBuilder {
  public build(headerGuard: string | undefined,
               fields: IStructStateFields,
               options: frontend.IFrontendResult): string {
    let res = '';
    const PREFIX = options.prefix.toUpperCase().replace(/[^a-z]/gi, '_');
    const DEFINE = headerGuard === undefined ?
      `INCLUDE_${PREFIX}_H_` : headerGuard;

    // ifdef
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
