import * as z from 'zod';

export const resumeSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    role: z.string().optional(),
    photoUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
    phone: z.string().optional(),
    email: z.string().email({ message: "A valid email is required." }),
    address: z.string().optional(),
    linkedIn: z.string().optional(),
    github: z.string().optional(),
    objective: z.string().optional(),
    education: z.array(z.object({
        degree: z.string().min(1, "Degree is required"),
        institution: z.string().min(1, "Institution is required"),
        year: z.string().optional(),
        cgpa: z.string().optional(),
    })),
    skills: z.array(z.object({
        value: z.string().min(1, "Skill cannot be empty"),
    })),
    projects: z.array(z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional(),
        technologies: z.string().optional(),
    })),
    achievements: z.array(z.object({
        value: z.string().min(1, "Achievement cannot be empty"),
    })),
});

export type ResumeFormValues = z.infer<typeof resumeSchema>;
