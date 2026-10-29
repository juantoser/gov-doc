import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type DragEvent,
} from "react";
import {
  applicationService,
  type ApplicationService,
} from "./applicationService";
import {
  getOutcome,
  getService,
  SERVICES,
  type ApplicationRecord,
  type ApplicationSubmission,
  type ServiceId,
} from "./domain";

const ACCEPTED_FILES = ".pdf,.docx,.jpg,.jpeg,.png";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Page =
  | { kind: "home" }
  | { kind: "form"; serviceId: ServiceId }
  | { kind: "result"; reference: string }
  | { kind: "history" }
  | { kind: "details"; reference: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Your application was not saved. Please try again.";
}

interface ApplicationFormProps {
  serviceId: ServiceId;
  onSubmit: (submission: ApplicationSubmission) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function ApplicationForm({
  serviceId,
  onSubmit,
  onCancel,
  onDirtyChange,
}: ApplicationFormProps) {
  const service = getService(serviceId);
  const [applicantName, setApplicantName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    onDirtyChange(
      Boolean(
        applicantName.trim() ||
          title.trim() ||
          description.trim() ||
          requestedAmount ||
          attachments.length,
      ),
    );
  }, [
    applicantName,
    attachments.length,
    description,
    onDirtyChange,
    requestedAmount,
    title,
  ]);

  useEffect(() => {
    if (submitError) submitErrorRef.current?.focus();
  }, [submitError]);

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    const next = [...attachments];
    const rejected: string[] = [];

