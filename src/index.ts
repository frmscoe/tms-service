// SPDX-License-Identifier: Apache-2.0
import './apm';
import { LoggerService, type DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';
import { StartupFactory, type IStartupService } from '@frmscoe/frms-coe-startup-lib';
import cluster from 'cluster';
import os from 'os';
import { CacheDatabaseService } from './clients/cache-database';
import initializeFastifyClient from './clients/fastify';
import { configuration } from './config';
import { Singleton } from './utils/services';

const databaseManagerConfig = {
  redisConfig: {
    db: configuration.redis.db,
    servers: configuration.redis.servers,
    password: configuration.redis.password,
    isCluster: configuration.redis.isCluster,
  },
  transactionHistory: {
    certPath: configuration.transactionHistoryCertPath,
    databaseName: configuration.transactionHistoryName,
    user: configuration.transactionHistoryUser,
    password: configuration.transactionHistoryPassword,
    url: configuration.transactionHistoryURL,
  },
  pseudonyms: {
    certPath: configuration.pseudonymsCertPath,
    databaseName: configuration.graphDb,
    user: configuration.pseudonymsUser,
    password: configuration.pseudonymsPassword,
    url: configuration.pseudonymsURL,
  },
};

export const loggerService: LoggerService = new LoggerService(configuration.sidecarHost);
export let server: IStartupService;

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;
let cacheDatabaseClient: CacheDatabaseService;

export const dbInit = async (): Promise<void> => {
  databaseManager = await Singleton.getDatabaseManager(databaseManagerConfig);
  cacheDatabaseClient = await CacheDatabaseService.create(databaseManager, configuration.cacheTTL);
  console.log(JSON.stringify(databaseManager.isReadyCheck()));
};

const connect = async (): Promise<void> => {
  let isConnected = false;
  for (let retryCount = 0; retryCount < 10; retryCount++) {
    console.log(`Connecting to nats server...`);
    if (!(await server.initProducer())) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      console.log(`Connected to nats`);
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
      console.error(err);
      throw Error(`${err.message}`);
    }
    console.log(`Fastify listening on ${address}`);
  });
};

export const runServer = async (): Promise<void> => {
  server = new StartupFactory();
  if (configuration.env !== 'test') await connect();
};

process.on('uncaughtException', (err) => {
  console.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  console.error(`process on unhandledRejection error: ${JSON.stringify(err) ?? '[NoMetaData]'}`);
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
      console.error(`Error while starting NATS server on Worker ${process.pid}`, err);
      process.exit(1);
    }
  })();
}

export { cacheDatabaseClient, databaseManager };
