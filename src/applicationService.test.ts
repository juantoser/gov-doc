import { beforeEach, describe, expect, it } from "vitest";
import {
  ApplicationStorageError,
  ApplicationValidationError,
  BrowserMockApplicationService,
  validateSubmission,
} from "./applicationService";
import type { ApplicationSubmission } from "./domain";

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear() {
    this.items.clear();
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

function makeSubmission(
  overrides: Partial<ApplicationSubmission> = {},
): ApplicationSubmission {
  return {
    serviceId: "grant",
    applicantName: "Sample Applicant",
    title: "Community garden",
    description: "A fictional sample request for a neighborhood garden.",
    requestedAmount: 1250,
    attachments: [new File(["synthetic example"], "plan.pdf", { type: "application/pdf" })],
    ...overrides,
  };
}

describe("BrowserMockApplicationService", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it.each([
    [0, "potentially-eligible"],
    [0.34, "additional-documents"],
    [0.67, "manual-review"],
  ] as const)("returns the controlled mock outcome for random value %s", async (random, expected) => {
    const service = new BrowserMockApplicationService(() => storage, () => random);
    const record = await service.submit(makeSubmission());

    expect(record.outcomeId).toBe(expected);
    expect(record.reference).toMatch(/^DEMO-[A-F0-9]{8}$/);
  });

  it("persists only metadata and keeps the selected result after reload", async () => {
    const submission = makeSubmission({
      attachments: [
        new File(["private-looking synthetic bytes"], "sample.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ],
    });
    const firstService = new BrowserMockApplicationService(() => storage, () => 0.4);
    const submitted = await firstService.submit(submission);
    const serialized = storage.getItem("civic-portal-demo:applications") ?? "";

    expect(serialized).toContain("sample.docx");
    expect(serialized).not.toContain("private-looking synthetic bytes");
    expect(serialized).not.toContain("base64");
    expect(JSON.parse(serialized).applications[0].attachments[0]).toEqual({
      name: "sample.docx",
      type: submission.attachments[0].type,
      size: submission.attachments[0].size,
    });

    const reloadedService = new BrowserMockApplicationService(() => storage, () => 0);
    const reloaded = await reloadedService.get(submitted.reference);
    expect(reloaded?.outcomeId).toBe("additional-documents");
    expect(await reloadedService.list()).toHaveLength(1);
  });

  it("clears only this portal's saved records", async () => {
    const service = new BrowserMockApplicationService(() => storage);
    storage.setItem("other-demo-data", "keep");
    await service.submit(makeSubmission());
    await service.clear();

    expect(await service.list()).toEqual([]);
    expect(storage.getItem("other-demo-data")).toBe("keep");
  });

  it("surfaces corrupted or unsupported stored data instead of silently replacing it", async () => {
    const service = new BrowserMockApplicationService(() => storage);
    storage.setItem("civic-portal-demo:applications", "{not-json");

    await expect(service.list()).rejects.toBeInstanceOf(ApplicationStorageError);
    expect(storage.getItem("civic-portal-demo:applications")).toBe("{not-json");

    storage.setItem(
      "civic-portal-demo:applications",
      JSON.stringify({ version: 99, applications: [] }),
    );
    await expect(service.list()).rejects.toThrow("unsupported format");
  });

  it("reports unavailable and read-only browser storage", async () => {
    const unavailable = new BrowserMockApplicationService(() => {
      throw new Error("blocked");
    });
    await expect(unavailable.list()).rejects.toThrow("Browser storage is unavailable");

    const readOnly = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    const service = new BrowserMockApplicationService(() => readOnly);
    await expect(service.submit(makeSubmission())).rejects.toThrow(
      "Your application was not saved",
    );
    await expect(service.clear()).rejects.toThrow("could not be cleared");
  });
});

describe("validateSubmission", () => {
  it("accepts every supported extension and an attachment exactly 10 MB in size", () => {
    const files = ["request.pdf", "request.docx", "photo.jpg", "photo.jpeg", "scan.png"].map(
      (name) => new File(["x"], name),
    );
    files[0] = new File([new Uint8Array(10 * 1024 * 1024)], "request.pdf");

    expect(() =>
      validateSubmission(makeSubmission({ attachments: files })),
    ).not.toThrow();
  });

  it("rejects a missing attachment, unsupported extension, six files, and a file over 10 MB", () => {
    expect(() =>
      validateSubmission(makeSubmission({ attachments: [] })),
    ).toThrow("Attach at least one");
    expect(() =>
      validateSubmission({
        ...makeSubmission(),
        attachments: [new File(["x"], "notes.txt")],
      }),
    ).toThrow("not a supported file type");
    expect(() =>
      validateSubmission({
        ...makeSubmission(),
        attachments: Array.from(
          { length: 6 },
          (_, index) => new File(["x"], `file${index}.pdf`),
        ),
      }),
    ).toThrow("no more than 5 files");
    expect(() =>
      validateSubmission({
        ...makeSubmission(),
        attachments: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf")],
      }),
    ).toThrow("larger than 10 MB");
  });

  it("rejects missing form values and invalid amounts", () => {
    expect(() =>
      validateSubmission(makeSubmission({ applicantName: "  " })),
    ).toThrow(ApplicationValidationError);
    expect(() =>
      validateSubmission(makeSubmission({ title: "" })),
    ).toThrow("application title");
    expect(() =>
      validateSubmission(makeSubmission({ description: "" })),
    ).toThrow("Describe");
    expect(() =>
      validateSubmission(makeSubmission({ requestedAmount: 0 })),
    ).toThrow("greater than zero");
  });
});
