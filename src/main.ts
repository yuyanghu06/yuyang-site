import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, "..", "client"));
  app.useStaticAssets(join(__dirname, "..", "..", "public"), { prefix: "/public" });

  const port = process.env.PORT ?? 3000;
  // Bind to 0.0.0.0 so Railway's reverse proxy can reach the server
  await app.listen(port, "0.0.0.0");
  console.log(`Server running on port ${port}`);
}
bootstrap();
