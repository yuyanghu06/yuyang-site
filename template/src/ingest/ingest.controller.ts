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

  @Post("markdown")
  @UseInterceptors(FileInterceptor("file"))
  async ingestMarkdown(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; chunksCreated: number }> {
    if (!file) {
      throw new BadRequestException("No file uploaded — expected a 'file' field with a Markdown file");
    }

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith(".md") && !filename.endsWith(".markdown")) {
      throw new BadRequestException("Only Markdown files (.md or .markdown) are accepted");
    }

    const text = file.buffer.toString("utf-8");
    const chunksCreated = await this.ingestService.ingestText(text, file.originalname);
    return { success: true, chunksCreated };
  }

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
