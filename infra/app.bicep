targetScope = 'resourceGroup'

param location string
param appName string
param containerImage string
param managedEnvironmentName string
param registryName string
param pullIdentityName string
param sessionId string
param environmentName string
param createdAt string
param sourceSha string
param deployedBy string = 'github-actions'
param pullRequestNumber int = 0

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: registryName
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2026-07-01' existing = {
  name: managedEnvironmentName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: pullIdentityName
}

var baseTags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
  'source-sha': sourceSha
}

var tags = pullRequestNumber > 0
  ? union(baseTags, {
      'deployment-kind': 'preview'
      'pull-request': string(pullRequestNumber)
    })
  : union(baseTags, {
      'deployment-kind': 'stable'
    })

module portal './modules/containerapp.bicep' = {
  name: 'container-app'
  params: {
    location: location
    appName: appName
    containerImage: containerImage
    managedEnvironmentId: managedEnvironment.id
    acrLoginServer: registry.properties.loginServer
    pullIdentityId: pullIdentity.id
    tags: tags
  }
}

output appFqdn string = portal.outputs.appFqdn
output appResourceId string = portal.outputs.appResourceId
