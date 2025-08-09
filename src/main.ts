import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { envs } from './config';

async function bootstrap() {
  const logger = new Logger(`Payment-Microservice`);
  const app = await NestFactory.create(AppModule, {
    rawBody: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: envs.NATS_SERVERS
    },
  }, { inheritAppConfig: true });

  await app.startAllMicroservices();

  await app.listen(process.env.PORT ?? 3000);

  console.log('Health Check configured');

  logger.log(`Server running on port: ${process.env.PORT}`)
}
bootstrap();
