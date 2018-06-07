/*
export class HeaderBuilder {
  public buildHeader(): string {
    let res = '';
    const PREFIX = this.prefix.toUpperCase().replace(/[^a-z]/gi, '_');
    const DEFINE = this.options.headerGuard === undefined ?
      `INCLUDE_${PREFIX}_H_` : this.options.headerGuard;

    res += `#ifndef ${DEFINE}\n`;
    res += `#define ${DEFINE}\n`;
    res += '#ifdef __cplusplus\n';
    res += 'extern "C" {\n';
    res += '#endif\n';
    res += '\n';

    res += '#include <stdint.h>\n';
    res += '\n';

    // Structure
    res += `typedef struct ${this.prefix}_s ${this.prefix}_t;\n`;
    res += `struct ${this.prefix}_s {\n`;
    for (const field of this.state.fields) {
      let ty: string;
      if (field.name === constants.STATE_REASON ||
          field.name === constants.STATE_ERROR_POS) {
        ty = 'const char*';
      } else if (field.ty.isEqual(constants.I8)) {
        ty = 'int8_t';
      } else if (field.ty.isEqual(constants.I16)) {
        ty = 'int16_t';
      } else if (field.ty.isEqual(constants.I32)) {
        ty = 'int32_t';
      } else if (field.ty.isEqual(constants.I64)) {
        ty = 'int64_t';
      } else if (field.name === constants.STATE_CURRENT ||
                 field.ty.isEqual(constants.PTR) ||
                 field.ty.isEqual(this.signature.callback.span)) {
        ty = 'void*';
      } else {
        throw new Error(
          `Unknown state property type: "${field.ty.typeString}"`);
      }
      res += `  ${ty} ${field.name};\n`;
    }
    res += '};\n';

    res += '\n';

    res += `int ${this.prefix}_init(${this.prefix}_t* s);\n`;
    res += `int ${this.prefix}_execute(${this.prefix}_t* s, ` +
      'const char* p, const char* endp);\n';

    res += '\n';
    res += '#ifdef __cplusplus\n';
    res += '}  /* extern "C" *\/\n';
    res += '#endif\n';
    res += `#endif  /* ${DEFINE} *\/\n`;

    return res;
  }
}
*/
