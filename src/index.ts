import './apm';
import { CreateDatabaseManager, LoggerService, type DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';
import { StartupFactory, type IStartupService } from '@frmscoe/frms-coe-startup-lib';
import cluster from 'cluster';
import os from 'os';
import { configuration } from './config';
import { ServicesContainer, initCacheDatabase } from './services-container';
import App from './clients/koa';

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
};

export const loggerService: LoggerService = new LoggerService();
export let server: IStartupService;

export const cache = ServicesContainer.getCacheInstance();
let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;

export const dbinit = async (): Promise<void> => {
  databaseManager = await CreateDatabaseManager(databaseManagerConfig);
};

const connect = async (): Promise<void> => {
  for (let retryCount = 0; retryCount < 10; retryCount++) {
    loggerService.log(`Connecting to nats server...`);
    if (!(await server.initProducer())) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      loggerService.log(`Connected to nats`);
      break;
    }
  }
  // Koa
  const app = new App();
  app.listen(configuration.port, () => {
    loggerService.log(`API restServer listening on PORT ${configuration.port}`);
  });
};

export const runServer = async (): Promise<void> => {
  await dbinit();
  await initCacheDatabase(configuration.cacheTTL, databaseManager); // Deprecated - please use dbinit and the databasemanger for all future development.
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
        await runServer();
      }
    } catch (err) {
      loggerService.error(`Error while starting NATS server on Worker ${process.pid}`, err);
    }
  })();
}

export { databaseManager };
