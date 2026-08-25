import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { publicErrorMessage } from '@slotlyflow/security';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const typedCode = typeof exceptionResponse === 'object' && exceptionResponse !== null && 'code' in exceptionResponse && typeof exceptionResponse.code === 'string'
      ? exceptionResponse.code
      : undefined;
    const errorCode = typedCode ?? (
      statusCode === HttpStatus.SERVICE_UNAVAILABLE
        ? 'DEPENDENCY_UNAVAILABLE'
        : statusCode >= 500
          ? 'INTERNAL_ERROR'
          : 'REQUEST_REJECTED'
    );

    if (statusCode >= 500) {
      request.log.error(
        { correlation_id: request.id, request_id: request.id, error_code: errorCode },
        'request failed',
      );
    }

    response.status(statusCode).send({
      error: {
        code: errorCode,
        message: publicErrorMessage(statusCode),
      },
      correlationId: request.id,
    });
  }
}
