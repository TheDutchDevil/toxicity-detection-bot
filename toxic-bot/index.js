const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/rest");

import { Command, EventProcessor } from "./eventProcessor";

async function run() {

  try {
    const { context } = github;

    const eventProcessor = new EventProcessor();

    await eventProcessor.processEvent(context);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();