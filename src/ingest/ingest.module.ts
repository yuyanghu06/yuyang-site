import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService }    from "./ingest.service";

/**
 * IngestModule
 * ------------
 * Admin-only module for ingesting PDFs and raw text into Pinecone.
 * Protected by IngestGuard (static key auth) at the controller level.
 */
@Module({
  controllers: [IngestController],
  providers:   [IngestService],
})
export class IngestModule {}
