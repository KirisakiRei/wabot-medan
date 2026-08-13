
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: true
    });
    const errors = await validate(object);

    if (errors.length > 0) {
      throw new BadRequestException(this.formatErrors(errors));
    }

    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[], prefix = ''): any[] {
    const result: any[] = [];

    errors.forEach(err => {
      const fieldName = prefix ? `${prefix}.${err.property}` : err.property;
      
      // Jika ada constraints (error messages)
      if (err.constraints) {
        result.push({
          field: fieldName,
          errors: Object.values(err.constraints),
        });
      }

      // Jika ada nested errors (validateNested)
      if (err.children && err.children.length > 0) {
        const nestedErrors = this.formatErrors(err.children, fieldName);
        result.push(...nestedErrors);
      }
    });

    return result;
  }
}
