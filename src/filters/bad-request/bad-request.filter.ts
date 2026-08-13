import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

interface ValidationError {
  property: string;
  constraints?: { [key: string]: string };
  children?: ValidationError[];
}

@Catch(BadRequestException)
export class BadRequestFilter<T> implements ExceptionFilter<BadRequestException> {
  /**
   * Recursively flatten nested validation errors into a structured object
   */
  private flattenValidationErrors(errors: ValidationError[], prefix = ''): Record<string, string | Record<string, any>> {
    const result: Record<string, string | Record<string, any>> = {};

    errors.forEach((error) => {
      const key = prefix ? `${prefix}.${error.property}` : error.property;

      if (error.constraints) {
        // Jika ada constraints, simpan pesan error
        result[key] = Object.values(error.constraints).join(', ');
      }

      if (error.children && error.children.length > 0) {
        // Jika ada nested errors (validateNested), flatten recursively
        const nestedErrors = this.flattenValidationErrors(error.children, key);
        Object.assign(result, nestedErrors);
      }
    });

    return result;
  }

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();

    const exceptionResponse = exception.getResponse() as
      | { message: string | string[] | ValidationError[] | any[]; error?: string; statusCode?: number }
      | string;

    let errors: any = {};

    if (typeof exceptionResponse === 'object') {
      const message = exceptionResponse['message'];

      if (Array.isArray(message)) {
        // Cek apakah array of ValidationError objects (dari class-validator)
        if (message.length > 0 && typeof message[0] === 'object') {
          // Cek format: apakah standard ValidationError atau custom format { field, errors }
          if ('property' in message[0]) {
            // Format standard ValidationError (dengan property)
            errors = this.flattenValidationErrors(message as ValidationError[]);
          } else if ('field' in message[0] && 'errors' in message[0]) {
            // Format custom dari ValidationPipe (dengan field dan errors)
            message.forEach((item: any) => {
              const errorMessages = Array.isArray(item.errors) 
                ? item.errors.join(', ')
                : item.errors;
              errors[item.field] = errorMessages;
            });
          } else {
            // Fallback ke array biasa
            errors = message;
          }
        } else {
          // Ini adalah array of string messages
          errors = message;
        }
      } else if (typeof message === 'string') {
        // Single string message
        errors = [message];
      } else {
        // Fallback untuk error object lainnya
        errors = message ?? exceptionResponse;
      }
    } else if (typeof exceptionResponse === 'string') {
      // Kalau benar-benar string
      errors = [exceptionResponse];
    }

    return response.status(400).send({
      status: "error",
      code: 400,
      message: "Terjadi error bad request",
      error: errors
    });
  }
}
