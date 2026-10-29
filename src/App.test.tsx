import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { BrowserMockApplicationService } from "./applicationService";

function makeMemoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

describe("application journey", () => {
  it("confirms before discarding an unfinished form during navigation", async () => {
    const user = userEvent.setup();
    const service = new BrowserMockApplicationService(makeMemoryStorage, () => 0);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    function StatefulApp() {
      const [stableService] = useState(service);
      return <App service={stableService} />;
    }

    render(<StatefulApp />);
    await user.click(screen.getAllByRole("button", { name: /Start Demo/ })[0]);
    await user.type(
      screen.getByRole("textbox", { name: /Applicant or organization name/ }),
      "Sample Applicant",
    );
    await user.click(screen.getByRole("button", { name: "My Applications" }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "Grant Request" }),
    ).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "My Applications" }));
    expect(
      screen.getByRole("heading", { name: "My Applications" }),
    ).toBeInTheDocument();

    confirm.mockRestore();
  });

  it("submits a mock application, shows history and details, then confirms reset", async () => {
    const user = userEvent.setup();
    const service = new BrowserMockApplicationService(makeMemoryStorage, () => 0);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn();

    function StatefulApp() {
      const [stableService] = useState(service);
      return <App service={stableService} />;
    }

    render(<StatefulApp />);
    await user.click(screen.getAllByRole("button", { name: /Start Demo/ })[0]);
    await user.type(
      screen.getByRole("textbox", { name: /Applicant or organization name/ }),
      "Sample Cooperative",
    );
    await user.type(
      screen.getByRole("textbox", { name: /Application title/ }),
      "Community garden",
    );
    await user.type(
      screen.getByRole("textbox", { name: /What are you requesting/ }),
      "A made-up neighborhood project.",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: /Requested amount/ }),
      "1250",
    );
    await user.upload(
      screen.getByLabelText("Choose Files"),
      new File(["synthetic content"], "sample.pdf", { type: "application/pdf" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Submit Demo Application" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Potentially Eligible" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^DEMO-[A-F0-9]{8}$/)).toBeInTheDocument();
    expect(screen.getByText(/randomly selected mock result/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "View My Applications" }),
    );
    expect(
      screen.getByRole("heading", { name: "My Applications" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /View Details/ }));
    expect(
      screen.getByRole("heading", { name: "Community garden" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/original files are unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("sample.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to My Applications" }));
    await user.click(screen.getByRole("button", { name: "Clear Demo History" }));
    expect(confirm).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByText("No Applications Yet")).toBeInTheDocument();
    });

    confirm.mockRestore();
    HTMLElement.prototype.scrollIntoView = originalScroll;
  });

  it("shows a clear persistence error without showing a successful result", async () => {
    const user = userEvent.setup();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
    const service = new BrowserMockApplicationService(() => storage, () => 0);

    function StatefulApp() {
      const [stableService] = useState(service);
      return <App service={stableService} />;
    }

    render(<StatefulApp />);
    await user.click(screen.getAllByRole("button", { name: /Start Demo/ })[0]);
    await user.type(
      screen.getByRole("textbox", { name: /Applicant or organization name/ }),
      "Sample Applicant",
    );
    await user.type(
      screen.getByRole("textbox", { name: /Application title/ }),
      "Sample request",
    );
    await user.type(
      screen.getByRole("textbox", { name: /What are you requesting/ }),
      "Synthetic description.",
    );
    await user.type(
      screen.getByRole("spinbutton", { name: /Requested amount/ }),
      "100",
    );
    await user.upload(
      screen.getByLabelText("Choose Files"),
      new File(["x"], "sample.png", { type: "image/png" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Submit Demo Application" }),
    );

    expect(
      await screen.findByText(/Your application was not saved/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Potentially Eligible" }),
    ).not.toBeInTheDocument();
  });

  it("allows recovery from damaged browser history", async () => {
    const user = userEvent.setup();
    const storage = makeMemoryStorage();
    storage.setItem("civic-portal-demo:applications", "{not-json");
    const service = new BrowserMockApplicationService(() => storage);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    function StatefulApp() {
      const [stableService] = useState(service);
      return <App service={stableService} />;
    }

    render(<StatefulApp />);
    expect(await screen.findByText(/data is damaged/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review History Options" }));
    await user.click(screen.getByRole("button", { name: "Clear Demo History" }));
    expect(confirm).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByText(/data is damaged/i)).not.toBeInTheDocument();
    });

    confirm.mockRestore();
  });
});
