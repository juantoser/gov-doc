# GitHub Actions deployment setup

## What the workflows do

- `Portal CI` runs lint, type-checking, tests, the production build, and a container build on every pull request targeting `main` and on pushes to `main`.
- CI has read-only repository access and no Azure credentials. It uploads the built image as a short-lived artifact.
- `Portal deployment` runs from the trusted default-branch workflow after CI completes. It deploys the stable app after a successful push to `main`, and creates an isolated preview Container App for successful same-repository PRs. Fork PRs receive CI only.
- Closing a same-repository PR removes only its preview app. The corresponding `pr-*` ACR image tags are retained; they can be removed separately during registry housekeeping.
- The preview workflow file must first be merged into the repository's default branch. Until then, GitHub will run CI but cannot start the `workflow_run` deployment.

The privileged workflow downloads the CI image artifact but does not check out or execute PR scripts. Protect `main` with required review and restrict who can change workflow files. No client secret is needed; Azure sign-in uses GitHub OIDC.

## Configure repository variables

Run the setup script from the repository root after authenticating `gh` to the intended GitHub account:

```powershell
.\scripts\setup-azure-auth-for-pipeline.ps1 `
  -AzureClientId "dbd23cbe-f7df-487a-9e84-bbcb994aef2d" `
  -AzureTenantId "16b3c013-d300-468d-ac64-7eda0820b6d3" `
  -AzureSubscriptionId "c4b40a12-d97e-4287-9c93-7d6bda9690cf" `
  -ResourceGroup "rg-gov-doc-dev-0d63" `
  -Location "westeurope" `
  -ContainerRegistry "crgovdocdev0d63" `
  -RegistryLoginServer "crgovdocdev0d63.azurecr.io" `
  -ImageRepository "gov-doc-portal" `
  -ContainerApp "ca-gov-doc-dev-0d63" `
  -ManagedEnvironment "cae-gov-doc-dev-0d63" `
  -PullIdentity "id-gov-doc-pull-0d63" `
  -EnvironmentName "gov-doc-dev-0d63" `
  -SessionId "0d63a97b-b2a0-404b-bfaa-96b46ae0f337"
```

These are resource identifiers and configuration values, not secrets. The deployment identity is `id-gov-doc-gha-0d63`; it has ACR push rights, a resource-group-scoped Container Apps deployment role, and permission to attach only the runtime pull identity. Its active federated credential is restricted to `main`; the legacy PR credential is retained with a non-matching subject so PR jobs cannot obtain Azure tokens.
