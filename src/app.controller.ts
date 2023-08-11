import { type Context, type Next } from 'koa';
import { type Pacs002, type Pacs008, type Pain001, type Pain013 } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { loggerService } from '.';
import { handlePacs002, handlePacs008, handlePain001, handlePain013 } from './logic.service';

export const handleExecute = async (ctx: Context, next: Next): Promise<Context> => {
  loggerService.log('Start - Handle execute request');
  try {
    const request = ctx.request.body as Pain001;
    await handlePain001(request);

    ctx.status = 200;
    ctx.body = {
      message: 'Transaction is valid',
      data: request,
    };

    await next();
    return ctx;
  } catch (err) {
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, err as Error, 'ApplicationService');

    ctx.status = 500;
    ctx.body = {
      err,
    };
    return ctx;
  } finally {
    loggerService.log('End - Handle execute request');
  }
};

export const handleQuoteReply = async (ctx: Context, next: Next): Promise<Context> => {
  loggerService.log('Start - Handle quote reply request');
  try {
    const request = ctx.request.body as Pain013;
    handlePain013(request);

    ctx.status = 200;
    ctx.body = {
      message: 'Transaction is valid',
      data: request,
    };

    await next();
    return ctx;
  } catch (err) {
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, err as Error, 'ApplicationService');

    ctx.status = 500;
    ctx.body = failMessage;
    return ctx;
  } finally {
    loggerService.log('End - Handle quote reply request');
  }
};

export const handleTransfer = async (ctx: Context, next: Next): Promise<Context> => {
  loggerService.log('Start - Handle transfer request');
  try {
    const request = ctx.request.body as Pacs008;
    await handlePacs008(request);

    ctx.status = 200;
    ctx.body = {
      message: 'Transaction is valid',
      data: request,
    };

    await next();
    return ctx;
  } catch (err) {
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, err as Error, 'ApplicationService');

    ctx.status = 500;
    ctx.body = {
      err,
    };
    return ctx;
  } finally {
    loggerService.log('End - Handle transfer request');
  }
};

export const handleTransferResponse = async (ctx: Context, next: Next): Promise<Context> => {
  loggerService.log('Start - Handle transfer response request');
  try {
    const request = ctx.request.body as Pacs002;
    await handlePacs002(request);

    ctx.status = 200;
    ctx.body = {
      message: 'Transaction is valid',
      data: request,
    };

    await next();
    return ctx;
  } catch (err) {
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, err as Error, 'ApplicationService');

    ctx.status = 500;
    ctx.body = {
      err,
    };
    return ctx;
  } finally {
    loggerService.log('End - Handle transfer response request');
  }
};

const handleHealthCheck = (ctx: Context): Context => {
  const data = {
    status: 'UP',
  };
  ctx.body = data;

  return ctx;
};

export { handleHealthCheck };
