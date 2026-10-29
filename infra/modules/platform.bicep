param location string
param githubOwner string
param githubRepo string
param tags object
param registryName string
param workspaceName string
param managedEnvironmentName string
param githubIdentityName string
param pullIdentityName string
param githubDeploymentRoleDefinitionId string

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'
var containerAppsContributorRoleId = '358470bc-b998-42bd-ab17-a7e34c199c0f'
var managedIdentityOperatorRoleId = 'f1a07417-d97a-45cb-824c-7a7467783830'

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
  }
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2026-03-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: pullIdentityName
  location: location
  tags: tags
}

resource githubIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: githubIdentityName
  location: location
  tags: tags
}

resource githubMainCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2024-11-30' = {
  parent: githubIdentity
  name: 'github-main'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOwner}/${githubRepo}:ref:refs/heads/main'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

resource githubPullRequestCredentialDisabled 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2024-11-30' = {
  parent: githubIdentity
  name: 'github-pull-request'
  dependsOn: [
    githubMainCredential
  ]
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    // Keep the legacy resource with a non-matching subject so incremental deployment disables PR OIDC trust.
    subject: 'repo:${githubOwner}/${githubRepo}:pull_request-disabled'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

resource registryPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, pullIdentity.id, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource registryPushRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, githubIdentity.id, acrPushRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPushRoleId)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource githubDeploymentRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  // Reuse the old assignment's ID so its broad built-in role is replaced in place.
  name: guid(resourceGroup().id, githubIdentity.id, containerAppsContributorRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: githubDeploymentRoleDefinitionId
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource githubPullIdentityOperatorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(pullIdentity.id, githubIdentity.id, managedIdentityOperatorRoleId)
  scope: pullIdentity
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', managedIdentityOperatorRoleId)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2026-07-01' = {
  name: managedEnvironmentName
  location: location
  tags: tags
  properties: {
    // Container Apps sends console logs to the shared, usage-billed workspace.
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

output acrName string = registry.name
output acrLoginServer string = registry.properties.loginServer
output managedEnvironmentName string = managedEnvironment.name
output managedEnvironmentId string = managedEnvironment.id
output pullIdentityId string = pullIdentity.id
output githubIdentityClientId string = githubIdentity.properties.clientId
