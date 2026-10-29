# Civic Services portal demo

A fictional, local-only demonstration of a public-services application journey. It supports grant requests, relief requests, subsidy applications, and loan guarantee applications. Each submission receives an immediate randomly selected mock response.

**This is not an official service. Do not enter real personal, financial, or government information.** The demo does not check eligibility, read documents, or make decisions.

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
```

Open the local address printed by Vite. No Azure account, external API, or service credentials are needed. The app uses system fonts and does not send files to a server.

## Demo behavior and data

- Choose one of four fictional application types and fill in the shared sample form.
- Attach PDF, DOCX, JPG/JPEG, or PNG files. The browser checks filename extensions and size only; it does not inspect or upload file contents. A submission allows up to five files, each no larger than 10 MB.
- The result is randomly selected from “Potentially eligible,” “Additional documents needed,” and “Manual review required.” It is generated once per submission, saved with the record, and is not an official determination.
- Application fields, the simulated result, and attachment names, types, and sizes are saved in this browser’s `localStorage` so history survives a refresh. **File contents are never saved.** After leaving the form or refreshing, the original attachments are unavailable.
- Browser storage is unencrypted and local to this browser and origin. Use fictional sample information only.
- Use **My applications → Clear demo history** to remove this portal’s saved records from this browser. The portal asks for confirmation first.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Later stages

Azure Container Apps deployment and Foundry-hosted workflows are intentionally out of scope for this mock. A future backend can replace the typed application-service interface with an API. Before introducing real document processing, add server-side upload handling, appropriate access controls, secure storage, and explicit human-review boundaries. Do not put credentials or real decision logic in the browser.
