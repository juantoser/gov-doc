param location string
param appName string
param containerImage string
param managedEnvironmentId string
param acrLoginServer string
param pullIdentityId string
param tags object

var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var isPlaceholder = containerImage == placeholderImage
var appPort = 8080
var effectivePort = isPlaceholder ? 80 : appPort

resource containerApp 'Microsoft.App/containerApps@2026-07-01' = {
  name: appName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${pullIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: effectivePort
        allowInsecure: false
        transport: 'auto'
      }
      registries: isPlaceholder ? [] : [
        {
          server: acrLoginServer
          identity: pullIdentityId
        }
      ]
      secrets: []
    }
    template: {
      containers: [
        {
          name: 'portal'
          image: containerImage
          resources: {
            cpu: '0.25'
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'PORT'
              value: string(effectivePort)
            }
          ]
          probes: [
            {
              type: 'Readiness'
              httpGet: {
                path: '/'
                port: effectivePort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/'
                port: effectivePort
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
}

output appName string = containerApp.name
output appFqdn string = containerApp.properties.configuration.ingress.fqdn
output appResourceId string = containerApp.id
