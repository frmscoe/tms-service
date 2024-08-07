// SPDX-License-Identifier: Apache-2.0
import './apm';
import { LoggerService, type ManagerConfig } from '@frmscoe/frms-coe-lib';
import { StartupFactory, type IStartupService } from '@frmscoe/frms-coe-startup-lib';
import cluster from 'cluster';
import os from 'os';
import { CacheDatabaseService } from './clients/cache-database';
import initializeFastifyClient from './clients/fastify';
import { configuration } from './config';

const databaseManagerConfig = configuration.db;

export const loggerService: LoggerService = new LoggerService(configuration.sidecarHost);
export let server: IStartupService;

let cacheDatabaseManager: CacheDatabaseService<ManagerConfig>;

export const dbInit = async (): Promise<void> => {
  cacheDatabaseManager = await CacheDatabaseService.create(databaseManagerConfig, configuration.cacheTTL);
  loggerService.log(JSON.stringify(cacheDatabaseManager.isReadyCheck()));
};

const connect = async (): Promise<void> => {
  let isConnected = false;
  for (let retryCount = 0; retryCount < 10; retryCount++) {
    loggerService.log('Connecting to nats server...');
    if (!(await server.initProducer())) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      loggerService.log('Connected to nats');
      isConnected = true;
      break;
    }
  }

  if (!isConnected) {
    throw new Error('Unable to connect to nats after 10 retries');
  }

  const fastify = await initializeFastifyClient();
  fastify.listen({ port: configuration.port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      loggerService.error(err);
      throw Error(`${err.message}`);
    }

    loggerService.log(`Fastify listening on ${address}`);
  });
};

export const runServer = async (): Promise<void> => {
  server = new StartupFactory();
  if (configuration.env !== 'test') await connect();
};

process.on('uncaughtException', (err) => {
  loggerService.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  loggerService.error(`process on unhandledRejection error: ${JSON.stringify(err) ?? '[NoMetaData]'}`);
});

const numCPUs = os.cpus().length > configuration.maxCPU ? configuration.maxCPU + 1 : os.cpus().length + 1;

if (cluster.isPrimary && configuration.maxCPU !== 1) {
  for (let i = 1; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    cluster.fork();
  });
} else {
  (async () => {
    try {
      if (process.env.NODE_ENV !== 'test') {
        await dbInit();
        await runServer();
      }
    } catch (err) {
      loggerService.error(`Error while starting NATS server on Worker ${process.pid}`, err);
      process.exit(1);
    }
  })();
}

export { cacheDatabaseManager };
