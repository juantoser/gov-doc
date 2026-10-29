targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

param sessionId string
@description('UTC timestamp applied to resources created by this deployment.')
param createdAt string
param resourceGroupName string = 'rg-gov-doc-dev-0d63'
param containerAppName string = 'ca-gov-doc-dev-0d63'
param managedEnvironmentResourceName string = 'cae-gov-doc-dev-0d63'
param containerRegistryName string = 'crgovdocdev0d63'
param logAnalyticsWorkspaceName string = 'log-gov-doc-dev-0d63'
param githubIdentityName string = 'id-gov-doc-gha-0d63'
param pullIdentityName string = 'id-gov-doc-pull-0d63'
@description('Deployment actor tag. Override at deployment time; do not commit personal values.')
param deployedBy string = 'automated-deployment'
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

resource githubDeploymentRoleDefinition 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(subscription().id, 'gov-doc-github-containerapps-deployer')
  properties: {
    roleName: 'Gov Doc GitHub Container Apps Deployer 0d63'
    description: 'Deploy and remove Container Apps through resource-group Bicep deployments; image push is granted separately on the registry.'
    type: 'CustomRole'
    permissions: [
      {
        actions: [
          'Microsoft.Resources/deployments/read'
          'Microsoft.Resources/deployments/write'
          'Microsoft.Resources/deployments/validate/action'
          'Microsoft.Resources/deployments/whatIf/action'
          'Microsoft.Resources/deployments/operations/read'
          'Microsoft.Resources/deployments/operationStatuses/read'
          'Microsoft.Resources/subscriptions/resourceGroups/read'
          'Microsoft.App/containerApps/read'
          'Microsoft.App/containerApps/write'
          'Microsoft.App/containerApps/delete'
          'Microsoft.App/managedEnvironments/read'
          'Microsoft.App/managedEnvironments/join/action'
          'Microsoft.ContainerRegistry/registries/read'
        ]
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
    assignableScopes: [
      subscription().id
    ]
  }
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// Keep the runtime pull identity separate from GitHub Actions' deployment identity.
module platform './modules/platform.bicep' = {
  name: 'platform'
  scope: rg
  params: {
    location: location
    tags: tags
    githubOwner: 'juantoser'
    githubRepo: 'gov-doc'
    registryName: containerRegistryName
    workspaceName: logAnalyticsWorkspaceName
    managedEnvironmentName: managedEnvironmentResourceName
    githubIdentityName: githubIdentityName
    pullIdentityName: pullIdentityName
    githubDeploymentRoleDefinitionId: githubDeploymentRoleDefinition.id
  }
}

module portal './modules/containerapp.bicep' = {
  name: 'portal'
  scope: rg
  params: {
    location: location
    appName: containerAppName
    containerImage: containerImage
    managedEnvironmentId: platform.outputs.managedEnvironmentId
    acrLoginServer: platform.outputs.acrLoginServer
    pullIdentityId: platform.outputs.pullIdentityId
    tags: tags
  }
}

output appName string = portal.outputs.appName
output appFqdn string = portal.outputs.appFqdn
output acrName string = platform.outputs.acrName
output acrLoginServer string = platform.outputs.acrLoginServer
output managedEnvironmentName string = platform.outputs.managedEnvironmentName
output pullIdentityId string = platform.outputs.pullIdentityId
output githubIdentityClientId string = platform.outputs.githubIdentityClientId
