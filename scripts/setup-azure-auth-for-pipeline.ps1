[CmdletBinding()]
param(
  [string]$Repository = 'juantoser/gov-doc',
  [Parameter(Mandatory)] [string]$AzureClientId,
  [Parameter(Mandatory)] [string]$AzureTenantId,
  [Parameter(Mandatory)] [string]$AzureSubscriptionId,
  [Parameter(Mandatory)] [string]$ResourceGroup,
  [Parameter(Mandatory)] [string]$Location,
  [Parameter(Mandatory)] [string]$ContainerRegistry,
  [Parameter(Mandatory)] [string]$RegistryLoginServer,
  [Parameter(Mandatory)] [string]$ImageRepository,
  [Parameter(Mandatory)] [string]$ContainerApp,
  [Parameter(Mandatory)] [string]$ManagedEnvironment,
  [Parameter(Mandatory)] [string]$PullIdentity,
  [Parameter(Mandatory)] [string]$EnvironmentName,
  [Parameter(Mandatory)] [string]$SessionId,
  [string]$PreviewAppPrefix = 'ca-gov-doc-pr-'
)

$variables = [ordered]@{
  AZURE_CLIENT_ID = $AzureClientId
  AZURE_TENANT_ID = $AzureTenantId
  AZURE_SUBSCRIPTION_ID = $AzureSubscriptionId
  AZURE_RESOURCE_GROUP = $ResourceGroup
  AZURE_LOCATION = $Location
  AZURE_CONTAINER_REGISTRY = $ContainerRegistry
  AZURE_REGISTRY_LOGIN_SERVER = $RegistryLoginServer
  AZURE_IMAGE_REPOSITORY = $ImageRepository
  AZURE_CONTAINER_APP = $ContainerApp
  AZURE_PREVIEW_APP_PREFIX = $PreviewAppPrefix
  AZURE_MANAGED_ENVIRONMENT = $ManagedEnvironment
  AZURE_PULL_IDENTITY = $PullIdentity
  AZURE_ENVIRONMENT_NAME = $EnvironmentName
  AZURE_SESSION_ID = $SessionId
}

foreach ($name in $variables.Keys) {
  & gh variable set $name --repo $Repository --body $variables[$name]
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set GitHub repository variable $name."
  }
}

Write-Output "Configured $($variables.Count) non-secret Actions variables for $Repository."
