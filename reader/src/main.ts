import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ✅ Enable CORS for everything (static and dynamic)
  app.enableCors({
    origin: '*', // or 'https://127.0.0.1:5500' for stricter security
  });

  app.useStaticAssets(join(__dirname, '..', 'public'));

  await app.listen(3000, '0.0.0.0');
  console.log(`🚀 Server running at https://localhost:3000`);
}
bootstrap();