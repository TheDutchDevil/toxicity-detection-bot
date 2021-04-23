const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/rest");

import {insights} from "./appInsights";


import { Command, EventProcessor } from "./eventProcessor";

async function run() {

  try {
    const { context } = github;

    const eventProcessor = new EventProcessor();

    await eventProcessor.processEvent(context);
  } catch (error) {
    insights.getAppInsightsClient().trackException({exception: error})
    core.setFailed(error.message);
  }
}

run();