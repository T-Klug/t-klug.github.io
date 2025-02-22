---
title: Enhancing Document Analysis with AI-Powered PDF Highlighting
date: 2025-02-22
categories: [LLM, ToolUse]
tags: [llm, tooluse, typescript]     # TAG names should always be lowercase
author: TJ
image: /assets/img/tooluse.jpeg
---




Modern document analysis often demands a blend of precision and automation. In this post, I demonstrate how to leverage AWS SDKs, Bedrock AI, and pdf-lib to analyze a PDF file, identify key evaluation criteria, and highlight important sections automatically.

### Overview

This solution retrieves a PDF from an S3 bucket, sends it for AI analysis using Bedrock’s conversational model, and applies highlights directly to the PDF using pdf-lib. The code includes a coordinate conversion function to map AI-provided bounding boxes to the PDF’s dimensions, ensuring highlights appear correctly regardless of page size.

### The TypeScript Implementation

The complete TypeScript script below encapsulates the logic. It includes:

- **Coordinate Conversion:** Converts bounding box coordinates from the AI model’s assumed dimensions to actual PDF dimensions.
- **PDF Highlighting:** Uses pdf-lib to draw translucent yellow rectangles and red text annotations on the PDF.
- **AI Analysis Loop:** Interacts with the Bedrock AI to retrieve insights and determine which areas of the document to highlight.
- **S3 Integration:** Downloads the original PDF from S3, applies the highlights, and uploads the modified document back to S3.

```typescript
/* eslint-disable max-len */
import { BedrockRuntime, Message, ConversationRole, ToolResultBlock } from '@aws-sdk/client-bedrock-runtime';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AwsCredentialIdentity } from '@aws-sdk/types';;
import util from 'util';
import path from 'path';
import { PDFAIAnalysisRequest } from '../../model/public/requests';
import { PDFAnalysisResponse } from '../../sdk';
import { PDFDocument, rgb } from 'pdf-lib';


type HighlightType = {
    xCoordinate: number;
    yCoordinate: number;
    width: number;
    height: number;
    pageNumber: number;
    reason: string;
};

const contextPrompt = `Please analyze how this document aligns with these evaluation criteria:
<Criteria>
%s
</Criteria>

Provide a brief assessment (2-3 sentences) focusing on the most notable alignments or gaps. Then select 3-4 key observations that best illustrate your evaluation, avoiding an exhaustive review of every criterion.
Also highlight any areas where the document excels or falls short, and note any criteria that received insufficient attention. Utilize the highlight_pdf tool, for each key observation, to highlight the relevant text in the document.

Consider:
- What aspects particularly stand out (either positively or negatively)?
- Where are the most significant gaps or strengths?
- Which criteria received insufficient attention?

