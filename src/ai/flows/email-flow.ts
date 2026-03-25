
'use server';
/**
 * @fileOverview A Genkit flow for sending an invoice email.
 * This file is marked as a server-only module.
 */
import { ai } from '@/ai/ai';
import { z } from 'zod';

// Define the schema for the invoice data
const InvoiceSchema = z.object({
  studentName: z.string(),
  studentEmail: z.string().email(),
  invoiceNumber: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  totalAmount: z.number(),
  items: z.array(z.object({
    description: z.string(),
    amount: z.number(),
  })),
});

export type InvoiceData = z.infer<typeof InvoiceSchema>;

// Define the schema for the flow input, which is the invoice data
const EmailInputSchema = InvoiceSchema;

const EmailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Define the prompt for generating the email content
const emailPrompt = ai.definePrompt({
    name: 'invoiceEmailPrompt',
    input: { schema: InvoiceSchema },
    prompt: `
        Generate a professional email to send an invoice to a student.
        The email should be friendly and clear.

        Here is the invoice data:
        Student Name: {{studentName}}
        Invoice Number: {{invoiceNumber}}
        Total Amount: {{totalAmount}}
        Issue Date: {{issueDate}}
        Due Date: {{dueDate}}
        
        Items:
        {{#each items}}
        - {{description}}: {{amount}}
        {{/each}}
        
        The subject of the email should be: "Invoice {{invoiceNumber}} from EduSphere Institute"
        
        The body of the email should be:
        "Dear {{studentName}},

        Please find attached your invoice ({{invoiceNumber}}) for the amount of ₹{{totalAmount}}.

        This email confirms that your payment has been successfully processed. No further action is required from your side.
        
        Thank you for your prompt payment.

        Best regards,
        EduSphere Institute Accounts Department"
    `,
});


// Define the flow for sending the email
const sendInvoiceEmailFlow = ai.defineFlow(
  {
    name: 'sendInvoiceEmailFlow',
    inputSchema: EmailInputSchema,
    outputSchema: EmailOutputSchema,
  },
  async (invoiceData) => {
    // In a real application, you would integrate with an email sending service (e.g., SendGrid, Mailgun)
    // For this example, we will just log the generated email content to the console.
    
    console.log(`Simulating sending email to: ${invoiceData.studentEmail}`);

    const { text: emailContent } = await emailPrompt(invoiceData);

    console.log("--- Email Content ---");
    console.log(emailContent);
    console.log("---------------------");

    // Simulate a successful email send
    return {
      success: true,
      message: `Successfully simulated sending invoice to ${invoiceData.studentEmail}`,
    };
  }
);


export async function sendInvoiceEmail(invoiceData: InvoiceData): Promise<{ success: boolean; message: string; }> {
  const result = await sendInvoiceEmailFlow(invoiceData);
  return result;
}

