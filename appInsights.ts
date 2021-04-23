let appInsights = require('applicationinsights');

export function getAppInsightsClient() : any {

    appInsights.setup("0ed88d41-03a3-47cf-8724-cbbd67a1cf16").start();
    
    let client = appInsights.defaultClient;

    return client;
}