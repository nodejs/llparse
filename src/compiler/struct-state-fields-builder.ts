import * as frontend from 'llparse-frontend';

interface IStructStateField {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export type IStructStateFields = IStructStateField[];

export class StructStateFieldsBuilder {
  public build(options: frontend.IFrontendResult): IStructStateFields {
    const fields: IStructStateFields = [];
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

    return fields;
  }
}
