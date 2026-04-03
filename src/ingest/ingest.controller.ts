import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IngestGuard }   from "./ingest.guard";
import { IngestService } from "./ingest.service";

@Controller("api/ingest")
@UseGuards(IngestGuard)
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  /**
   * POST /api/ingest/pdf
   * Accepts a single PDF file as multipart/form-data.
   * Extracts text, chunks, embeds, and upserts to Pinecone.
   */
  @Post("pdf")
  @UseInterceptors(FileInterceptor("file"))
  async ingestPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; chunksCreated: number }> {
    if (!file) {
      throw new BadRequestException("No file uploaded — expected a 'file' field with a PDF");
    }

    if (!file.originalname.toLowerCase().endsWith(".pdf")) {
      throw new BadRequestException("Only PDF files are accepted");
    }

    const chunksCreated = await this.ingestService.ingestPdf(file.buffer, file.originalname);
    return { success: true, chunksCreated };
  }

  /**
   * POST /api/ingest/text
   * Accepts JSON with raw text and an optional source label.
   * Chunks, embeds, and upserts to Pinecone.
   */
  @Post("text")
  async ingestText(
    @Body() body: { text: string; source?: string },
  ): Promise<{ success: boolean; chunksCreated: number }> {
    if (!body?.text || typeof body.text !== "string" || body.text.trim().length === 0) {
      throw new BadRequestException("'text' field is required and must be non-empty");
    }

    const chunksCreated = await this.ingestService.ingestText(body.text, body.source ?? "manual");
    return { success: true, chunksCreated };
  }
}