Note: Focus on clear patterns rather than attempting to find evidence for every criterion.`;

const highlightColor = rgb(1, 1, 0);

/**
 * Converts LLM bounding box coordinates (assuming a 612×792 PDF)
 * to actual PDF coordinates using the page's real dimensions.
 *
 * @param llmX - The X coordinate from the LLM.
 * @param llmY - The Y coordinate from the LLM.
 * @param llmW - The width from the LLM bounding box.
 * @param llmH - The height from the LLM bounding box.
 * @param actualPdfWidth - The actual PDF page width in points.
 * @param actualPdfHeight - The actual PDF page height in points.
 * @param assumedLLMWidth - (Optional) The assumed PDF width used by the LLM (default 612).
 * @param assumedLLMHeight - (Optional) The assumed PDF height used by the LLM (default 792).
 *
 * @returns An object containing the converted PDF coordinates.
 */
function convertLLMToPDFCoords(
    llmX: number,
    llmY: number,
    llmW: number,
    llmH: number,
    actualPdfWidth: number,
    actualPdfHeight: number,
    assumedLLMWidth = 612,
    assumedLLMHeight = 792,
): { pdfX: number; pdfY: number; pdfW: number; pdfH: number } {
    const xScale = actualPdfWidth / assumedLLMWidth;
    const yScale = actualPdfHeight / assumedLLMHeight;

    const pdfX = llmX * xScale;
    const pdfW = llmW * xScale;
    const pdfH = llmH * yScale;

    // Adjust Y-axis correctly: invert only once
    const pdfY = actualPdfHeight - (llmY + llmH) * yScale;

    return { pdfX, pdfY, pdfW, pdfH };
}

/**
 * Highlight a PDF file
 * @param highlights Highlights to apply to the PDF
 * @param pdfDocument PDF file
 */
const highlightPdf = (highlights: HighlightType[], pdfDocument: PDFDocument): void => {
    for (const highlight of highlights) {
        const pdfPage = pdfDocument.getPage(highlight.pageNumber - 1);
        const { xCoordinate, yCoordinate, width, height } = highlight;
        const { pdfX, pdfY, pdfW, pdfH } = convertLLMToPDFCoords(xCoordinate, yCoordinate, width, height, pdfPage.getWidth(), pdfPage.getHeight());
        pdfPage.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: highlightColor,
            opacity: 0.3,
        });
        // Move text to the left margin
        const marginX = 5; // Position closer to the left margin
        const textY = pdfY + pdfH; // Align text with highlight center

        if (highlight.reason) {
            pdfPage.drawText(highlight.reason, {
                x: marginX,
                y: textY,
                size: 10,
                lineHeight: 10,
                color: rgb(1, 0, 0), // Red text for visibility
                maxWidth: 50, // Limit width to prevent wrapping issues
            });
        }
    }
};

/**
 * Get insights from a PDF file using AI
 * @param param0.s3Bucket S3 bucket name
 * @param param0.s3Key S3 key of the PDF file
 * @param param0.context Context for the analysis
 * @param param0.prompt Prompt for the analysis
 * @param param0.companyId Company ID
 * @param param0.credentials AWS credentials
 * @returns {Promise<PDFAnalysisResponse>}
 */
export async function getPDFAIInsights({
    credentials,
    s3Bucket,
    s3Key,
    context,
    prompt,
}: PDFAIAnalysisRequest & { companyId: string; credentials: AwsCredentialIdentity }): Promise<PDFAnalysisResponse> {
    const s3 = new S3Client({ credentials });
    const bedrockRuntime = new BedrockRuntime();

    // Get PDF from S3
    const response = await s3.send(new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
    if (response.ContentType !== 'application/pdf') {
        throw new Error('File is not a PDF');
    }
    const pdfBytes = await response.Body?.transformToByteArray();

    if (!pdfBytes) {
        throw new Error('Could not read PDF file');
    }

    // Initial analysis
    const initialMessages: Message[] = [
        {
            role: ConversationRole.USER,
            content: [
                {
                    document: {
                        format: 'pdf',
                        source: { bytes: pdfBytes },
                        name: path.basename(s3Key).replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, ''),
                    },
                },
                { text: prompt ?? util.format(contextPrompt, context) },
            ],
        },
    ];

    const highlights: HighlightType[] = [];

    // Create the tool to call
    const highlight = ({
        xCoordinate,
        yCoordinate,
        width,
        height,
        pageNumber,
        toolUseId,
        reason,
    }: HighlightType & { toolUseId: string | undefined }): ToolResultBlock => {
        logger.debug(`Highlighting ${reason} at ${xCoordinate}, ${yCoordinate} on page ${pageNumber}`);
        highlights.push({ xCoordinate, yCoordinate, width, height, pageNumber, reason });
        return {
            toolUseId,
            content: [{ text: 'Highlighted' }],
        };
    };

    // Setup the loop to call the model.
    let stopReason;
    let analysisResult;
    do {
        analysisResult = await bedrockRuntime.converse({
            modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            messages: initialMessages,
            toolConfig: {
                tools: [
                    {
                        toolSpec: {
                            name: 'highlight_pdf',
                            description: 'Highlight a text area of the pdf',
                            inputSchema: {
                                json: {
                                    type: 'object',
                                    properties: {
                                        xCoordinate: {
                                            type: 'number',
                                            description: 'The x coordinate of the top left corner of the rectangle to highlight',
                                        },
                                        yCoordinate: {
                                            type: 'number',
                                            description: 'The y coordinate of the top left corner of the rectangle to highlight',
                                        },
                                        width: {
                                            type: 'number',
                                            description: 'The width of the rectangle to highlight',
                                        },
                                        height: {
                                            type: 'number',
                                            description: 'The height of the rectangle to highlight',
                                        },
                                        pageNumber: {
                                            type: 'number',
                                            description: 'The page number of the pdf',
                                        },
                                        reason: {
                                            type: 'string',
                                            description: 'The reason for the highlight',
                                        },
                                    },
                                    required: ['xCoordinate', 'yCoordinate', 'width', 'height', 'pageNumber', 'reason'],
                                },
                            },
                        },
                    },
                ],
            },
        });
        // Set the stop reason
        stopReason = analysisResult.stopReason;
        // Add any messages from the output to the original messages
        if (analysisResult.output?.message) initialMessages.push(analysisResult.output?.message);
        // If the stop reason is tool_use, call the highlight
        if (analysisResult.stopReason === 'tool_use' && analysisResult.output?.message?.content) {
            const toolInput = analysisResult.output?.message?.content[1].toolUse?.input as { [key: string]: number };
            const { xCoordinate, yCoordinate, width, height, pageNumber, reason } = toolInput;
            const toolResult = highlight({
                xCoordinate,
                yCoordinate,
                width,
                height,
                pageNumber,
                toolUseId: analysisResult.output?.message?.content[1].toolUse?.toolUseId,
                reason: reason as unknown as string,
            });
            // Push the tool use result to the messages
            initialMessages.push({
                role: ConversationRole.USER,
                content: [
                    {
                        toolResult: toolResult,
                    },
                ],
            });
        }
    } while (stopReason !== 'end_turn');
   
    // Open the doc and highlight the text
    const pdfDoc = await PDFDocument.load(pdfBytes);
    highlightPdf(highlights, pdfDoc);
   
    // Save the doc and upload it to S3
    const modifiedPdfBytes = await pdfDoc.save();
    const highlightedPdfKey = `${s3Key.replace('.pdf', '')}_highlighted.pdf`;
    await s3.send(
        new PutObjectCommand({
            Bucket: s3Bucket,
            Key: highlightedPdfKey,
            Body: modifiedPdfBytes,
            ContentType: 'application/pdf',
        }),
    );

    return {
        analysis: analysisResult.output?.message?.content![0].text as string,
        highlightedPdfKey,
    };
}
```

### How It Works

1. **S3 and PDF Retrieval:**  
   The script uses `GetObjectCommand` to fetch the PDF from an S3 bucket and confirms its format.

2. **AI-Driven Analysis:**  
   It constructs an initial message containing both the document and a custom prompt. A loop continuously interacts with Bedrock’s conversational model until the analysis is complete, dynamically processing tool requests to highlight document sections.

3. **Highlight Application:**  
   The `highlightPdf` function iterates over collected highlights, converting AI-provided coordinates to actual PDF positions and drawing translucent rectangles with annotations.

4. **PDF Update:**  
   After highlighting, the modified PDF is saved and uploaded back to S3 using `PutObjectCommand`.

### Conclusion

This implementation presents a forward-thinking approach to integrating AI-powered insights into document workflows. By combining AWS SDK capabilities, Bedrock AI for natural language processing, and pdf-lib for direct PDF manipulation, teams can automate the extraction and visualization of key insights, streamlining the review process and enhancing overall efficiency.