    for (const file of incoming) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["pdf", "docx", "jpg", "jpeg", "png"].includes(extension)) {
        rejected.push(`${file.name}: unsupported file type.`);
      } else if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: larger than 10 MB.`);
      } else if (next.length >= MAX_FILES) {
        rejected.push(`${file.name}: no more than ${MAX_FILES} files are allowed.`);
      } else {
        next.push(file);
      }
    }

    setAttachments(next);
    setFileError(rejected.join(" "));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSubmitError("");
    setIsSubmitting(true);
    try {
      await onSubmit({
        serviceId,
        applicantName,
        title,
        description,
        requestedAmount: Number(requestedAmount),
        attachments,
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel form-panel" aria-labelledby="application-form-title">
      <button className="text-button back-link" onClick={onCancel} type="button">
        <span aria-hidden="true">←</span> Back to Services
      </button>
      <div className="eyebrow">DEMO APPLICATION</div>
      <h1 id="application-form-title">{service.title}</h1>
      <p className="form-intro">
        Fill in the sample details below. Use fictional information only; do not
        upload real identity, financial, or government records.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field">
            Applicant or organization name
            <input
              autoComplete="off"
              maxLength={100}
              name="applicantName"
              onChange={(event) => setApplicantName(event.target.value)}
              required
              value={applicantName}
            />
          </label>
          <label className="field">
            Application title
            <input
              autoComplete="off"
              maxLength={100}
              name="title"
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
        </div>
        <label className="field">
          What are you requesting?
          <textarea
            autoComplete="off"
            maxLength={1500}
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={5}
            value={description}
          />
          <span className="field-hint">Up to 1,500 characters.</span>
        </label>
        <label className="field amount-field">
          Requested amount <span className="currency-tag">Demo Credits (DMC)</span>
          <input
            autoComplete="off"
            inputMode="decimal"
            min="0.01"
            name="requestedAmount"
            onChange={(event) => setRequestedAmount(event.target.value)}
            required
            step="0.01"
            type="number"
            value={requestedAmount}
          />
          <span className="field-hint">
            DMC is a fictional currency for this demonstration only.
          </span>
        </label>

        <fieldset className="upload-fieldset">
          <legend>Supporting documents</legend>
          <p className="field-hint">
            PDF, DOCX, JPG, or PNG. Up to {MAX_FILES} files, {formatBytes(MAX_FILE_SIZE)}{" "}
            maximum each. Files are used only during this page session and are
            never uploaded or saved.
          </p>
          <div
            className="drop-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            <span className="upload-icon" aria-hidden="true">
              ↑
            </span>
            <label className="upload-label">
              <span className="text-button">Choose Files</span>
              <input
                accept={ACCEPTED_FILES}
                aria-describedby={fileError ? "file-error" : "file-help"}
                multiple
                name="attachments"
                ref={fileInputRef}
                required={attachments.length === 0}
                onChange={(event) => {
                  if (event.currentTarget.files) addFiles(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
            <span>or drag and drop them here</span>
          </div>
          <span id="file-help" className="sr-only">
            Choose up to five PDF, DOCX, JPG, or PNG files, each no larger than
            ten megabytes.
          </span>
          {fileError && (
            <p className="form-error" id="file-error" role="alert">
              {fileError}
            </p>
          )}
          {attachments.length > 0 && (
            <ul className="attachment-list" aria-label="Selected files">
              {attachments.map((file, index) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                  <span className="file-mark" aria-hidden="true">
                    DOC
                  </span>
                  <span className="attachment-name">
                    <strong>{file.name}</strong>
                    <small>{formatBytes(file.size)}</small>
                  </span>
                  <button
                    aria-label={`Remove ${file.name}`}
                    className="remove-file"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {submitError && (
          <p
            className="form-error submit-error"
            ref={submitErrorRef}
            role="alert"
            tabIndex={-1}
          >
            {submitError}
          </p>
        )}
        <div className="form-actions">
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting && <span className="button-spinner" aria-hidden="true" />}
            {isSubmitting ? "Saving Demo Application…" : "Submit Demo Application"}
          </button>
          <button className="button button-quiet" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
        <p className="submit-note">
          Your answer is randomly generated for this demo. It is not an official
          decision and does not assess your documents.
        </p>
      </form>
    </section>
  );
}

interface ResultCardProps {
  application: ApplicationRecord;
  onViewHistory: () => void;
  onStartAnother: () => void;
}

function ResultCard({
  application,
  onViewHistory,
  onStartAnother,
}: ResultCardProps) {
  const outcome = getOutcome(application.outcomeId);
  const service = getService(application.serviceId);

  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div className="result-symbol" aria-hidden="true">
        ✓
      </div>
      <div className="eyebrow">DEMO RESPONSE</div>
      <h1 id="result-title">{outcome.label}</h1>
      <p className="result-intro">{outcome.description}</p>
      <div className="reference-box">
        <span>Application reference</span>
        <strong>{application.reference}</strong>
      </div>
      <dl className="result-summary">
        <div>
          <dt>Application type</dt>
          <dd>{service.title}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDate(application.submittedAt)}</dd>
        </div>
        <div>
          <dt>Request</dt>
          <dd>{application.title}</dd>
        </div>
        <div>
          <dt>Requested amount</dt>
          <dd>
            {application.requestedAmount.toLocaleString("en")} DMC
          </dd>
        </div>
      </dl>
      <div className="next-step">
        <strong>What Happens Next?</strong>
        <p>{service.nextStep}</p>
        <p>{outcome.nextStep}</p>
      </div>
      <div className="result-actions">
        <button className="button button-primary" onClick={onViewHistory}>
          View My Applications
        </button>
        <button className="button button-quiet" onClick={onStartAnother}>
          Start Another
        </button>
      </div>
      <p className="demo-disclaimer">
        Demonstration only. This is a randomly selected mock result, not a
        government decision. Uploaded file contents were not read or retained.
      </p>
    </section>
  );
}

interface HistoryProps {
  applications: ApplicationRecord[];
  canClear: boolean;
  onOpen: (reference: string) => void;
  onClear: () => void;
  onStart: () => void;
}

function History({
  applications,
  canClear,
  onOpen,
  onClear,
  onStart,
}: HistoryProps) {
  return (
    <section className="history-page" aria-labelledby="history-title">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR DEMO RECORDS</div>
          <h1 id="history-title">My Applications</h1>
          <p>
            This list is saved in this browser only. Attachments are not saved;
            only their names and sizes appear in application details.
          </p>
        </div>
        {(applications.length > 0 || canClear) && (
          <button className="button button-outline" onClick={onClear}>
            Clear Demo History
          </button>
        )}
      </div>
      {applications.length === 0 ? (
        <div className="empty-state panel">
          <span className="empty-icon" aria-hidden="true">
            ▤
          </span>
          <h2>No Applications Yet</h2>
          <p>Start a demo application to see it appear here.</p>
          <button className="button button-primary" onClick={onStart}>
            Browse Services
          </button>
        </div>
      ) : (
        <div className="history-list">
          {applications.map((application) => (
            <article className="history-item panel" key={application.reference}>
              <div className="history-item-heading">
                <div>
                  <span className="eyebrow">
                    {getService(application.serviceId).title}
                  </span>
                  <h2>{application.title}</h2>
                </div>
                <span className={`outcome-pill outcome-${application.outcomeId}`}>
                  {getOutcome(application.outcomeId).label}
                </span>
              </div>
              <div className="history-item-footer">
                <span>{application.reference}</span>
                <span>{formatDate(application.submittedAt)}</span>
                <button
                  className="text-button"
                  onClick={() => onOpen(application.reference)}
                >
                  View Details <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="storage-note">
        Browser storage is not encrypted. This demo stores application details
        locally on this device. Do not enter real personal or financial data.
      </p>
    </section>
  );
}

interface DetailsProps {
  application: ApplicationRecord;
  onBack: () => void;
}

function ApplicationDetails({ application, onBack }: DetailsProps) {
  return (
    <section className="panel details-panel" aria-labelledby="details-title">
      <button className="text-button back-link" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to My Applications
      </button>
      <div className="eyebrow">{getService(application.serviceId).title}</div>
      <h1 id="details-title">{application.title}</h1>
      <span className={`outcome-pill outcome-${application.outcomeId}`}>
        {getOutcome(application.outcomeId).label}
      </span>
      <dl className="details-grid">
        <div>
          <dt>Application reference</dt>
          <dd>{application.reference}</dd>
        </div>
        <div>
          <dt>Applicant</dt>
          <dd>{application.applicantName}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDate(application.submittedAt)}</dd>
        </div>
        <div>
          <dt>Requested amount</dt>
          <dd>{application.requestedAmount.toLocaleString("en")} DMC</dd>
        </div>
        <div className="details-wide">
          <dt>Request description</dt>
          <dd className="preserve-lines">{application.description}</dd>
        </div>
      </dl>
      <div className="next-step">
        <strong>Simulated result</strong>
        <p>{getOutcome(application.outcomeId).description}</p>
      </div>
      <div className="attachment-details">
        <h2>Attachment Details</h2>
        <p>
          File contents were never uploaded or saved. The names and sizes below
          are metadata only; the original files are unavailable after leaving
          the submission page.
        </p>
        <ul className="saved-attachment-list">
          {application.attachments.map((attachment) => (
            <li key={`${attachment.name}-${attachment.size}`}>
              <strong>{attachment.name}</strong>
              <span>{formatBytes(attachment.size)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="demo-disclaimer">
        Demonstration only. This result is randomly selected and is not an
        official determination.
      </p>
    </section>
  );
}

export interface AppProps {
  service?: ApplicationService;
}

export default function App({ service = applicationService }: AppProps) {
  const [page, setPage] = useState<Page>({ kind: "home" });
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);

  useEffect(() => {
    let active = true;
    service
      .list()
      .then((records) => {
        if (active) setApplications(records);
      })
      .catch((error: unknown) => {
        if (active) setStorageError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setHistoryReady(true);
      });
    return () => {
      active = false;
    };
  }, [service]);

  useEffect(() => {
    if (!hasUnsavedDraft) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedDraft]);

  async function submitApplication(submission: ApplicationSubmission) {
    const application = await service.submit(submission);
    setApplications((current) => [application, ...current]);
    setStorageError("");
    setHasUnsavedDraft(false);
    setPage({ kind: "result", reference: application.reference });
  }

  async function clearHistory() {
    if (
      !window.confirm(
        "Clear all demo application records saved by this portal in this browser?",
      )
    ) {
      return;
    }
    setIsClearing(true);
    try {
      await service.clear();
      setApplications([]);
      setStorageError("");
    } catch (error) {
      setStorageError(getErrorMessage(error));
    } finally {
      setIsClearing(false);
    }
  }

  const selectedApplication =
    "reference" in page
      ? applications.find((application) => application.reference === page.reference)
      : undefined;

  function navigateToServices() {
    if (
      page.kind === "form" &&
      hasUnsavedDraft &&
      !window.confirm("Discard this unfinished demo application?")
    ) {
      return;
    }
    setHasUnsavedDraft(false);
    setPage({ kind: "home" });
  }

  function navigateToHistory() {
    if (
      page.kind === "form" &&
      hasUnsavedDraft &&
      !window.confirm("Discard this unfinished demo application?")
    ) {
      return;
    }
    setHasUnsavedDraft(false);
    setPage({ kind: "history" });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to Main Content
      </a>
      <div className="demo-ribbon">
        <span className="demo-ribbon-dot" aria-hidden="true" />
        Demonstration portal — fictional service, fictional outcomes
      </div>
      <header className="site-header">
        <button
          aria-label="Civic Services home"
          className="brand"
          onClick={navigateToServices}
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>Civic Services</strong>
            <small>Public services portal</small>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button
            aria-current={page.kind === "home" || page.kind === "form" ? "page" : undefined}
            className={page.kind === "home" || page.kind === "form" ? "nav-link active" : "nav-link"}
            onClick={navigateToServices}
          >
            Services
          </button>
          <button
            aria-current={
              page.kind === "history" || page.kind === "details" ? "page" : undefined
            }
            className={
              page.kind === "history" || page.kind === "details"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={navigateToHistory}
          >
            My Applications
            {applications.length > 0 && (
              <span className="nav-count">{applications.length}</span>
            )}
          </button>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        {!historyReady && (
          <p className="sr-only" aria-live="polite">
            Loading demo history…
          </p>
        )}
        {storageError && (
          <div className="storage-alert" role="alert">
            <strong>Browser history issue</strong>
            <span>{storageError}</span>
            {storageError.includes("Clear this site's demo data") && (
              <button
                className="text-button"
                onClick={navigateToHistory}
              >
                Review History Options
              </button>
            )}
          </div>
        )}
        {page.kind === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">A SIMPLE WAY TO GET STARTED</div>
                <h1>Public Support, Made Easier to Explore.</h1>
                <p>
                  Choose a service, share a few sample details, and see how a
                  digital application journey could feel.
                </p>
                <button
                  className="button button-primary hero-button"
                  onClick={() =>
                    document.getElementById("services-title")?.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? "auto"
                        : "smooth",
                    })
                  }
                >
                  Explore Services <span aria-hidden="true">↓</span>
                </button>
                <div className="hero-trust">
                  <span className="trust-icon" aria-hidden="true">
                    ✓
                  </span>
                  No sign-in. No real decisions. Just a demo.
                </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="hero-sun" />
                <div className="hero-orbit orbit-one" />
                <div className="hero-orbit orbit-two" />
                <div className="hero-document">
                  <div className="doc-stamp">DEMO</div>
                  <div className="doc-line doc-line-strong" />
                  <div className="doc-line" />
                  <div className="doc-line doc-line-short" />
                  <div className="doc-seal">C</div>
                </div>
                <div className="hero-star star-one">✳</div>
                <div className="hero-star star-two">✦</div>
              </div>
            </section>

            <section className="services-section" aria-labelledby="services-title">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">DEMO SERVICES</div>
                  <h2 id="services-title">What Can We Help You Explore?</h2>
                </div>
                <p>Choose an application type to try a sample journey.</p>
              </div>
              <div className="service-grid">
                {SERVICES.map((service, index) => (
                  <article className="service-card panel" key={service.id}>
                    <span className={`service-icon service-icon-${index}`} aria-hidden="true">
                      {["✳", "⌂", "↗", "◈"][index]}
                    </span>
                    <h3>{service.title}</h3>
                    <p>{service.summary}</p>
                    <button
                      className="service-action"
                      onClick={() =>
                        setPage({ kind: "form", serviceId: service.id })
                      }
                    >
                      Start Demo <span aria-hidden="true">→</span>
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <section className="safe-demo" aria-label="Demo privacy note">
              <span className="safe-icon" aria-hidden="true">
                ◈
              </span>
              <div>
                <strong>Use Sample Information Only</strong>
                <p>
                  This is a fictional portal. Uploaded files are not sent
                  anywhere, and their contents are never analyzed.
                </p>
              </div>
            </section>
          </>
        )}
        {page.kind === "form" && (
          <ApplicationForm
            onCancel={navigateToServices}
            onDirtyChange={setHasUnsavedDraft}
            onSubmit={submitApplication}
            serviceId={page.serviceId}
          />
        )}
        {page.kind === "result" && selectedApplication && (
          <ResultCard
            application={selectedApplication}
            onStartAnother={navigateToServices}
            onViewHistory={navigateToHistory}
          />
        )}
        {page.kind === "history" && (
          <History
            applications={applications}
            canClear={Boolean(storageError)}
            onClear={clearHistory}
            onOpen={(reference) => setPage({ kind: "details", reference })}
            onStart={navigateToServices}
          />
        )}
        {page.kind === "details" && selectedApplication && (
          <ApplicationDetails
            application={selectedApplication}
            onBack={() => setPage({ kind: "history" })}
          />
        )}
        {(page.kind === "result" || page.kind === "details") &&
          !selectedApplication && (
            <section className="panel empty-state">
              <h1>Application Not Found</h1>
              <p>This record may have been cleared from this browser.</p>
              <button
                className="button button-primary"
                onClick={navigateToHistory}
              >
                View My Applications
              </button>
            </section>
          )}
      </main>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">Civic Services</span>
          <span>Fictional public portal demonstration</span>
        </div>
        <span>Not an official service or government decision.</span>
      </footer>

      {isClearing && (
        <span className="sr-only" role="status">
          Clearing demo history…
        </span>
      )}
    </div>
  );
}
