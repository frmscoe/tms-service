import './apm';
import { LoggerService, type DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';
import { StartupFactory, type IStartupService } from '@frmscoe/frms-coe-startup-lib';
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
    certPath: configuration.cert,
    databaseName: configuration.db.transactionhistorydb,
    user: configuration.db.user,
    password: configuration.db.password,
    url: configuration.db.url,
  },
  pseudonyms: {
    certPath: configuration.cert,
    databaseName: configuration.db.pseudonymsdb,
    user: configuration.db.user,
    password: configuration.db.password,
    url: configuration.db.url,
  },
};

export const loggerService: LoggerService = new LoggerService();
export let server: IStartupService;

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;
let cacheDatabaseClient: CacheDatabaseService;

export const dbInit = async (): Promise<void> => {
  databaseManager = await Singleton.getDatabaseManager(databaseManagerConfig);
  cacheDatabaseClient = await CacheDatabaseService.create(databaseManager, configuration.cacheTTL);
  loggerService.log(JSON.stringify(databaseManager.isReadyCheck()));
};

const connect = async (): Promise<void> => {
  let isConnected = false;
  for (let retryCount = 0; retryCount < 10; retryCount++) {
    loggerService.log(`Connecting to nats server...`);
    if (!(await server.initProducer())) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      loggerService.log(`Connected to nats`);
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

export { cacheDatabaseClient, databaseManager };
