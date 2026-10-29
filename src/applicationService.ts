import {
  OUTCOMES,
  SERVICES,
  type ApplicationRecord,
  type ApplicationSubmission,
  type AttachmentMetadata,
  type OutcomeId,
  type ServiceId,
} from "./domain";

const STORAGE_KEY = "civic-portal-demo:applications";
const STORAGE_VERSION = 1;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "jpg", "jpeg", "png"]);

export class ApplicationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationValidationError";
  }
}

export class ApplicationStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationStorageError";
  }
}

export interface ApplicationService {
  submit(submission: ApplicationSubmission): Promise<ApplicationRecord>;
  list(): Promise<ApplicationRecord[]>;
  get(reference: string): Promise<ApplicationRecord | undefined>;
  clear(): Promise<void>;
}

interface StoredApplications {
  version: number;
  applications: ApplicationRecord[];
}

type StorageProvider = () => Storage;

function isServiceId(value: unknown): value is ServiceId {
  return SERVICES.some((service) => service.id === value);
}

function isOutcomeId(value: unknown): value is OutcomeId {
  return OUTCOMES.some((outcome) => outcome.id === value);
}

function isAttachment(value: unknown): value is AttachmentMetadata {
  if (!value || typeof value !== "object") return false;
  const attachment = value as Record<string, unknown>;
  return (
    typeof attachment.name === "string" &&
    typeof attachment.type === "string" &&
    typeof attachment.size === "number" &&
    Number.isFinite(attachment.size) &&
    attachment.size >= 0
  );
}

function isApplicationRecord(value: unknown): value is ApplicationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.reference === "string" &&
    isServiceId(record.serviceId) &&
    typeof record.applicantName === "string" &&
    typeof record.title === "string" &&
    typeof record.description === "string" &&
    typeof record.requestedAmount === "number" &&
    Number.isFinite(record.requestedAmount) &&
    Array.isArray(record.attachments) &&
    record.attachments.every(isAttachment) &&
    isOutcomeId(record.outcomeId) &&
    typeof record.submittedAt === "string" &&
    Number.isFinite(Date.parse(record.submittedAt))
  );
}

export function validateSubmission(submission: ApplicationSubmission): void {
  if (!isServiceId(submission.serviceId)) {
    throw new ApplicationValidationError("Choose one of the listed application types.");
  }
  if (!submission.applicantName.trim()) {
    throw new ApplicationValidationError("Enter the applicant name.");
  }
  if (!submission.title.trim()) {
    throw new ApplicationValidationError("Enter an application title.");
  }
  if (!submission.description.trim()) {
    throw new ApplicationValidationError("Describe what you are requesting.");
  }
  if (
    !Number.isFinite(submission.requestedAmount) ||
    submission.requestedAmount <= 0
  ) {
    throw new ApplicationValidationError(
      "Enter a requested amount greater than zero Demo Credits.",
    );
  }
  if (submission.attachments.length === 0) {
    throw new ApplicationValidationError("Attach at least one supporting file.");
  }
  if (submission.attachments.length > MAX_FILES) {
    throw new ApplicationValidationError(
      `Attach no more than ${MAX_FILES} files.`,
    );
  }

  for (const file of submission.attachments) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      throw new ApplicationValidationError(
        `${file.name} is not a supported file type. Use PDF, DOCX, JPG, or PNG.`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new ApplicationValidationError(
        `${file.name} is larger than 10 MB. Choose a smaller file.`,
      );
    }
  }
}

function createReference(): string {
  const token =
    globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 8) ??
    Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `DEMO-${token.toUpperCase()}`;
}

export class BrowserMockApplicationService implements ApplicationService {
  constructor(
    private readonly storageProvider: StorageProvider = () => window.localStorage,
    private readonly randomSource: () => number = Math.random,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async submit(submission: ApplicationSubmission): Promise<ApplicationRecord> {
    validateSubmission(submission);
    const applications = this.read();
    const randomValue = this.randomSource();
    const outcomeIndex = Math.min(
      OUTCOMES.length - 1,
      Math.max(0, Math.floor(randomValue * OUTCOMES.length)),
    );
    const record: ApplicationRecord = {
      reference: createReference(),
      serviceId: submission.serviceId,
      applicantName: submission.applicantName.trim(),
      title: submission.title.trim(),
      description: submission.description.trim(),
      requestedAmount: submission.requestedAmount,
      attachments: submission.attachments.map((file) => ({
        name: file.name,
        type: file.type || "Not provided by browser",
        size: file.size,
      })),
      outcomeId: OUTCOMES[outcomeIndex].id,
      submittedAt: this.clock().toISOString(),
    };
    this.write([record, ...applications]);
    return record;
  }

  async list(): Promise<ApplicationRecord[]> {
    return this.read();
  }

  async get(reference: string): Promise<ApplicationRecord | undefined> {
    return this.read().find((application) => application.reference === reference);
  }

  async clear(): Promise<void> {
    try {
      this.storageProvider().removeItem(STORAGE_KEY);
    } catch {
      throw new ApplicationStorageError(
        "Demo history could not be cleared. Check that browser storage is available and try again.",
      );
    }
  }

  private read(): ApplicationRecord[] {
    let serialized: string | null;
    try {
      serialized = this.storageProvider().getItem(STORAGE_KEY);
    } catch {
      throw new ApplicationStorageError(
        "Browser storage is unavailable, so demo history cannot be read. Enable storage for this site and reload.",
      );
    }

    if (serialized === null) return [];

    let stored: unknown;
    try {
      stored = JSON.parse(serialized);
    } catch {
      throw new ApplicationStorageError(
        "Saved demo history could not be read because its data is damaged. Clear this site's demo data to start fresh.",
      );
    }

    if (
      !stored ||
      typeof stored !== "object" ||
      !("version" in stored) ||
      !("applications" in stored) ||
      stored.version !== STORAGE_VERSION ||
      !Array.isArray(stored.applications) ||
      !stored.applications.every(isApplicationRecord)
    ) {
      throw new ApplicationStorageError(
        "Saved demo history has an unsupported format. Clear this site's demo data to start fresh.",
      );
    }
    return stored.applications;
  }

  private write(applications: ApplicationRecord[]): void {
    const payload: StoredApplications = {
      version: STORAGE_VERSION,
      applications,
    };
    try {
      this.storageProvider().setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      throw new ApplicationStorageError(
        "Your application was not saved because browser storage could not be written. Check available storage and try again.",
      );
    }
  }
}

export const applicationService: ApplicationService =
  new BrowserMockApplicationService();
