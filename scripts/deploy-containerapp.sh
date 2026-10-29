#!/usr/bin/env bash
set -euo pipefail

: "${AZURE_RESOURCE_GROUP:?}"
: "${AZURE_SUBSCRIPTION_ID:?}"
: "${AZURE_LOCATION:?}"
: "${AZURE_CONTAINER_REGISTRY:?}"
: "${AZURE_REGISTRY_LOGIN_SERVER:?}"
: "${AZURE_IMAGE_REPOSITORY:?}"
: "${AZURE_MANAGED_ENVIRONMENT:?}"
: "${AZURE_PULL_IDENTITY:?}"
: "${AZURE_ENVIRONMENT_NAME:?}"
: "${AZURE_SESSION_ID:?}"
: "${APP_NAME:?}"
: "${APP_IMAGE:?}"
: "${PULL_REQUEST_NUMBER:?}"
: "${IMAGE_SOURCE_SHA:?}"
: "${CREATED_AT:?}"
: "${DEPLOYMENT_NAME:?}"

parameters=(
  "location=${AZURE_LOCATION}"
  "appName=${APP_NAME}"
  "containerImage=${APP_IMAGE}"
  "managedEnvironmentName=${AZURE_MANAGED_ENVIRONMENT}"
  "registryName=${AZURE_CONTAINER_REGISTRY}"
  "pullIdentityName=${AZURE_PULL_IDENTITY}"
  "sessionId=${AZURE_SESSION_ID}"
  "environmentName=${AZURE_ENVIRONMENT_NAME}"
  "createdAt=${CREATED_AT}"
  "sourceSha=${IMAGE_SOURCE_SHA}"
  "pullRequestNumber=${PULL_REQUEST_NUMBER}"
)

what_if="$(az deployment group what-if \
  --name "${DEPLOYMENT_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --subscription "${AZURE_SUBSCRIPTION_ID}" \
  --template-file infra/app.bicep \
  --parameters "${parameters[@]}" \
  --result-format FullResourcePayloads \
  --no-pretty-print \
  --output json)"

if jq -e '.changes[]? | select(.changeType == "Delete")' <<<"$what_if" >/dev/null; then
  echo "Refusing deployment because what-if predicts a resource deletion." >&2
  exit 1
fi

app_fqdn="$(az deployment group create \
  --name "${DEPLOYMENT_NAME}" \
  --resource-group "${AZURE_RESOURCE_GROUP}" \
  --subscription "${AZURE_SUBSCRIPTION_ID}" \
  --template-file infra/app.bicep \
  --parameters "${parameters[@]}" \
  --query properties.outputs.appFqdn.value \
  --output tsv)"

if [[ -z "$app_fqdn" ]]; then
  echo "The deployment completed without returning an app FQDN." >&2
  exit 1
fi

app_url="https://${app_fqdn}/"
healthy=false
for attempt in 1 2 3; do
  if curl --fail --silent --show-error --max-time 30 "$app_url" >/dev/null; then
    healthy=true
    break
  fi
  if [[ "$attempt" -lt 3 ]]; then
    sleep 20
  fi
done

if [[ "$healthy" != true ]]; then
  echo "The deployed Container App did not pass its HTTPS health check: ${app_url}" >&2
  exit 1
fi

echo "app-url=${app_url}" >> "${GITHUB_OUTPUT}"
