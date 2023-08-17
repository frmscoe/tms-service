/* eslint-disable @typescript-eslint/no-explicit-any */
import Fastify, { type FastifyInstance } from 'fastify';
import { fastifySwagger } from '@fastify/swagger';
import { fastifyCors } from '@fastify/cors';
import Routes from '../router';

const fastify = Fastify();

export default async function initializeFastifyClient(): Promise<FastifyInstance> {
  fastify.register(fastifySwagger, {
    specification: {
      path: './build/swagger.yaml',
      postProcessor: function (swaggerObject) {
        return swaggerObject;
      },
      baseDir: '../../',
    },
    prefix: '/swagger',
  });
  await fastify.register(fastifyCors, {
    hook: 'preHandler',
    delegator: (req, callback) => {
      const corsOptions = {
        origin: true,
      };
      if (/^localhost$/m.test(req.headers.origin ?? '')) {
        corsOptions.origin = false;
      }
      callback(null, corsOptions);
    },
  });
  fastify.register(Routes);
  await fastify.ready();
  fastify.swagger();
  return await fastify;
}

export async function destroyFasityClient(): Promise<void> {
  await fastify.close();
}
