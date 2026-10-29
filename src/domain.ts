export const SERVICES = [
  {
    id: "grant",
    title: "Grant Request",
    summary: "Request funding for a community project or public-interest idea.",
    reviewNote: "A grant officer would normally review your project plan and budget.",
    nextStep: "Keep your project plan and budget ready for a future review.",
  },
  {
    id: "relief",
    title: "Relief Request",
    summary: "Ask for temporary support after a disruption or unexpected hardship.",
    reviewNote: "A support team would normally review your situation and supporting records.",
    nextStep: "Keep any supporting records together in case a reviewer needs them.",
  },
  {
    id: "subsidy",
    title: "Subsidy Application",
    summary: "Apply for help with the cost of an eligible activity or service.",
    reviewNote: "A program team would normally check the application against its published rules.",
    nextStep: "Check the relevant program guidance before preparing a real application.",
  },
  {
    id: "loan-guarantee",
    title: "Loan Guarantee Application",
    summary: "Request a demonstration review of a business loan guarantee application.",
    reviewNote: "A financial reviewer would normally assess the request and its supporting information.",
    nextStep: "Prepare your financing details for a future conversation with a program team.",
  },
] as const;

export type ServiceId = (typeof SERVICES)[number]["id"];

export const OUTCOMES = [
  {
    id: "potentially-eligible",
    label: "Potentially Eligible",
    description:
      "This simulated result suggests your request could be a fit for further review. It is not an eligibility check or an approval.",
    nextStep:
      "A real program would confirm its criteria and review the complete application.",
  },
  {
    id: "additional-documents",
    label: "Additional Documents Needed",
    description:
      "This simulated result suggests more information may be needed. No uploaded document was opened or analyzed.",
    nextStep:
      "A real program would tell you exactly which documents, if any, are required.",
  },
  {
    id: "manual-review",
    label: "Manual Review Required",
    description:
      "This simulated result suggests a person should review the request. No decision has been made.",
    nextStep:
      "A real program would contact you with its review process and timeline.",
  },
] as const;

export type OutcomeId = (typeof OUTCOMES)[number]["id"];
export type Outcome = (typeof OUTCOMES)[number];

export interface AttachmentMetadata {
  name: string;
  type: string;
  size: number;
}

export interface ApplicationRecord {
  reference: string;
  serviceId: ServiceId;
  applicantName: string;
  title: string;
  description: string;
  requestedAmount: number;
  attachments: AttachmentMetadata[];
  outcomeId: OutcomeId;
  submittedAt: string;
}

export interface ApplicationSubmission {
  serviceId: ServiceId;
  applicantName: string;
  title: string;
  description: string;
  requestedAmount: number;
  attachments: File[];
}

export function getService(serviceId: ServiceId) {
  return SERVICES.find((service) => service.id === serviceId)!;
}

export function getOutcome(outcomeId: OutcomeId): Outcome {
  return OUTCOMES.find((outcome) => outcome.id === outcomeId)!;
}
