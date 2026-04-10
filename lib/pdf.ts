import pdf from "pdf-parse";

const MAX_TEXT_LENGTH = 12000;

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parsed = await pdf(buffer);

  return parsed.text.slice(0, MAX_TEXT_LENGTH).trim();
}
